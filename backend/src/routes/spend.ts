import { Router } from "express";
import multer from "multer";
import { ethers } from "ethers";
import { z } from "zod";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { insertPendingSpend, insertAiRejectedSpend } from "../db/repositories/pendingSpendsRepo.js";
import { verifySignedRequest } from "../auth/operatorSignature.js";
import { validateEvidenceFile, scanForPossiblePii } from "../evidence/validate.js";
import { saveEvidence } from "../evidence/storage.js";
import { classifyEvidence } from "../ai/evidenceClassifier.js";
import { CATEGORIES, EVIDENCE_MAX_BYTES } from "../config/constants.js";

export const spendRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: EVIDENCE_MAX_BYTES } });

const spendBodySchema = z.object({
  vendorRef: z.string().min(1),
  amountPaise: z.coerce.number().int().positive(),
  category: z.enum(CATEGORIES),
  memo: z.string().default(""),
  authAddress: z.string(),
  authNonce: z.string(),
  authTimestamp: z.coerce.number(),
  authSignature: z.string(),
});

/**
 * @openapi
 * /api/campaigns/{id}/spend:
 *   post:
 *     summary: Operator submits a spend for review
 *     description: >
 *       Evidence is first screened by Gemini ("is this a bill/receipt, or something unrelated?") --
 *       evidence that clearly isn't a payment record is rejected immediately, before anything is
 *       stored or written on-chain. Evidence that passes is stored and queued as a pending spend;
 *       it is NOT yet attested on-chain. A campaign manager must call
 *       POST /api/pending-spends/{id}/approve (which performs the actual attestSpend) or /reject.
 *     tags: [Spends]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/SpendRequest'
 *     responses:
 *       202:
 *         description: Evidence accepted by the AI screen; queued for manager review
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PendingSpendResponse'
 *       401:
 *         description: Operator signature invalid
 *       422:
 *         description: Evidence invalid, or the AI screen rejected it as not a bill/receipt
 *       503:
 *         description: AI evidence screen unavailable (GEMINI_API_KEY not configured, or the call failed)
 */
spendRouter.post("/api/campaigns/:id/spend", upload.single("evidenceFile"), async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${campaignId} not found` });
      return;
    }

    const body = spendBodySchema.parse(req.body);

    const authCheck = verifySignedRequest("POST /api/campaigns/:id/spend", campaignId, {
      address: body.authAddress,
      nonce: body.authNonce,
      timestamp: body.authTimestamp,
      signature: body.authSignature,
    });
    if (!authCheck.ok) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: authCheck.reason });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(422).json({
        error: "evidence required",
        code: "CONTRACT_REVERT",
        detail: "The contract rejects this transaction because no evidence was attached.",
      });
      return;
    }

    const mimeError = validateEvidenceFile(file);
    if (mimeError) {
      res.status(422).json({ error: mimeError.code, detail: mimeError.detail });
      return;
    }

    const piiError = scanForPossiblePii(file.buffer, file.mimetype);
    if (piiError) {
      res.status(422).json({ error: piiError.code, detail: piiError.detail });
      return;
    }

    let classification;
    try {
      classification = await classifyEvidence(file.buffer, file.mimetype);
    } catch (err: any) {
      // Covers both "GEMINI_API_KEY is not configured" (thrown synchronously
      // by evidenceClassifier.ts's getClient()) and any live API failure.
      res.status(503).json({
        error: "AI_SERVICE_UNAVAILABLE",
        detail: err?.message ?? "Evidence classification failed",
      });
      return;
    }

    // Raw vendorRef is hashed server-side and never stored/logged (LLD 4.1 step 3).
    const vendorRefHash = ethers.keccak256(ethers.toUtf8Bytes(body.vendorRef));

    if (!classification.isBill) {
      // Evidence is kept, not discarded: a rejected submission is retained
      // as proof of what was actually uploaded and by which operator
      // address, in case of a pattern of fraudulent submissions.
      let rejectedCid: string;
      try {
        ({ cid: rejectedCid } = await saveEvidence(campaignId, file.buffer, file.mimetype));
      } catch (err: any) {
        res.status(503).json({
          error: "EVIDENCE_STORAGE_UNAVAILABLE",
          detail: err?.message ?? "Could not store evidence",
        });
        return;
      }
      await insertAiRejectedSpend({
        campaign_id: campaignId,
        vendor_ref_hash: vendorRefHash,
        amount_paise: body.amountPaise,
        category: body.category,
        memo: body.memo || null,
        evidence_cid: rejectedCid,
        evidence_mimetype: file.mimetype,
        ai_reason: classification.reason || null,
        operator_address: body.authAddress,
        submitted_at: Math.floor(Date.now() / 1000),
      });

      res.status(422).json({
        error: "EVIDENCE_REJECTED",
        code: "AI_EVIDENCE_REJECTED",
        detail: classification.reason || "This doesn't look like a bill or receipt.",
      });
      return;
    }

    let cid: string;
    try {
      ({ cid } = await saveEvidence(campaignId, file.buffer, file.mimetype));
    } catch (err: any) {
      res.status(503).json({
        error: "EVIDENCE_STORAGE_UNAVAILABLE",
        detail: err?.message ?? "Could not store evidence",
      });
      return;
    }

    const pendingSpendId = await insertPendingSpend({
      campaign_id: campaignId,
      vendor_ref_hash: vendorRefHash,
      amount_paise: body.amountPaise,
      category: body.category,
      memo: body.memo || null,
      evidence_cid: cid,
      evidence_mimetype: file.mimetype,
      ai_reason: classification.reason || null,
      operator_address: body.authAddress,
      submitted_at: Math.floor(Date.now() / 1000),
    });

    res.status(202).json({
      pendingSpendId,
      status: "pending_review",
      evidenceCID: cid,
      aiReason: classification.reason,
    });
  } catch (err) {
    next(err);
  }
});
