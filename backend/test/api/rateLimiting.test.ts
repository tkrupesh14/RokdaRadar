import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { freshTestDb } from "../testDb.js";
import { env } from "../../src/config/env.js";

vi.mock("../../src/chain/contractClient.js", () => ({
  getOracleContract: () => ({ attestDonation: async () => ({ wait: async () => ({ hash: "0xtx" }) }) }),
  getOperatorContract: () => ({}),
  getReadContract: () => ({}),
}));

describe("rate limiting on public, chain-writing endpoints", () => {
  beforeEach(async () => {
    await freshTestDb();
  });

  it("429s a caller that exceeds the donate rate limit, and a fresh app instance is unaffected", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    let lastStatus = 0;
    for (let i = 0; i < env.RATE_LIMIT_DONATE_MAX + 1; i++) {
      const res = await request(app).post("/api/campaigns/999/donate").send({ amountPaise: 100 });
      lastStatus = res.status;
      if (i < env.RATE_LIMIT_DONATE_MAX) {
        // No such campaign, but that's a distinct path from the limiter --
        // confirms every one of these requests reached the handler.
        expect(res.status).toBe(404);
      }
    }
    expect(lastStatus).toBe(429);

    // A new app (new limiter instance, as at process boot / in the next
    // test) must not inherit the previous instance's hit count.
    const freshApp = createApp();
    const res = await request(freshApp).post("/api/campaigns/999/donate").send({ amountPaise: 100 });
    expect(res.status).toBe(404);
  });

  it("429s a caller that exceeds the webhook rate limit", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    let lastStatus = 0;
    for (let i = 0; i < env.RATE_LIMIT_WEBHOOK_MAX + 1; i++) {
      const res = await request(app)
        .post("/api/webhooks/upi")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", "not-a-valid-signature")
        .send(Buffer.from("{}"));
      lastStatus = res.status;
      if (i < env.RATE_LIMIT_WEBHOOK_MAX) {
        // Invalid signature, but that's a distinct path from the limiter --
        // confirms every one of these requests reached the handler.
        expect(res.status).toBe(401);
      }
    }
    expect(lastStatus).toBe(429);
  });
});
