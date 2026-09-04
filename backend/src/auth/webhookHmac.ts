import crypto from "node:crypto";
import { env } from "../config/env.js";

// Real, load-bearing HMAC-SHA256 verification (LLD 7.1 step 1) -- also
// Razorpay's actual documented webhook signature scheme (hex HMAC-SHA256 of
// the raw body, https://razorpay.com/docs/webhooks/validate-test/), so this
// same function verifies both the mock webhook (WEBHOOK_HMAC_SECRET) and
// real Razorpay webhooks (RAZORPAY_WEBHOOK_SECRET) -- see routes/webhooks.ts
// for which secret it's called with. Constant-time comparison so response
// timing can't leak how much of the signature matched.
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string = env.WEBHOOK_HMAC_SECRET): boolean {
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const provided = Buffer.from(signatureHeader, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (provided.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(provided, expectedBuf);
}

export function signWebhookPayload(rawBody: Buffer, secret: string = env.WEBHOOK_HMAC_SECRET): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}
