import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import {
  getPendingSpend,
  listPendingSpends,
  listSpendsByStatus,
  markApproved,
  markRejected,
  type PendingSpendStatus,
} from "../db/repositories/pendingSpendsRepo.js";
import { getOperatorContract } from "../chain/contractClient.js";
import { verifyManager } from "../auth/managerAllowlist.js";
import { linkEvidenceToSpend } from "../evidence/storage.js";
import { CATEGORIES } from "../config/constants.js";
import { env } from "../config/env.js";

export const pendingSpendsRouter = Router();

const reviewBodySchema = z.object({
  authAddress: z.string(),
  authNonce: z.string(),
  authTimestamp: z.coerce.number(),
  authSignature: z.string(),
  note: z.string().optional(),
});

function serializePending(p: Awaited<ReturnType<typeof getPendingSpend>>) {
  if (!p) return null;
  return {
    pendingSpendId: p.id,
    campaignId: p.campaign_id,
    amountPaise: p.amount_paise,
    category: p.category,
    memo: p.memo,
    evidenceCID: p.evidence_cid,
    aiReason: p.ai_reason,
    operatorAddress: p.operator_address,
    submittedAt: p.submitted_at,
    status: p.status,
    reviewedAt: p.reviewed_at,
    reviewerAddress: p.reviewer_address,
    reviewNote: p.review_note,
    txHash: p.tx_hash,
  };
}

const REVIEW_STATUSES: PendingSpendStatus[] = ["pending", "approved", "rejected", "ai_rejected"];

/**
 * @openapi
 * /api/campaigns/{id}/pending-spends:
 *   get:
 *     summary: List spends awaiting campaign manager review
 *     tags: [Review]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pending spends for this campaign
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PendingSpend' }
 */
pendingSpendsRouter.get("/api/campaigns/:id/pending-spends", async (req, res) => {
  const campaignId = Number(req.params.id);
  const items = await listPendingSpends(campaignId);
  res.json({ items: items.map(serializePending) });
});

/**
 * @openapi
 * /api/campaigns/{id}/spend-reviews:
 *   get:
 *     summary: Full spend review trail (pending, approved, rejected, and AI-auto-rejected)
 *     description: >
 *       Fraud-audit view: every spend an operator has submitted for this campaign, including
 *       ones the Gemini evidence screen or a manager rejected -- each still carrying its
 *       evidenceCID and operatorAddress (evidence files are retained on rejection, never
 *       deleted), so this is the record of who submitted what and why it was refused.
 *     tags: [Review]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Comma-separated subset of pending,approved,rejected,ai_rejected. Defaults to all four.
 *     responses:
 *       200:
 *         description: Every reviewed/pending spend for this campaign, most recent first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PendingSpend' }
 */
pendingSpendsRouter.get("/api/campaigns/:id/spend-reviews", async (req, res) => {
  const campaignId = Number(req.params.id);
  const requested = typeof req.query.status === "string" ? req.query.status.split(",") : REVIEW_STATUSES;
  const statuses = requested.filter((s): s is PendingSpendStatus => (REVIEW_STATUSES as string[]).includes(s));
  const items = await listSpendsByStatus(campaignId, statuses.length > 0 ? statuses : REVIEW_STATUSES);
  res.json({ items: items.map(serializePending) });
});

/**
 * @openapi
 * /api/pending-spends/{id}/approve:
 *   post:
 *     summary: Campaign manager approves a pending spend, writing it on-chain
 *     description: Performs the attestSpend call this spend was queued for -- the manager's signature only gates whether this happens, the chain write itself still runs via the backend's configured operator signer.
 *     tags: [Review]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewRequest'
 *     responses:
 *       200:
 *         description: Approved and attested on-chain
 *       401:
 *         description: Manager signature invalid or not in MANAGER_ALLOWLIST
 *       404:
 *         description: Pending spend not found, or already reviewed
 *       422:
 *         description: Contract reverted
 */
pendingSpendsRouter.post("/api/pending-spends/:id/approve", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pending = await getPendingSpend(id);
    if (!pending || pending.status !== "pending") {
      res.status(404).json({ error: "NOT_FOUND", detail: `pending spend ${id} not found or already reviewed` });
      return;
    }

    const body = reviewBodySchema.parse(req.body);
    const authCheck = verifyManager("POST /api/pending-spends/:id/approve", pending.campaign_id, {
      address: body.authAddress,
      nonce: body.authNonce,
      timestamp: body.authTimestamp,
      signature: body.authSignature,
    });
    if (!authCheck.ok) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: authCheck.reason });
      return;
    }

    const categoryIndex = CATEGORIES.indexOf(pending.category);
    const contract = getOperatorContract();

    let tx;
    try {
      tx = await contract.attestSpend(
        pending.campaign_id,
        ethers.ZeroHash,
        pending.vendor_ref_hash,
        pending.amount_paise,
        categoryIndex,
        pending.evidence_cid,
        pending.memo ?? ""
      );
    } catch (err: any) {
      res.status(422).json({
        error: err?.shortMessage ?? "The contract rejected this transaction.",
        code: "CONTRACT_REVERT",
        detail: err?.shortMessage ?? err?.message ?? "unknown revert",
      });
      return;
    }

    const receipt = await tx.wait();
    const parsed = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((p: any) => p?.name === "SpendAttested");
    const spendRef = parsed?.args?.spendRef as string | undefined;

    if (spendRef) await linkEvidenceToSpend(pending.campaign_id, pending.evidence_cid, spendRef, pending.evidence_mimetype);

    await markApproved(id, body.authAddress, body.note ?? null, receipt.hash);

    res.status(200).json({
      pendingSpendId: id,
      spendRef,
      txHash: receipt.hash,
      explorerUrl: `${env.MONAD_EXPLORER_TX_BASE_URL}/${receipt.hash}`,
      evidenceCID: pending.evidence_cid,
      status: "approved",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/pending-spends/{id}/reject:
 *   post:
 *     summary: Campaign manager rejects a pending spend (no chain write)
 *     tags: [Review]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewRequest'
 *     responses:
 *       200:
 *         description: Rejected
 *       401:
 *         description: Manager signature invalid or not in MANAGER_ALLOWLIST
 *       404:
 *         description: Pending spend not found, or already reviewed
 */
pendingSpendsRouter.post("/api/pending-spends/:id/reject", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const pending = await getPendingSpend(id);
    if (!pending || pending.status !== "pending") {
      res.status(404).json({ error: "NOT_FOUND", detail: `pending spend ${id} not found or already reviewed` });
      return;
    }

    const body = reviewBodySchema.parse(req.body);
    const authCheck = verifyManager("POST /api/pending-spends/:id/reject", pending.campaign_id, {
      address: body.authAddress,
      nonce: body.authNonce,
      timestamp: body.authTimestamp,
      signature: body.authSignature,
    });
    if (!authCheck.ok) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: authCheck.reason });
      return;
    }

    await markRejected(id, body.authAddress, body.note ?? null);

    res.status(200).json({ pendingSpendId: id, status: "rejected" });
  } catch (err) {
    next(err);
  }
});
