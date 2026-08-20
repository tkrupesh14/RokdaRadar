import { describe, it, expect, beforeEach, vi } from "vitest";
import { ethers } from "ethers";
import request from "supertest";
import { freshTestDb } from "../testDb.js";
import { buildCanonicalMessage } from "../../src/auth/operatorSignature.js";

// EVIDENCE_DIR is redirected to a tmp dir via vitest.config.ts's test.env
// (not here -- see that file's comment for why a per-file override can't
// win the race against config/env.ts's own module-load-time zod parse).

const operatorWallet = ethers.Wallet.createRandom();
const managerWallet = ethers.Wallet.createRandom();

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

// The real classifier calls Gemini over the network -- mocked here so the
// AI-gate branch is deterministic and doesn't depend on a live API key.
// isBillNext lets individual tests flip the verdict for the "AI rejects
// junk evidence" case.
let isBillNext = true;
vi.mock("../../src/ai/evidenceClassifier.js", () => ({
  classifyEvidence: async () => ({ isBill: isBillNext, reason: isBillNext ? "Looks like a printed invoice." : "This looks like a random photo, not a receipt." }),
}));

async function signRequest(route: string, campaignId: number, wallet: ethers.Wallet) {
  const nonce = "n1";
  const timestamp = Date.now();
  const message = buildCanonicalMessage(route, campaignId, nonce, timestamp);
  const signature = await wallet.signMessage(message);
  return { authAddress: wallet.address, authNonce: nonce, authTimestamp: timestamp, authSignature: signature };
}

const signSpendRequest = (campaignId: number) => signRequest("POST /api/campaigns/:id/spend", campaignId, operatorWallet);
const signApproveRequest = (campaignId: number) => signRequest("POST /api/pending-spends/:id/approve", campaignId, managerWallet);
const signRejectRequest = (campaignId: number) => signRequest("POST /api/pending-spends/:id/reject", campaignId, managerWallet);

async function submitSpend(app: import("express").Express, auth: Awaited<ReturnType<typeof signSpendRequest>>) {
  return request(app)
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
}

describe("POST /api/campaigns/:id/spend -> AI evidence gate -> manager review", () => {
  beforeEach(async () => {
    await freshTestDb();
    attestSpendShouldRevert = false;
    isBillNext = true;
    const { insertCampaign } = await import("../../src/db/repositories/campaignsRepo.js");
    await insertCampaign({
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

  it("rejects evidence the AI screen doesn't recognize as a bill/receipt, with no chain write, but keeps it as a fraud-audit record", async () => {
    isBillNext = false;
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const auth = await signSpendRequest(1);

    const res = await submitSpend(app, auth);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("AI_EVIDENCE_REJECTED");

    const { listPendingSpends, listSpendsByStatus } = await import("../../src/db/repositories/pendingSpendsRepo.js");
    // Never enters the manager review queue...
    expect(await listPendingSpends(1)).toHaveLength(0);
    // ...but the submission itself, including its evidence, is retained.
    const rejected = await listSpendsByStatus(1, ["ai_rejected"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].operator_address).toBe(auth.authAddress);
    expect(rejected[0].evidence_cid).toBeTruthy();
    expect(rejected[0].ai_reason).toBe("This looks like a random photo, not a receipt.");
  });

  it("queues a spend as pending review (not attested) when the AI screen accepts the evidence", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const auth = await signSpendRequest(1);

    const res = await submitSpend(app, auth);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending_review");
    expect(res.body.pendingSpendId).toBeTypeOf("number");

    const { listPendingSpends } = await import("../../src/db/repositories/pendingSpendsRepo.js");
    const pending = await listPendingSpends(1);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe("pending");
  });

  it("approve: maps a contract revert to a 422 CONTRACT_REVERT response", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const spendAuth = await signSpendRequest(1);
    const submitRes = await submitSpend(app, spendAuth);
    const pendingSpendId = submitRes.body.pendingSpendId;

    attestSpendShouldRevert = true;
    const approveAuth = await signApproveRequest(1);
    const res = await request(app).post(`/api/pending-spends/${pendingSpendId}/approve`).send(approveAuth);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CONTRACT_REVERT");
  });

  it("approve: writes on-chain and returns a spendRef/txHash on a successful, correctly-signed review", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const spendAuth = await signSpendRequest(1);
    const submitRes = await submitSpend(app, spendAuth);
    const pendingSpendId = submitRes.body.pendingSpendId;

    const approveAuth = await signApproveRequest(1);
    const res = await request(app).post(`/api/pending-spends/${pendingSpendId}/approve`).send(approveAuth);

    expect(res.status).toBe(200);
    expect(res.body.txHash).toBe("0xspendtx");
    expect(res.body.status).toBe("approved");

    const { getPendingSpend } = await import("../../src/db/repositories/pendingSpendsRepo.js");
    const pending = await getPendingSpend(pendingSpendId);
    expect(pending?.status).toBe("approved");
    expect(pending?.tx_hash).toBe("0xspendtx");
  });

  it("reject: marks the pending spend rejected with no chain write", async () => {
    const { createApp } = await import("../../src/app.js");
    const app = createApp();
    const spendAuth = await signSpendRequest(1);
    const submitRes = await submitSpend(app, spendAuth);
    const pendingSpendId = submitRes.body.pendingSpendId;

    const rejectAuth = await signRejectRequest(1);
    const res = await request(app)
      .post(`/api/pending-spends/${pendingSpendId}/reject`)
      .send({ ...rejectAuth, note: "Illegible receipt" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");

    const { getPendingSpend } = await import("../../src/db/repositories/pendingSpendsRepo.js");
    const pending = await getPendingSpend(pendingSpendId);
    expect(pending?.status).toBe("rejected");
    expect(pending?.review_note).toBe("Illegible receipt");
  });
});
