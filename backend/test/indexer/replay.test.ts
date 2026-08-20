import { describe, it, expect, beforeEach } from "vitest";
import { freshTestDb } from "../testDb.js";
import { onCampaignCreated, onDonationAttested, onSpendAttested } from "../../src/indexer/handlers.js";
import { getCampaign } from "../../src/db/repositories/campaignsRepo.js";
import { countDonations, listDonationsByCampaign } from "../../src/db/repositories/donationsRepo.js";
import { countSpends } from "../../src/db/repositories/spendsRepo.js";

describe("indexer replay idempotency", () => {
  beforeEach(async () => {
    await freshTestDb();
  });

  it("does not double-count a donation processed twice (same tx_hash/log_index)", async () => {
    await onCampaignCreated({
      txHash: "0xcreate",
      logIndex: 0,
      id: 1,
      operator: "0xoperator",
      disasterTag: "KL-WAYANAD-2026-07",
      darpanId: "DARPAN1",
      promiseHash: "0xpromise",
      ts: 1000,
    });

    const donationEvent = {
      txHash: "0xdon1",
      logIndex: 0,
      id: 1,
      utrHash: "0xutr1",
      donorRef: "0xdonor1",
      amountPaise: 50000,
      ts: 1100,
    };

    await onDonationAttested(donationEvent);
    await onDonationAttested(donationEvent); // simulate reprocessing the same block on restart

    expect(await countDonations(1)).toBe(1);
    expect((await getCampaign(1))!.raised_paise).toBe(50000);
    expect(await listDonationsByCampaign(1)).toHaveLength(1);
  });

  it("does not double-count a spend processed twice", async () => {
    await onCampaignCreated({
      txHash: "0xcreate",
      logIndex: 0,
      id: 1,
      operator: "0xoperator",
      disasterTag: "KL-WAYANAD-2026-07",
      darpanId: "DARPAN1",
      promiseHash: "0xpromise",
      ts: 1000,
    });

    const spendEvent = {
      txHash: "0xspend1",
      logIndex: 0,
      id: 1,
      spendRef: "0xspendref1",
      utrHash: "0x0",
      vendorRef: "0xvendor1",
      amountPaise: 18400,
      cat: 0,
      evidenceCID: "bafy-cid",
      memo: "rice and lentils",
      ts: 1200,
    };

    await onSpendAttested(spendEvent);
    await onSpendAttested(spendEvent);

    expect(await countSpends(1)).toBe(1);
    expect((await getCampaign(1))!.spent_paise).toBe(18400);
  });

  it("distinguishes events by log_index within the same tx_hash", async () => {
    await onCampaignCreated({
      txHash: "0xcreate",
      logIndex: 0,
      id: 1,
      operator: "0xoperator",
      disasterTag: "KL-WAYANAD-2026-07",
      darpanId: "DARPAN1",
      promiseHash: "0xpromise",
      ts: 1000,
    });

    await onDonationAttested({
      txHash: "0xmultilog",
      logIndex: 0,
      id: 1,
      utrHash: "0xutrA",
      donorRef: "0xdonorA",
      amountPaise: 1000,
      ts: 1100,
    });
    await onDonationAttested({
      txHash: "0xmultilog",
      logIndex: 1,
      id: 1,
      utrHash: "0xutrB",
      donorRef: "0xdonorB",
      amountPaise: 2000,
      ts: 1100,
    });

    expect(await countDonations(1)).toBe(2);
    expect((await getCampaign(1))!.raised_paise).toBe(3000);
  });
});
