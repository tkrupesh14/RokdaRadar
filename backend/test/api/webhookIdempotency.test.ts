import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { freshTestDb } from "../testDb.js";
// freshTestDb transitively imports config/env.js (via db/client.ts), and ES
// module imports resolve before this file's own top-level body runs -- so
// signing must read whatever secret env.ts actually loaded (the default from
// .env.example) rather than assuming a process.env override "wins" a race
// against static import resolution.
import { env } from "../../src/config/env.js";

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
  return crypto.createHmac("sha256", env.WEBHOOK_HMAC_SECRET).update(rawBody).digest("hex");
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
    await freshTestDb();
    attestDonationCalls = 0;
    const { insertCampaign } = await import("../../src/db/repositories/campaignsRepo.js");
    await insertCampaign({
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
      .send(rawBody.toString("utf8"));

    expect(res.status).toBe(401);
  });

  it("rejects a request with a missing signature header with 401", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const rawBody = Buffer.from(JSON.stringify(buildPayload("pay_2", 1)));

    const res = await request(app).post("/api/webhooks/upi").set("Content-Type", "application/json").send(rawBody.toString("utf8"));

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
      .send(rawBody.toString("utf8"));
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("confirmed");

    const second = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", signature)
      .send(rawBody.toString("utf8"));
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("already_processed");

    expect(attestDonationCalls).toBe(1);
  });
});
