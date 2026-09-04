import { describe, it, expect, beforeEach } from "vitest";
import { freshTestDb } from "../testDb.js";
import { insertCampaign } from "../../src/db/repositories/campaignsRepo.js";
import { insertDonation } from "../../src/db/repositories/donationsRepo.js";
import { insertSpend } from "../../src/db/repositories/spendsRepo.js";
import { buildCsrReportData } from "../../src/csr/reportData.js";

const CAMPAIGN_ID = 1;
// 2026-01-15 and 2026-06-15, in unix seconds.
const JAN_TS = Math.floor(new Date("2026-01-15T00:00:00Z").getTime() / 1000);
const JUN_TS = Math.floor(new Date("2026-06-15T00:00:00Z").getTime() / 1000);

describe("buildCsrReportData", () => {
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
    await insertDonation({
      campaign_id: CAMPAIGN_ID,
      utr_hash: "0xutrjan",
      donor_ref: "0xdonor1",
      amount_paise: 10000,
      ts: JAN_TS,
      tx_hash: "0xdonjan",
    });
    await insertDonation({
      campaign_id: CAMPAIGN_ID,
      utr_hash: "0xutrjun",
      donor_ref: "0xdonor2",
      amount_paise: 20000,
      ts: JUN_TS,
      tx_hash: "0xdonjun",
    });
    await insertSpend({
      spend_ref: "0xspendjan",
      campaign_id: CAMPAIGN_ID,
      utr_hash: "0x0",
      vendor_ref: "vendorA",
      amount_paise: 5000,
      category: "FOOD",
      evidence_cid: "cidjan",
      memo: "",
      ts: JAN_TS,
      tx_hash: "0xspendtxjan",
    });
  });

  it("includes everything when no date range is given", async () => {
    const data = await buildCsrReportData(null, null);
    const campaign = data.campaigns.find((c) => c.campaignId === CAMPAIGN_ID)!;
    expect(campaign.donations).toHaveLength(2);
    expect(campaign.spends).toHaveLength(1);
    expect(data.totalRaisedPaise).toBe(30000);
  });

  it("filters to only the January transactions with from/to scoped to January", async () => {
    const data = await buildCsrReportData("2026-01-01", "2026-01-31");
    const campaign = data.campaigns.find((c) => c.campaignId === CAMPAIGN_ID)!;
    expect(campaign.donations).toHaveLength(1);
    expect(campaign.donations[0].txHash).toBe("0xdonjan");
    expect(campaign.spends).toHaveLength(1);
    expect(data.totalRaisedPaise).toBe(10000);
    expect(data.totalSpentPaise).toBe(5000);
  });

  it("returns nothing for a range with no transactions in it", async () => {
    const data = await buildCsrReportData("2027-01-01", "2027-01-31");
    const campaign = data.campaigns.find((c) => c.campaignId === CAMPAIGN_ID)!;
    expect(campaign.donations).toHaveLength(0);
    expect(campaign.spends).toHaveLength(0);
    expect(data.totalRaisedPaise).toBe(0);
  });

  it("supports an open-ended range (from only)", async () => {
    const data = await buildCsrReportData("2026-03-01", null);
    const campaign = data.campaigns.find((c) => c.campaignId === CAMPAIGN_ID)!;
    expect(campaign.donations).toHaveLength(1);
    expect(campaign.donations[0].txHash).toBe("0xdonjun");
  });
});
