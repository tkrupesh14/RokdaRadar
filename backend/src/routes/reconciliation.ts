import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { verifyManager } from "../auth/managerAllowlist.js";
import { importStatementLines, parseBankStatementCsv, runReconciliation } from "../jobs/reconciliationJob.js";

export const reconciliationRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const importBodySchema = z.object({
  authAddress: z.string(),
  authNonce: z.string(),
  authTimestamp: z.coerce.number(),
  authSignature: z.string(),
});

/**
 * @openapi
 * /api/campaigns/{id}/reconciliation/import:
 *   post:
 *     summary: Manager imports a bank statement to reconcile against on-chain donations/spends
 *     description: >
 *       Manager-signed (same auth as pending-spend review). CSV with columns `date,type,utr,amountPaise`
 *       (type is `credit` or `debit`). Credit rows are matched exactly against donations by UTR hash;
 *       debit rows are matched against spends by amount only (spends don't carry a real settlement UTR
 *       yet -- see src/jobs/reconciliationJob.ts). Runs matching immediately and returns the resulting
 *       flags (LLD Section 7.2).
 *     tags: [Reconciliation]
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
 *             type: object
 *             required: [statement, authAddress, authNonce, authTimestamp, authSignature]
 *             properties:
 *               statement: { type: string, format: binary }
 *               authAddress: { type: string }
 *               authNonce: { type: string }
 *               authTimestamp: { type: integer }
 *               authSignature: { type: string }
 *     responses:
 *       200:
 *         description: Statement imported and matched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReconciliationSummary'
 *       400:
 *         description: Malformed CSV
 *       401:
 *         description: Manager signature invalid or not in MANAGER_ALLOWLIST
 *       404:
 *         description: Campaign not found
 */
reconciliationRouter.post("/api/campaigns/:id/reconciliation/import", upload.single("statement"), async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${campaignId} not found` });
      return;
    }

    const body = importBodySchema.parse(req.body);
    const authCheck = verifyManager("POST /api/campaigns/:id/reconciliation/import", campaignId, {
      address: body.authAddress,
      nonce: body.authNonce,
      timestamp: body.authTimestamp,
      signature: body.authSignature,
    });
    if (!authCheck.ok) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: authCheck.reason });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "BAD_REQUEST", detail: "statement file required" });
      return;
    }

    let rows;
    try {
      rows = parseBankStatementCsv(req.file.buffer.toString("utf8"));
    } catch (err: any) {
      res.status(400).json({ error: "BAD_REQUEST", detail: err?.message ?? "malformed CSV" });
      return;
    }

    await importStatementLines(campaignId, rows);
    const summary = await runReconciliation(campaignId);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/campaigns/{id}/reconciliation:
 *   get:
 *     summary: Current reconciliation status for a campaign (re-runs matching, doesn't import anything)
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Reconciliation summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReconciliationSummary'
 *       404:
 *         description: Campaign not found
 */
reconciliationRouter.get("/api/campaigns/:id/reconciliation", async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${campaignId} not found` });
      return;
    }
    const summary = await runReconciliation(campaignId);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});
