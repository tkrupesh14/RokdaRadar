import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { ethers } from "ethers";
import request from "supertest";
import { freshTestDb } from "../testDb.js";
import { buildCanonicalMessage } from "../../src/auth/operatorSignature.js";

process.env.EVIDENCE_DIR = path.join(os.tmpdir(), `relieftrace-test-evidence-${process.pid}-${Date.now()}`);

const operatorWallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690");

let attestSpendShouldRevert = false;

vi.mock("../../src/chain/contractClient.js", () => ({
  getOracleContract: () => ({}),
  getOperatorContract: () => ({
    attestSpend: async (...args: unknown[]) => {
      if (attestSpendShouldRevert) {
        const err: any = new Error('execution reverted: "evidence required"');
        err.shortMessage = 'execution reverted: "evidence required"';
        throw err;
      }
      return {
        wait: async () => ({
          hash: "0xspendtx",
          logs: [],
        }),
      };
    },
    interface: { parseLog: () => null },
  }),
  getReadContract: () => ({}),
}));

async function signSpendRequest(campaignId: number) {
  const nonce = "n1";
  const timestamp = Date.now();
  const message = buildCanonicalMessage("POST /api/campaigns/:id/spend", campaignId, nonce, timestamp);
  const signature = await operatorWallet.signMessage(message);
  return { authAddress: operatorWallet.address, authNonce: nonce, authTimestamp: timestamp, authSignature: signature };
}

describe("POST /api/campaigns/:id/spend contract revert mapping", () => {
  beforeEach(async () => {
    freshTestDb();
    attestSpendShouldRevert = false;
    const { insertCampaign } = await import("../../src/db/repositories/campaignsRepo.js");
    insertCampaign({
      id: 1,
      operator: operatorWallet.address,
      disaster_tag: "KL-WAYANAD-2026-07",
      darpan_id: "D1",
      reg_80g: "80G1",
      promise_hash: "0xpromise",
      created_at: 1000,
      creation_tx_hash: "0xcreate",
    });
  });

  it("returns 422 'evidence required' when no evidenceFile is attached", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const auth = await signSpendRequest(1);

    const res = await request(app)
      .post("/api/campaigns/1/spend")
      .field("vendorRef", "vendorA")
      .field("amountPaise", "10000")
      .field("category", "FOOD")
      .field("memo", "rice")
      .field("authAddress", auth.authAddress)
      .field("authNonce", auth.authNonce)
      .field("authTimestamp", String(auth.authTimestamp))
      .field("authSignature", auth.authSignature);

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("evidence required");
  });

  it("returns 422 UNSUPPORTED_MIME_TYPE for a disallowed file type", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const auth = await signSpendRequest(1);

    const res = await request(app)
      .post("/api/campaigns/1/spend")
      .field("vendorRef", "vendorA")
      .field("amountPaise", "10000")
      .field("category", "FOOD")
      .field("memo", "rice")
      .field("authAddress", auth.authAddress)
      .field("authNonce", auth.authNonce)
      .field("authTimestamp", String(auth.authTimestamp))
      .field("authSignature", auth.authSignature)
      .attach("evidenceFile", Buffer.from("not really a zip"), { filename: "evidence.zip", contentType: "application/zip" });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("UNSUPPORTED_MIME_TYPE");
  });

  it("maps a contract revert to a 422 CONTRACT_REVERT response", async () => {
    attestSpendShouldRevert = true;
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const auth = await signSpendRequest(1);

    const res = await request(app)
      .post("/api/campaigns/1/spend")
      .field("vendorRef", "vendorA")
      .field("amountPaise", "10000")
      .field("category", "FOOD")
      .field("memo", "rice")
      .field("authAddress", auth.authAddress)
      .field("authNonce", auth.authNonce)
      .field("authTimestamp", String(auth.authTimestamp))
      .field("authSignature", auth.authSignature)
      .attach("evidenceFile", Buffer.from("%PDF-1.4 fake pdf content"), { filename: "invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CONTRACT_REVERT");
  });

  it("returns 201 with a spendRef/txHash on a successful, correctly-signed, evidenced spend", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const auth = await signSpendRequest(1);

    const res = await request(app)
      .post("/api/campaigns/1/spend")
      .field("vendorRef", "vendorA")
      .field("amountPaise", "10000")
      .field("category", "FOOD")
      .field("memo", "rice")
      .field("authAddress", auth.authAddress)
      .field("authNonce", auth.authNonce)
      .field("authTimestamp", String(auth.authTimestamp))
      .field("authSignature", auth.authSignature)
      .attach("evidenceFile", Buffer.from("%PDF-1.4 fake pdf content"), { filename: "invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.txHash).toBe("0xspendtx");
    expect(res.body.status).toBe("confirmed");
  });
});
