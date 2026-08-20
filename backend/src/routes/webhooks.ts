import { Router, raw } from "express";
import { ethers } from "ethers";
import { verifyWebhookSignature } from "../auth/webhookHmac.js";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { getOracleContract } from "../chain/contractClient.js";
import { env } from "../config/env.js";

export const webhooksRouter = Router();

const seenPaymentIds = new Set<string>();

/**
 * @openapi
 * /api/webhooks/upi:
 *   post:
 *     summary: PSP webhook receiver (mocked PSP in MVP0)
 *     description: Verifies X-Webhook-Signature (HMAC-SHA256), deduplicates by payment.id, hashes the VPA server-side, and calls attestDonation on-chain.
 *     tags: [Payments]
 *     parameters:
 *       - in: header
 *         name: X-Webhook-Signature
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpiWebhookPayload'
 *     responses:
 *       200:
 *         description: Processed (or already processed -- idempotent)
 *       401:
 *         description: Invalid or missing signature
 *       422:
 *         description: Contract reverted
 */
webhooksRouter.post("/api/webhooks/upi", raw({ type: "application/json" }), async (req, res, next) => {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.header("X-Webhook-Signature");

    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: "invalid or missing X-Webhook-Signature" });
      return;
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const payment = payload?.payload?.payment;
    if (!payment?.id || !payment?.utr || !payment?.amount || !payment?.notes?.campaignId) {
      res.status(400).json({ error: "BAD_REQUEST", detail: "malformed webhook payload" });
      return;
    }

    if (seenPaymentIds.has(payment.id)) {
      res.status(200).json({ status: "already_processed" });
      return;
    }

    const campaignId = Number(payment.notes.campaignId);
    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${campaignId} not found` });
      return;
    }

    // Raw UTR and VPA are hashed immediately and never stored/logged (LLD 7.1
    // step 3; HLD Section 6 trust boundary table).
    const utrHash = ethers.keccak256(ethers.toUtf8Bytes(payment.utr));
    const donorRef = ethers.keccak256(ethers.toUtf8Bytes(`${payment.vpa ?? "unknown"}:${env.WEBHOOK_HMAC_SECRET}`));
    const amountPaise = Number(payment.amount);

    const contract = getOracleContract();
    let tx;
    try {
      tx = await contract.attestDonation(campaignId, utrHash, donorRef, amountPaise);
    } catch (err: any) {
      res.status(422).json({
        error: "The contract rejected this transaction.",
        code: "CONTRACT_REVERT",
        detail: err?.shortMessage ?? err?.message ?? "unknown revert",
      });
      return;
    }
    const receipt = await tx.wait();

    seenPaymentIds.add(payment.id);

    res.status(200).json({ status: "confirmed", txHash: receipt.hash });
  } catch (err) {
    next(err);
  }
});
