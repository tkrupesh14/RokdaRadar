import { getCampaign } from "../db/repositories/campaignsRepo.js";
import {
  categorySplit,
  countDeliveryAttestedSpends,
  countSpends,
  listSpendsByCampaign,
  vendorTotals,
} from "../db/repositories/spendsRepo.js";
import { countDonations, firstDonationTs, medianDonationPaise } from "../db/repositories/donationsRepo.js";
import { CATEGORIES, type CategoryName } from "../config/constants.js";
import { runAnomalyRules } from "./anomalyRules.js";
import type { CampaignAggregate, VendorConcentrationEntry } from "../types/domain.js";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Pure, deterministic: no AI involvement anywhere in this file (HLD principle
// #3, LLD 3.4). Computed on read from SQLite rather than materialized, which
// is cheap enough at the <=200-event NFT target and avoids a second source of
// truth to keep in sync with the indexer's write path.
export function computeAggregate(campaignId: number): CampaignAggregate | null {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;

  const raisedPaise = campaign.raised_paise;
  const spentPaise = campaign.spent_paise;
  const unspentPaise = raisedPaise - spentPaise;

  const donationCount = countDonations(campaignId);
  const spendCount = countSpends(campaignId);

  const rawSplit = categorySplit(campaignId);
  const categorySplitFull: Record<CategoryName, number> = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = rawSplit[cat] ?? 0;
    return acc;
  }, {} as Record<CategoryName, number>);

  const adminPaise = categorySplitFull.ADMIN;
  const fieldVsAdminRatio = spentPaise > 0 ? Number(((spentPaise - adminPaise) / spentPaise).toFixed(3)) : 0;

  const vendors = vendorTotals(campaignId);
  const vendorConcentration: VendorConcentrationEntry[] = vendors.map((v) => ({
    vendorRef: v.vendor_ref,
    sharePct: spentPaise > 0 ? Number(((v.total / spentPaise) * 100).toFixed(1)) : 0,
    spendCount: v.count,
  }));

  const medDonation = medianDonationPaise(campaignId);

  // LLD 3.4's own "simplified in MVP0" reading: campaign-level median of
  // (spend.ts - firstDonationTs) across all spends, in hours.
  const firstTs = firstDonationTs(campaignId);
  const spends = listSpendsByCampaign(campaignId);
  const latenciesHours =
    firstTs !== null
      ? spends.map((s) => Math.max(0, (s.ts - firstTs) / 3600))
      : [];
  const medianDisbursementLatencyHours = Number(median(latenciesHours).toFixed(1));

  const deliveryAttestedPct =
    spendCount > 0 ? Number(((countDeliveryAttestedSpends(campaignId) / spendCount) * 100).toFixed(1)) : 0;

  const anomalyCandidates = runAnomalyRules(campaignId);

  // txIndex resolves every ref a report/guardrail might cite: each spendRef to
  // its own tx hash, plus the campaign's creation tx keyed by campaignId (LLD's
  // example shows one entry; this completes it so campaign-level claims, e.g.
  // promiseConsistency, also resolve per the guardrail's ref-check in 5.3).
  const txIndex: Record<string, string> = {};
  for (const s of spends) txIndex[s.spend_ref] = s.tx_hash;
  if (campaign.creation_tx_hash) txIndex[String(campaignId)] = campaign.creation_tx_hash;

  return {
    campaignId,
    disasterTag: campaign.disaster_tag,
    raisedPaise,
    spentPaise,
    unspentPaise,
    donationCount,
    spendCount,
    categorySplit: categorySplitFull,
    fieldVsAdminRatio,
    vendorConcentration,
    medianDonationPaise: medDonation,
    medianDisbursementLatencyHours,
    deliveryAttestedPct,
    anomalyCandidates,
    txIndex,
  };
}
