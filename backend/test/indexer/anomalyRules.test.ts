import { describe, it, expect, beforeEach } from "vitest";
import { freshTestDb } from "../testDb.js";
import { onCampaignCreated, onSpendAttested } from "../../src/indexer/handlers.js";
import { runAnomalyRules } from "../../src/indexer/anomalyRules.js";

async function createCampaign(id: number) {
  await onCampaignCreated({
    txHash: `0xcreate${id}`,
    logIndex: 0,
    id,
    operator: "0xoperator",
    disasterTag: "TEST",
    darpanId: "D1",
    promiseHash: "0xpromise",
    ts: 1000,
  });
}

describe("deterministic anomaly rules (LLD 3.5)", () => {
  beforeEach(async () => {
    await freshTestDb();
  });

  it("flags category_promise_mismatch for SHELTER spend with 'office repair' in memo", async () => {
    await createCampaign(1);
    await onSpendAttested({
      txHash: "0xs1",
      logIndex: 0,
      id: 1,
      spendRef: "0xs1",
      utrHash: "0x0",
      vendorRef: "v1",
      amountPaise: 10000,
      cat: 3, // SHELTER
      evidenceCID: "cid",
      memo: "Repair of block office roof and boundary wall",
      ts: 1100,
    });

    const flags = await runAnomalyRules(1);
    expect(flags.some((f) => f.reason === "category_promise_mismatch" && f.spendRef === "0xs1")).toBe(true);
  });

  it("does not flag category_promise_mismatch for FOOD spend even with an out-of-scope term", async () => {
    await createCampaign(1);
    await onSpendAttested({
      txHash: "0xs1",
      logIndex: 0,
      id: 1,
      spendRef: "0xs1",
      utrHash: "0x0",
      vendorRef: "v1",
      amountPaise: 10000,
      cat: 0, // FOOD
      evidenceCID: "cid",
      memo: "office snacks for volunteers",
      ts: 1100,
    });

    const flags = await runAnomalyRules(1);
    expect(flags.some((f) => f.reason === "category_promise_mismatch")).toBe(false);
  });

  it("does not flag vendor_concentration when no vendor exceeds 35% share", async () => {
    await createCampaign(1);
    for (let i = 0; i < 4; i++) {
      await onSpendAttested({
        txHash: `0xs${i}`,
        logIndex: 0,
        id: 1,
        spendRef: `0xs${i}`,
        utrHash: "0x0",
        vendorRef: `v${i}`,
        amountPaise: 10000,
        cat: 0,
        evidenceCID: "cid",
        memo: "supplies",
        ts: 1100 + i,
      });
    }
    const flags = await runAnomalyRules(1);
    expect(flags.some((f) => f.reason === "vendor_concentration")).toBe(false);
  });

  it("does not flag admin_ratio when admin share is at or below 15%", async () => {
    await createCampaign(1);
    await onSpendAttested({
      txHash: "0xs1",
      logIndex: 0,
      id: 1,
      spendRef: "0xs1",
      utrHash: "0x0",
      vendorRef: "v1",
      amountPaise: 8500,
      cat: 0, // FOOD
      evidenceCID: "cid",
      memo: "food",
      ts: 1100,
    });
    await onSpendAttested({
      txHash: "0xs2",
      logIndex: 0,
      id: 1,
      spendRef: "0xs2",
      utrHash: "0x0",
      vendorRef: "v2",
      amountPaise: 1500,
      cat: 5, // ADMIN, exactly 15%
      evidenceCID: "cid",
      memo: "admin",
      ts: 1101,
    });
    const flags = await runAnomalyRules(1);
    expect(flags.some((f) => f.reason === "admin_ratio")).toBe(false);
  });

  it("returns no flags for a campaign with no spends", async () => {
    await createCampaign(1);
    expect(await runAnomalyRules(1)).toEqual([]);
  });
});
