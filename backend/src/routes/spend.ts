import { Router } from "express";
import multer from "multer";
import { ethers } from "ethers";
import { z } from "zod";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { getOperatorContract } from "../chain/contractClient.js";
import { verifySignedRequest } from "../auth/operatorSignature.js";
import { validateEvidenceFile, scanForPossiblePii } from "../evidence/validate.js";
import { saveEvidence, linkEvidenceToSpend } from "../evidence/storage.js";
import { CATEGORIES, EVIDENCE_MAX_BYTES } from "../config/constants.js";
import { env } from "../config/env.js";

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
 *     summary: Operator records a spend
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
 *       201:
 *         description: Spend attested
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SpendResponse'
 *       401:
 *         description: Operator signature invalid
 *       422:
 *         description: Evidence invalid or contract reverted
 */
spendRouter.post("/api/campaigns/:id/spend", upload.single("evidenceFile"), async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = getCampaign(campaignId);
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

    const { cid } = saveEvidence(campaignId, file.buffer, file.mimetype);

    // Raw vendorRef is hashed server-side and never stored/logged (LLD 4.1 step 3).
    const vendorRefHash = ethers.keccak256(ethers.toUtf8Bytes(body.vendorRef));
    const categoryIndex = CATEGORIES.indexOf(body.category);
    const contract = getOperatorContract();

    let tx;
    try {
      tx = await contract.attestSpend(
        campaignId,
        ethers.ZeroHash,
        vendorRefHash,
        body.amountPaise,
        categoryIndex,
        cid,
        body.memo
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

    if (spendRef) linkEvidenceToSpend(campaignId, cid, spendRef, file.mimetype);

    res.status(201).json({
      spendRef,
      txHash: receipt.hash,
      explorerUrl: `${env.MONAD_EXPLORER_TX_BASE_URL}/${receipt.hash}`,
      evidenceCID: cid,
      status: "confirmed",
    });
  } catch (err) {
    next(err);
  }
});
