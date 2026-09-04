import { listCampaigns } from "../db/repositories/campaignsRepo.js";
import { listDonationsByCampaign } from "../db/repositories/donationsRepo.js";
import { listSpendsByCampaign } from "../db/repositories/spendsRepo.js";
import { env } from "../config/env.js";

export type CsrReportDonation = { utrHash: string; amountPaise: number; ts: number; txHash: string };
export type CsrReportSpend = {
  spendRef: string;
  vendorRef: string;
  category: string;
  amountPaise: number;
  ts: number;
  txHash: string;
  evidenceCid: string;
};

export type CsrReportCampaign = {
  campaignId: number;
  disasterTag: string;
  darpanId: string | null;
  reg80G: string | null;
  raisedPaise: number;
  spentPaise: number;
  donations: CsrReportDonation[];
  spends: CsrReportSpend[];
};

export type CsrReportData = {
  generatedAt: string;
  fromDate: string | null;
  toDate: string | null;
  campaignCount: number;
  totalRaisedPaise: number;
  totalSpentPaise: number;
  campaigns: CsrReportCampaign[];
};

// LLD Section 9: "an auditor should be able to reproduce every figure in
// the document from the appendix alone" -- so this scopes every number in
// the report (portfolio totals included) to the same donations/spends
// listed in the appendix, not the campaign's separate all-time
// raised/spent totals. A report with a date range that shows a total not
// backed by any listed transaction would fail that requirement.
export async function buildCsrReportData(fromDate: string | null, toDate: string | null): Promise<CsrReportData> {
  const fromTs = fromDate ? Math.floor(new Date(`${fromDate}T00:00:00Z`).getTime() / 1000) : null;
  const toTs = toDate ? Math.floor(new Date(`${toDate}T23:59:59Z`).getTime() / 1000) : null;
  const inRange = (ts: number) => (fromTs === null || ts >= fromTs) && (toTs === null || ts <= toTs);

  const campaignRows = await listCampaigns();
  const campaigns: CsrReportCampaign[] = await Promise.all(
    campaignRows.map(async (c) => {
      const [donationRows, spendRows] = await Promise.all([listDonationsByCampaign(c.id), listSpendsByCampaign(c.id)]);
      const donations = donationRows
        .filter((d) => inRange(d.ts))
        .map((d) => ({ utrHash: d.utr_hash, amountPaise: d.amount_paise, ts: d.ts, txHash: d.tx_hash }));
      const spends = spendRows
        .filter((s) => inRange(s.ts))
        .map((s) => ({
          spendRef: s.spend_ref,
          vendorRef: s.vendor_ref,
          category: s.category,
          amountPaise: s.amount_paise,
          ts: s.ts,
          txHash: s.tx_hash,
          evidenceCid: s.evidence_cid,
        }));
      return {
        campaignId: c.id,
        disasterTag: c.disaster_tag,
        darpanId: c.darpan_id,
        reg80G: c.reg_80g,
        raisedPaise: donations.reduce((sum, d) => sum + d.amountPaise, 0),
        spentPaise: spends.reduce((sum, s) => sum + s.amountPaise, 0),
        donations,
        spends,
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    fromDate,
    toDate,
    campaignCount: campaigns.length,
    totalRaisedPaise: campaigns.reduce((sum, c) => sum + c.raisedPaise, 0),
    totalSpentPaise: campaigns.reduce((sum, c) => sum + c.spentPaise, 0),
    campaigns,
  };
}

export function explorerTxUrl(txHash: string): string {
  return `${env.MONAD_EXPLORER_TX_BASE_URL}/${txHash}`;
}
