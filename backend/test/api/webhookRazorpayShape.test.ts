import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "dotenv/config";
import crypto from "node:crypto";
import request from "supertest";

// Real Razorpay payload shape (payload.payment.entity, acquirer_data.rrn
// for the UPI reference, X-Razorpay-Signature header) -- see the comment
// in routes/webhooks.ts on why both this and the original mock shape are
// accepted. Uses the same env-reset pattern as donateOrder.test.ts since
// this needs RAZORPAY_WEBHOOK_SECRET set to a known value for signing.
function buildRazorpayPayload(paymentId: string, campaignId: number, amountPaise: number, rrn: string) {
  return {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          amount: amountPaise,
          vpa: "donor@upi",
          notes: { campaignId: String(campaignId) },
          acquirer_data: { rrn },
        },
      },
    },
  };
}

vi.mock("../../src/chain/contractClient.js", () => ({
  getOracleContract: () => ({ attestDonation: async () => ({ wait: async () => ({ hash: "0xrazorpaytx" }) }) }),
  getOperatorContract: () => ({}),
  getReadContract: () => ({}),
}));

describe("POST /api/webhooks/upi (real Razorpay payload shape)", () => {
  const originalEnv = { ...process.env };
  const CAMPAIGN_ID = 1;

  beforeEach(async () => {
    vi.resetModules();
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-razorpay-webhook-secret";
    const { freshTestDb } = await import("../testDb.js");
    await freshTestDb();
    const { insertCampaign } = await import("../../src/db/repositories/campaignsRepo.js");
    await insertCampaign({
      id: CAMPAIGN_ID,
      operator: "0xoperator",
      disaster_tag: "KL-WAYANAD-2026-07",
      darpan_id: "D1",
      reg_80g: "80G1",
      promise_hash: "0xpromise",
      created_at: 1000,
      creation_tx_hash: "0xcreate",
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts a validly-signed real-shape webhook and attests on-chain", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildRazorpayPayload("pay_real1", CAMPAIGN_ID, 50000, "308825001234")));
    const signature = crypto.createHmac("sha256", "test-razorpay-webhook-secret").update(rawBody).digest("hex");

    const res = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", signature)
      .send(rawBody.toString("utf8"));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.txHash).toBe("0xrazorpaytx");
  });

  it("rejects a real-shape webhook signed with the wrong secret", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildRazorpayPayload("pay_real2", CAMPAIGN_ID, 50000, "308825001234")));
    const signature = crypto.createHmac("sha256", "wrong-secret").update(rawBody).digest("hex");

    const res = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", signature)
      .send(rawBody.toString("utf8"));

    expect(res.status).toBe(401);
  });

  it("rejects a real-shape webhook when RAZORPAY_WEBHOOK_SECRET isn't configured, even with a well-formed signature header", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildRazorpayPayload("pay_real3", CAMPAIGN_ID, 50000, "308825001234")));
    // Signed with *something* -- the point is the server has no configured
    // secret to check it against, so this must never be treated as valid.
    const signature = crypto.createHmac("sha256", "whatever").update(rawBody).digest("hex");

    const res = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", signature)
      .send(rawBody.toString("utf8"));

    expect(res.status).toBe(401);
  });
});
