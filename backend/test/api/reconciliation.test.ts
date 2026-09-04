import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import request from "supertest";
import { freshTestDb } from "../testDb.js";
import { buildCanonicalMessage } from "../../src/auth/operatorSignature.js";
import { insertCampaign } from "../../src/db/repositories/campaignsRepo.js";
import { insertDonation } from "../../src/db/repositories/donationsRepo.js";

const managerWallet = ethers.Wallet.createRandom();
const CAMPAIGN_ID = 1;

async function signImportRequest() {
  const nonce = "n1";
  const timestamp = Date.now();
  const message = buildCanonicalMessage("POST /api/campaigns/:id/reconciliation/import", CAMPAIGN_ID, nonce, timestamp);
  const signature = await managerWallet.signMessage(message);
  return { authAddress: managerWallet.address, authNonce: nonce, authTimestamp: timestamp, authSignature: signature };
}

describe("POST /api/campaigns/:id/reconciliation/import", () => {
  beforeEach(async () => {
    await freshTestDb();
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

  it("rejects an invalid manager signature with 401", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    const res = await request(app)
      .post(`/api/campaigns/${CAMPAIGN_ID}/reconciliation/import`)
      .field("authAddress", "0x1111111111111111111111111111111111111111")
      .field("authNonce", "n1")
      .field("authTimestamp", String(Date.now()))
      .field("authSignature", "0xnotasignature")
      .attach("statement", Buffer.from("date,type,utr,amountPaise\n2026-08-01,credit,U1,50000\n"), {
        filename: "statement.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(401);
  });

  it("imports a valid CSV and returns the reconciliation summary", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    await insertDonation({
      campaign_id: CAMPAIGN_ID,
      utr_hash: ethers.keccak256(ethers.toUtf8Bytes("UTR001")),
      donor_ref: "0xdonor",
      amount_paise: 50000,
      ts: 1100,
      tx_hash: "0xdonate1",
    });

    const auth = await signImportRequest();
    const res = await request(app)
      .post(`/api/campaigns/${CAMPAIGN_ID}/reconciliation/import`)
      .field("authAddress", auth.authAddress)
      .field("authNonce", auth.authNonce)
      .field("authTimestamp", String(auth.authTimestamp))
      .field("authSignature", auth.authSignature)
      .attach("statement", Buffer.from("date,type,utr,amountPaise\n2026-08-01,credit,UTR001,50000\n"), {
        filename: "statement.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(200);
    expect(res.body.matchedDonationCount).toBe(1);
    expect(res.body.reconciliationMatchPct).toBe(100);
    expect(res.body.flags).toEqual([]);
  });

  it("returns 400 for a malformed CSV", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    const auth = await signImportRequest();
    const res = await request(app)
      .post(`/api/campaigns/${CAMPAIGN_ID}/reconciliation/import`)
      .field("authAddress", auth.authAddress)
      .field("authNonce", auth.authNonce)
      .field("authTimestamp", String(auth.authTimestamp))
      .field("authSignature", auth.authSignature)
      .attach("statement", Buffer.from("not,a,valid,statement\n"), { filename: "statement.csv", contentType: "text/csv" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a non-existent campaign", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    const res = await request(app)
      .post(`/api/campaigns/999/reconciliation/import`)
      .field("authAddress", "0x1111111111111111111111111111111111111111")
      .field("authNonce", "n1")
      .field("authTimestamp", String(Date.now()))
      .field("authSignature", "0xnotasignature")
      .attach("statement", Buffer.from("date,type,utr,amountPaise\n2026-08-01,credit,U1,50000\n"), {
        filename: "statement.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/campaigns/:id/reconciliation", () => {
  beforeEach(async () => {
    await freshTestDb();
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

  it("returns a summary with 0% and no flags for a campaign with nothing to reconcile", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    const res = await request(app).get(`/api/campaigns/${CAMPAIGN_ID}/reconciliation`);
    expect(res.status).toBe(200);
    expect(res.body.reconciliationMatchPct).toBe(0);
    expect(res.body.flags).toEqual([]);
  });

  it("returns 404 for a non-existent campaign", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();

    const res = await request(app).get(`/api/campaigns/999/reconciliation`);
    expect(res.status).toBe(404);
  });
});
