import { describe, it, expect } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../../src/auth/webhookHmac.js";

describe("webhookHmac (also Razorpay's documented webhook signature scheme)", () => {
  it("verifies a signature produced with the same secret", () => {
    const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const signature = signWebhookPayload(body, "a-secret");
    expect(verifyWebhookSignature(body, signature, "a-secret")).toBe(true);
  });

  it("rejects a signature produced with a different secret", () => {
    const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const signature = signWebhookPayload(body, "secret-a");
    expect(verifyWebhookSignature(body, signature, "secret-b")).toBe(false);
  });

  it("rejects if the body was tampered with after signing", () => {
    const original = Buffer.from(JSON.stringify({ amount: 50000 }));
    const signature = signWebhookPayload(original, "a-secret");
    const tampered = Buffer.from(JSON.stringify({ amount: 5000000 }));
    expect(verifyWebhookSignature(tampered, signature, "a-secret")).toBe(false);
  });

  it("rejects a missing signature", () => {
    const body = Buffer.from("{}");
    expect(verifyWebhookSignature(body, undefined, "a-secret")).toBe(false);
  });

  it("defaults to WEBHOOK_HMAC_SECRET when no secret argument is given", () => {
    const body = Buffer.from("{}");
    const signature = signWebhookPayload(body); // uses env.WEBHOOK_HMAC_SECRET
    expect(verifyWebhookSignature(body, signature)).toBe(true); // same default
  });
});
