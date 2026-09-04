import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import { freshTestDb } from "../testDb.js";
import { parseBankStatementCsv, importStatementLines, runReconciliation } from "../../src/jobs/reconciliationJob.js";
import { insertCampaign } from "../../src/db/repositories/campaignsRepo.js";
import { insertDonation } from "../../src/db/repositories/donationsRepo.js";
import { insertSpend } from "../../src/db/repositories/spendsRepo.js";

const CAMPAIGN_ID = 1;

function utrHash(utr: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(utr));
}

describe("parseBankStatementCsv", () => {
  it("parses valid rows", () => {
    const csv = "date,type,utr,amountPaise\n2026-08-01,credit,UTR001,50000\n2026-08-02,debit,,18400\n";
    const rows = parseBankStatementCsv(csv);
    expect(rows).toEqual([
      { direction: "credit", utr: "UTR001", amountPaise: 50000, txnDate: "2026-08-01" },
      { direction: "debit", utr: null, amountPaise: 18400, txnDate: "2026-08-02" },
    ]);
  });

  it("throws on a missing required column", () => {
    expect(() => parseBankStatementCsv("date,type,amountPaise\n2026-08-01,credit,50000\n")).toThrow(/columns/);
  });

  it("throws on an invalid type value", () => {
    expect(() => parseBankStatementCsv("date,type,utr,amountPaise\n2026-08-01,transfer,U1,50000\n")).toThrow(/credit.*debit/);
  });

  it("throws on a non-positive amount", () => {
    expect(() => parseBankStatementCsv("date,type,utr,amountPaise\n2026-08-01,credit,U1,0\n")).toThrow(/positive number/);
  });
});

describe("runReconciliation", () => {
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

  it("matches a donation to a credit line by UTR and flags nothing when everything lines up", async () => {
    await insertDonation({
      campaign_id: CAMPAIGN_ID,
      utr_hash: utrHash("UTR001"),
      donor_ref: "0xdonor",
      amount_paise: 50000,
      ts: 1100,
      tx_hash: "0xdonate1",
    });

    await importStatementLines(CAMPAIGN_ID, [{ direction: "credit", utr: "UTR001", amountPaise: 50000, txnDate: "2026-08-01" }]);
    const summary = await runReconciliation(CAMPAIGN_ID);

    expect(summary.matchedDonationCount).toBe(1);
    expect(summary.totalDonationCount).toBe(1);
    expect(summary.flags).toEqual([]);
    expect(summary.reconciliationMatchPct).toBe(100);
  });

  it("flags a donation with no matching bank line as unbacked, and a credit line with no matching donation as unattested inbound", async () => {
    await insertDonation({
      campaign_id: CAMPAIGN_ID,
      utr_hash: utrHash("UTR-REAL"),
      donor_ref: "0xdonor",
      amount_paise: 50000,
      ts: 1100,
      tx_hash: "0xdonate1",
    });
    // A credit line whose UTR doesn't match any donation -- e.g. a stray bank
    // credit that was never attested on-chain.
    await importStatementLines(CAMPAIGN_ID, [{ direction: "credit", utr: "UTR-UNKNOWN", amountPaise: 20000, txnDate: "2026-08-01" }]);

    const summary = await runReconciliation(CAMPAIGN_ID);

    expect(summary.matchedDonationCount).toBe(0);
    expect(summary.flags).toContainEqual(
      expect.objectContaining({ direction: "credit", reason: "unbacked_donation", amountPaise: 50000 })
    );
    expect(summary.flags).toContainEqual(
      expect.objectContaining({ direction: "credit", reason: "unattested_inbound", amountPaise: 20000 })
    );
  });

  it("matches a spend to a debit line by amount (the outbound fraud check LLD 7.2 calls critical)", async () => {
    await insertSpend({
      spend_ref: "0xspend1",
      campaign_id: CAMPAIGN_ID,
      utr_hash: ethers.ZeroHash, // attestSpend always passes ZeroHash today -- see schema.sql's comment
      vendor_ref: "vendorA",
      amount_paise: 18400,
      category: "FOOD",
      evidence_cid: "cid1",
      memo: "rice",
      ts: 1200,
      tx_hash: "0xspendtx1",
    });

    await importStatementLines(CAMPAIGN_ID, [{ direction: "debit", utr: null, amountPaise: 18400, txnDate: "2026-08-03" }]);
    const summary = await runReconciliation(CAMPAIGN_ID);

    expect(summary.matchedSpendCount).toBe(1);
    expect(summary.flags.filter((f) => f.reason === "unbacked_spend" || f.reason === "unattested_outbound")).toEqual([]);
  });

  it("flags a spend that has no matching debit amount in the statement -- the operator-omission case", async () => {
    await insertSpend({
      spend_ref: "0xspend1",
      campaign_id: CAMPAIGN_ID,
      utr_hash: ethers.ZeroHash,
      vendor_ref: "vendorA",
      amount_paise: 18400,
      category: "FOOD",
      evidence_cid: "cid1",
      memo: "rice",
      ts: 1200,
      tx_hash: "0xspendtx1",
    });
    // No statement imported at all -- nothing to reconcile against yet.

    const summary = await runReconciliation(CAMPAIGN_ID);

    expect(summary.flags).toContainEqual(
      expect.objectContaining({ direction: "debit", reason: "unbacked_spend", ref: "0xspend1" })
    );
  });

  it("does not double-match the same spend against two debit lines of the same amount", async () => {
    await insertSpend({
      spend_ref: "0xspend1",
      campaign_id: CAMPAIGN_ID,
      utr_hash: ethers.ZeroHash,
      vendor_ref: "vendorA",
      amount_paise: 10000,
      category: "FOOD",
      evidence_cid: "cid1",
      memo: "",
      ts: 1200,
      tx_hash: "0xspendtx1",
    });

    await importStatementLines(CAMPAIGN_ID, [
      { direction: "debit", utr: null, amountPaise: 10000, txnDate: "2026-08-03" },
      { direction: "debit", utr: null, amountPaise: 10000, txnDate: "2026-08-04" },
    ]);
    const summary = await runReconciliation(CAMPAIGN_ID);

    expect(summary.matchedSpendCount).toBe(1);
    expect(summary.flags.filter((f) => f.reason === "unattested_outbound")).toHaveLength(1);
  });

  it("is idempotent: running twice in a row doesn't change the result", async () => {
    await insertDonation({
      campaign_id: CAMPAIGN_ID,
      utr_hash: utrHash("UTR001"),
      donor_ref: "0xdonor",
      amount_paise: 50000,
      ts: 1100,
      tx_hash: "0xdonate1",
    });
    await importStatementLines(CAMPAIGN_ID, [{ direction: "credit", utr: "UTR001", amountPaise: 50000, txnDate: "2026-08-01" }]);

    const first = await runReconciliation(CAMPAIGN_ID);
    const second = await runReconciliation(CAMPAIGN_ID);

    expect(second).toEqual(first);
  });

  it("reports 0% and no flags when there is nothing to reconcile yet", async () => {
    const summary = await runReconciliation(CAMPAIGN_ID);
    expect(summary.reconciliationMatchPct).toBe(0);
    expect(summary.flags).toEqual([]);
  });
});
