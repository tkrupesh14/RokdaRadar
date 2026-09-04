import { Router, raw } from "express";
import { ethers } from "ethers";
import { verifyWebhookSignature } from "../auth/webhookHmac.js";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { getOracleContract } from "../chain/contractClient.js";
import { env } from "../config/env.js";
import { simpleRateLimiter, byIp } from "../middleware/rateLimiter.js";

// Factory (not a module-level singleton) so each createApp() call -- each
// test run, each server boot -- gets its own limiter/idempotency state
// instead of sharing it across unrelated callers.
export function createWebhooksRouter(): Router {
  const webhooksRouter = Router();
  const webhookLimiter = simpleRateLimiter(env.RATE_LIMIT_WEBHOOK_WINDOW_MS, env.RATE_LIMIT_WEBHOOK_MAX, byIp);

  // payment.id -> first-seen timestamp. Bounds idempotency dedup beyond a
  // single call (double-delivery is what PSPs actually retry within), while
  // capping memory under sustained production volume -- see issue #19.
  const seenPaymentIds = new Map<string, number>();

  function pruneExpired(): void {
    const now = Date.now();
    for (const [id, seenAt] of seenPaymentIds) {
      if (now - seenAt > env.WEBHOOK_IDEMPOTENCY_WINDOW_MS) seenPaymentIds.delete(id);
    }
  }

  /**
   * @openapi
   * /api/webhooks/upi:
   *   post:
   *     summary: PSP webhook receiver -- real Razorpay webhook, or the mocked PSP shape
   *     description: >
   *       Verifies the webhook signature, deduplicates by payment id, hashes the VPA server-side,
   *       and calls attestDonation on-chain. Accepts two payload shapes: Razorpay's real documented
   *       webhook format (payload.payment.entity, X-Razorpay-Signature header, verified against
   *       RAZORPAY_WEBHOOK_SECRET when configured) and this project's original flat mock shape
   *       (payload.payload.payment, X-Webhook-Signature header, verified against
   *       WEBHOOK_HMAC_SECRET) -- the mock flow (POST /api/campaigns/:id/donate) still uses the
   *       latter. See issue #6.
   *     tags: [Payments]
   *     parameters:
   *       - in: header
   *         name: X-Razorpay-Signature
   *         schema: { type: string }
   *         description: Present on real Razorpay webhooks.
   *       - in: header
   *         name: X-Webhook-Signature
   *         schema: { type: string }
   *         description: Present on the mocked webhook shape (POST /api/campaigns/:id/donate's flow).
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
   *       429:
   *         description: Rate limited
   */
  webhooksRouter.post("/api/webhooks/upi", webhookLimiter, raw({ type: "application/json" }), async (req, res, next) => {
    try {
      const rawBody = req.body as Buffer;

      // Real Razorpay webhooks arrive with X-Razorpay-Signature, verified
      // against RAZORPAY_WEBHOOK_SECRET; the original mock shape arrives with
      // X-Webhook-Signature, verified against WEBHOOK_HMAC_SECRET. Whichever
      // header is present picks which secret verifies it -- never both.
      const razorpaySignature = req.header("X-Razorpay-Signature");
      const mockSignature = req.header("X-Webhook-Signature");

      let verified: boolean;
      if (razorpaySignature) {
        verified = Boolean(env.RAZORPAY_WEBHOOK_SECRET) && verifyWebhookSignature(rawBody, razorpaySignature, env.RAZORPAY_WEBHOOK_SECRET);
      } else {
        verified = verifyWebhookSignature(rawBody, mockSignature);
      }
      if (!verified) {
        res.status(401).json({ error: "UNAUTHORIZED", detail: "invalid or missing webhook signature" });
        return;
      }

      const payload = JSON.parse(rawBody.toString("utf8"));
      // Real Razorpay nests the payment under payload.payment.entity; the
      // original mock shape has it directly under payload.payment. Support
      // both rather than picking one and breaking the other.
      const payment = payload?.payload?.payment?.entity ?? payload?.payload?.payment;
      // Real Razorpay has no top-level `utr` on the payment entity -- for UPI
      // payments the bank reference (UTR-equivalent) is acquirer_data.rrn.
      // Falls back to `utr` for the mock shape.
      const utr = payment?.acquirer_data?.rrn ?? payment?.utr;
      if (!payment?.id || !utr || !payment?.amount || !payment?.notes?.campaignId) {
        res.status(400).json({ error: "BAD_REQUEST", detail: "malformed webhook payload" });
        return;
      }

      pruneExpired();
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
      const utrHash = ethers.keccak256(ethers.toUtf8Bytes(utr));
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

      seenPaymentIds.set(payment.id, Date.now());

      res.status(200).json({ status: "confirmed", txHash: receipt.hash });
    } catch (err) {
      next(err);
    }
  });

  return webhooksRouter;
}
