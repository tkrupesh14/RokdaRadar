import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { freshTestDb } from "../testDb.js";

vi.mock("../../src/chain/contractClient.js", () => ({
  getOracleContract: () => ({ attestDonation: async () => ({ wait: async () => ({ hash: "0xtx" }) }) }),
  getOperatorContract: () => ({
    createCampaign: async () => ({ wait: async () => ({ hash: "0xtx" }) }),
    attestSpend: async () => ({ wait: async () => ({ hash: "0xtx", logs: [] }) }),
    attestDelivery: async () => ({ wait: async () => ({ hash: "0xtx" }) }),
    interface: { parseLog: () => null },
  }),
  getReadContract: () => ({}),
}));

describe("auth rejection on every protected route", () => {
  beforeEach(async () => {
    await freshTestDb();
    const { insertCampaign } = await import("../../src/db/repositories/campaignsRepo.js");
    await insertCampaign({
      id: 1,
      operator: "0x1111111111111111111111111111111111111111",
      disaster_tag: "KL-WAYANAD-2026-07",
      darpan_id: "D1",
      reg_80g: "80G1",
      promise_hash: "0xpromise",
      created_at: 1000,
      creation_tx_hash: "0xcreate",
    });
    const { insertSpend } = await import("../../src/db/repositories/spendsRepo.js");
    await insertSpend({
      spend_ref: "0xspend1",
      campaign_id: 1,
      utr_hash: "0x0",
      vendor_ref: "vendorA",
      amount_paise: 10000,
      category: "FOOD",
      evidence_cid: "cid",
      memo: "rice",
      ts: 1100,
      tx_hash: "0xspend1",
    });
  });

  it("rejects POST /api/campaigns with no auth block", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).post("/api/campaigns").send({
      oracleAddress: "0x2222222222222222222222222222222222222222",
      disasterTag: "KL-TEST",
      darpanId: "D2",
      reg80G: "80G2",
      promiseText: "help",
    });
    expect(res.status).toBe(400); // zod rejects missing required `auth` field
  });

  it("rejects POST /api/campaigns with an invalid signature", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app)
      .post("/api/campaigns")
      .send({
        oracleAddress: "0x2222222222222222222222222222222222222222",
        disasterTag: "KL-TEST",
        darpanId: "D2",
        reg80G: "80G2",
        promiseText: "help",
        auth: { address: "0x1111111111111111111111111111111111111111", nonce: "n1", timestamp: Date.now(), signature: "0xnotasignature" },
      });
    expect(res.status).toBe(401);
  });

  it("rejects POST /api/campaigns/:id/spend with a missing signature", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app)
      .post("/api/campaigns/1/spend")
      .field("vendorRef", "vendorA")
      .field("amountPaise", "10000")
      .field("category", "FOOD")
      .field("memo", "rice")
      .field("authAddress", "0x1111111111111111111111111111111111111111")
      .field("authNonce", "n1")
      .field("authTimestamp", String(Date.now()))
      .field("authSignature", "0xnotasignature");
    expect(res.status).toBe(401);
  });

  it("rejects POST /api/campaigns/:id/spend/:spendRef/deliver with an invalid signature", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app)
      .post("/api/campaigns/1/spend/0xspend1/deliver")
      .send({
        authAddress: "0x3333333333333333333333333333333333333333",
        authNonce: "n1",
        authTimestamp: Date.now(),
        authSignature: "0xnotasignature",
      });
    expect(res.status).toBe(401);
  });

  it("rejects POST /api/webhooks/upi with no signature header", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app)
      .post("/api/webhooks/upi")
      .set("Content-Type", "application/json")
      .send(Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: {} } })));
    expect(res.status).toBe(401);
  });
});
