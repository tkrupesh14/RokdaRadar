import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { freshTestDb } from "../testDb.js";
import { insertCampaign } from "../../src/db/repositories/campaignsRepo.js";
import { insertDonation } from "../../src/db/repositories/donationsRepo.js";
import { insertSpend } from "../../src/db/repositories/spendsRepo.js";

describe("GET /api/csr/portfolio", () => {
  beforeEach(async () => {
    await freshTestDb();
  });

  it("returns an empty portfolio when there are no campaigns", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    const res = await request(app).get("/api/csr/portfolio");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      campaignCount: 0,
      totalRaisedPaise: 0,
      totalSpentPaise: 0,
      avgTrustScore: 0,
      avgEvidencedSpendPct: 0,
      campaignsWithAnomalies: 0,
      campaigns: [],
    });
  });

  it("aggregates raised/spent across multiple campaigns", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    await insertCampaign({
      id: 1,
      operator: "0xoperatorA",
      disaster_tag: "KL-WAYANAD-2026-07",
      darpan_id: "D1",
      reg_80g: "80G1",
      promise_hash: "0xpromise1",
      created_at: 1000,
      creation_tx_hash: "0xcreate1",
    });
    await insertCampaign({
      id: 2,
      operator: "0xoperatorB",
      disaster_tag: "AS-FLOOD-2026-07",
      darpan_id: "D2",
      reg_80g: "80G2",
      promise_hash: "0xpromise2",
      created_at: 1000,
      creation_tx_hash: "0xcreate2",
    });
    await insertDonation({
      campaign_id: 1,
      utr_hash: "0xutr1",
      donor_ref: "0xdonor1",
      amount_paise: 50000,
      ts: 1100,
      tx_hash: "0xdon1",
    });
    await insertDonation({
      campaign_id: 2,
      utr_hash: "0xutr2",
      donor_ref: "0xdonor2",
      amount_paise: 30000,
      ts: 1100,
      tx_hash: "0xdon2",
    });
    await insertSpend({
      spend_ref: "0xspend1",
      campaign_id: 1,
      utr_hash: "0x0",
      vendor_ref: "vendorA",
      amount_paise: 20000,
      category: "FOOD",
      evidence_cid: "cid1",
      memo: "rice",
      ts: 1200,
      tx_hash: "0xspendtx1",
    });

    const res = await request(app).get("/api/csr/portfolio");
    expect(res.status).toBe(200);
    expect(res.body.campaignCount).toBe(2);
    expect(res.body.totalRaisedPaise).toBe(80000);
    expect(res.body.totalSpentPaise).toBe(20000);
    expect(res.body.campaigns).toHaveLength(2);
    expect(res.body.campaigns.find((c: any) => c.campaignId === 1).raisedPaise).toBe(50000);
    expect(res.body.campaigns.find((c: any) => c.campaignId === 2).raisedPaise).toBe(30000);
    // The only spend in the fixture carries evidence_cid: "cid1", so 100% of
    // spend paise portfolio-wide is evidenced.
    expect(res.body.avgEvidencedSpendPct).toBe(100);
  });
});
