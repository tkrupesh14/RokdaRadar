import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "dotenv/config";
import request from "supertest";

const CAMPAIGN_ID = 1;

vi.mock("../../src/chain/contractClient.js", () => ({
  getOracleContract: () => ({ attestDonation: async () => ({ wait: async () => ({ hash: "0xtx" }) }) }),
  getOperatorContract: () => ({}),
  getReadContract: () => ({}),
}));

async function seedCampaign() {
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
}

// This route's behavior depends on whether RAZORPAY_KEY_ID/SECRET are
// configured, which the ambient backend/.env in this repo actually sets --
// so unlike most tests here, the "not configured" and "configured" cases
// each force their own process.env state via the same reset+dynamic-import
// pattern as test/config/prodSecretsGuard.test.ts, rather than relying on
// whatever happens to already be loaded.
describe("POST /api/campaigns/:id/donate/order", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    vi.resetModules();
    const { freshTestDb } = await import("../testDb.js");
    await freshTestDb();
    await seedCampaign();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("404s for a non-existent campaign", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).post("/api/campaigns/999/donate/order").send({ amountPaise: 50000 });
    expect(res.status).toBe(404);
  });

  it("503s with PSP_NOT_CONFIGURED when Razorpay credentials are unset", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).post(`/api/campaigns/${CAMPAIGN_ID}/donate/order`).send({ amountPaise: 50000 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("PSP_NOT_CONFIGURED");
  });

  it("creates an order and returns orderId/keyId when Razorpay is configured", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secretxyz";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_test123", amount: 50000, currency: "INR", status: "created" }),
    }) as unknown as typeof fetch;

    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).post(`/api/campaigns/${CAMPAIGN_ID}/donate/order`).send({ amountPaise: 50000 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      orderId: "order_test123",
      amountPaise: 50000,
      currency: "INR",
      keyId: "rzp_test_abc",
      campaignId: CAMPAIGN_ID,
    });
  });

  it("503s with PSP_UNAVAILABLE when the Razorpay API call fails", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secretxyz";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: "amount must be at least 100" } }),
    }) as unknown as typeof fetch;

    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const res = await request(app).post(`/api/campaigns/${CAMPAIGN_ID}/donate/order`).send({ amountPaise: 1 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("PSP_UNAVAILABLE");
    expect(res.body.detail).toMatch(/amount must be at least 100/);
  });
});
