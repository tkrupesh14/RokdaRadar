import { describe, it, expect, beforeEach } from "vitest";
import { freshTestDb } from "../testDb.js";
import { onCampaignCreated, onDonationAttested, onSpendAttested, onDeliveryAttested } from "../../src/indexer/handlers.js";
import { computeAggregate } from "../../src/indexer/aggregate.js";

describe("aggregate correctness against a hand-computed fixture", () => {
  beforeEach(async () => {
    await freshTestDb();

    await onCampaignCreated({
      txHash: "0xcreate",
      logIndex: 0,
      id: 1,
      operator: "0xoperator",
      disasterTag: "KL-WAYANAD-2026-07",
      darpanId: "DARPAN1",
      promiseHash: "0xpromise",
      ts: 1_000_000,
    });

    // Donations: 10000, 20000, 30000 paise -> median 20000
    const donations: [string, string, number][] = [
      ["0xutr1", "0xdonor1", 10000],
      ["0xutr2", "0xdonor2", 20000],
      ["0xutr3", "0xdonor3", 30000],
    ];
    for (let i = 0; i < donations.length; i++) {
      const [utrHash, donorRef, amountPaise] = donations[i];
      await onDonationAttested({
        txHash: `0xdon${i}`,
        logIndex: 0,
        id: 1,
        utrHash,
        donorRef,
        amountPaise,
        ts: 1_000_000 + i,
      });
    }
    // raisedPaise = 60000

    // Spends: FOOD 30000 (vendorA), ADMIN 10000 (vendorB), SHELTER 10000 (vendorA)
    // spentPaise = 50000; vendorA total = 40000 -> sharePct 80% (>35, flags vendor_concentration)
    // adminPct = 10000/50000*100 = 20% (>15, flags admin_ratio)
    await onSpendAttested({
      txHash: "0xspendA",
      logIndex: 0,
      id: 1,
      spendRef: "0xspendA",
      utrHash: "0x0",
      vendorRef: "vendorA",
      amountPaise: 30000,
      cat: 0, // FOOD
      evidenceCID: "cid-a",
      memo: "rice",
      ts: 1_000_000 + 3600, // 1 hour after first donation
    });
    await onSpendAttested({
      txHash: "0xspendB",
      logIndex: 0,
      id: 1,
      spendRef: "0xspendB",
      utrHash: "0x0",
      vendorRef: "vendorB",
      amountPaise: 10000,
      cat: 5, // ADMIN
      evidenceCID: "cid-b",
      memo: "printing",
      ts: 1_000_000 + 7200, // 2 hours after first donation
    });
    await onSpendAttested({
      txHash: "0xspendC",
      logIndex: 0,
      id: 1,
      spendRef: "0xspendC",
      utrHash: "0x0",
      vendorRef: "vendorA",
      amountPaise: 10000,
      cat: 3, // SHELTER
      evidenceCID: "cid-c",
      memo: "tarpaulin",
      ts: 1_000_000 + 10800, // 3 hours after first donation
    });

    await onDeliveryAttested({ txHash: "0xdeliverA", logIndex: 0, id: 1, spendRef: "0xspendA", attestor: "0xattestor", ts: 1_000_000 + 14400 });
  });

  it("computes raised/spent/unspent correctly", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.raisedPaise).toBe(60000);
    expect(agg.spentPaise).toBe(50000);
    expect(agg.unspentPaise).toBe(10000);
  });

  it("computes donation/spend counts", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.donationCount).toBe(3);
    expect(agg.spendCount).toBe(3);
  });

  it("computes categorySplit for all six categories, zero-filled", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.categorySplit).toEqual({
      FOOD: 30000,
      WATER: 0,
      MEDICAL: 0,
      SHELTER: 10000,
      LOGISTICS: 0,
      ADMIN: 10000,
    });
  });

  it("computes fieldVsAdminRatio = (spent - admin) / spent", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.fieldVsAdminRatio).toBeCloseTo((50000 - 10000) / 50000, 3);
  });

  it("computes vendorConcentration sharePct and flags vendor_concentration for vendorA", async () => {
    const agg = (await computeAggregate(1))!;
    const vendorA = agg.vendorConcentration.find((v) => v.vendorRef === "vendorA")!;
    expect(vendorA.sharePct).toBeCloseTo(80, 1);
    expect(vendorA.spendCount).toBe(2);
    expect(agg.anomalyCandidates.some((a) => a.reason === "vendor_concentration")).toBe(true);
  });

  it("flags admin_ratio when admin share exceeds 15%", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.anomalyCandidates.some((a) => a.reason === "admin_ratio")).toBe(true);
  });

  it("computes medianDonationPaise", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.medianDonationPaise).toBe(20000);
  });

  it("computes deliveryAttestedPct = attested / total spends * 100", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.deliveryAttestedPct).toBeCloseTo(100 / 3, 1);
  });

  it("computes evidencedSpendPct = 100 when every fixture spend has an evidence CID", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.evidencedSpendPct).toBe(100);
  });

  it("computes reconciliationMatchPct = 0 when no bank statement has been imported for this campaign", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.reconciliationMatchPct).toBe(0);
  });

  it("computes trustScore from the 3 real terms, reweighted 30:25:20 -> 30/75:25/75:20/75", async () => {
    const agg = (await computeAggregate(1))!;
    // evidencedSpendPct=100, deliveryAttestedPct=33.3, reconciliationMatchPct=0 (no statement imported)
    // -> 0.4*100 + (25/75)*33.3 + (20/75)*0 = 40 + 11.1 = 51.1 -> rounds to 51
    expect(agg.trustScore).toBe(51);
    expect(agg.trustScoreBreakdown.pending).toEqual(["promiseAlignmentScore", "attestorDiversityScore"]);
  });

  it("builds txIndex keyed by spendRef and by campaignId for the creation tx", async () => {
    const agg = (await computeAggregate(1))!;
    expect(agg.txIndex["0xspendA"]).toBe("0xspendA");
    expect(agg.txIndex["1"]).toBe("0xcreate");
  });

  it("returns null for a non-existent campaign", async () => {
    expect(await computeAggregate(999)).toBeNull();
  });
});
