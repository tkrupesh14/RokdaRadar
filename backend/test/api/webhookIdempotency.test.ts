import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { freshTestDb } from "../testDb.js";

const WEBHOOK_SECRET = "test-webhook-secret";
process.env.WEBHOOK_HMAC_SECRET = WEBHOOK_SECRET;

let attestDonationCalls = 0;

vi.mock("../../src/chain/contractClient.js", () => ({
  getOracleContract: () => ({
    attestDonation: async (..._args: unknown[]) => {
      attestDonationCalls += 1;
      return {
        wait: async () => ({ hash: `0xtx${attestDonationCalls}` }),
      };
    },
  }),
  getOperatorContract: () => ({}),
  getReadContract: () => ({}),
}));

function sign(rawBody: Buffer): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

function buildPayload(paymentId: string, campaignId: number, amount = 50000) {
  return {
    event: "payment.captured",
    payload: {
      payment: { id: paymentId, amount, utr: "308825001234", vpa: "donor@upi", notes: { campaignId: String(campaignId) } },
    },
  };
}

describe("POST /api/webhooks/upi idempotency", () => {
  beforeEach(async () => {
    freshTestDb();
    attestDonationCalls = 0;
    const { insertCampaign } = await import("../../src/db/repositories/campaignsRepo.js");
    insertCampaign({
      id: 1,
      operator: "0xoperator",
      disaster_tag: "KL-WAYANAD-2026-07",
      darpan_id: "D1",
      reg_80g: "80G1",
      promise_hash: "0xpromise",
      created_at: 1000,
      creation_tx_hash: "0xcreate",
    });
  });

  it("rejects a request with an invalid signature with 401", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildPayload("pay_1", 1)));

    const res = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", "not-a-valid-signature")
      .send(rawBody);

    expect(res.status).toBe(401);
  });

  it("rejects a request with a missing signature header with 401", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildPayload("pay_2", 1)));

    const res = await request(app).post("/api/webhooks/upi").set("Content-Type", "application/json").send(rawBody);

    expect(res.status).toBe(401);
  });

  it("processes a valid, correctly-signed webhook exactly once on double-delivery", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildPayload("pay_dup", 1)));
    const signature = sign(rawBody);

    const first = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", signature)
      .send(rawBody);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("confirmed");

    const second = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", signature)
      .send(rawBody);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("already_processed");

    expect(attestDonationCalls).toBe(1);
  });
});
