import crypto from "node:crypto";
import { env } from "../config/env.js";

// Real, load-bearing HMAC-SHA256 verification (LLD 7.1 step 1). Constant-time
// comparison so response timing can't leak how much of the signature matched.
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", env.WEBHOOK_HMAC_SECRET).update(rawBody).digest("hex");

  const provided = Buffer.from(signatureHeader, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (provided.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(provided, expectedBuf);
}

export function signWebhookPayload(rawBody: Buffer): string {
  return crypto.createHmac("sha256", env.WEBHOOK_HMAC_SECRET).update(rawBody).digest("hex");
}
