import { categorySplit, listSpendsByCampaign } from "../db/repositories/spendsRepo.js";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { vendorTotals } from "../db/repositories/spendsRepo.js";
import {
  ADMIN_RATIO_THRESHOLD_PCT,
  OUT_OF_SCOPE_TERMS,
  VENDOR_CONCENTRATION_THRESHOLD_PCT,
} from "../config/constants.js";
import type { AnomalyCandidate } from "../types/domain.js";

// Three deterministic rules, transcribed exactly from LLD Section 3.5. No ML,
// no AI judgment call — these must stay deterministic forever per the LLD's
// own note on rule 3's successor.

export async function ruleVendorConcentration(campaignId: number): Promise<AnomalyCandidate[]> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.spent_paise === 0) return [];

  const totals = await vendorTotals(campaignId);
  const flags: AnomalyCandidate[] = [];
  for (const v of totals) {
    const sharePct = (v.total / campaign.spent_paise) * 100;
    if (sharePct > VENDOR_CONCENTRATION_THRESHOLD_PCT) {
      const allSpends = await listSpendsByCampaign(campaignId);
      const vendorSpends = allSpends.filter((s) => s.vendor_ref === v.vendor_ref);
      for (const s of vendorSpends) {
        flags.push({ spendRef: s.spend_ref, reason: "vendor_concentration", value: Number(sharePct.toFixed(1)) });
      }
    }
  }
  return flags;
}

export async function ruleAdminRatio(campaignId: number): Promise<AnomalyCandidate[]> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.spent_paise === 0) return [];

  const split = await categorySplit(campaignId);
  const adminPaise = split["ADMIN"] ?? 0;
  const adminPct = (adminPaise / campaign.spent_paise) * 100;
  if (adminPct > ADMIN_RATIO_THRESHOLD_PCT) {
    return [{ spendRef: String(campaignId), reason: "admin_ratio", value: Number(adminPct.toFixed(1)) }];
  }
  return [];
}

export async function ruleCategoryPromiseMismatch(campaignId: number): Promise<AnomalyCandidate[]> {
  const flags: AnomalyCandidate[] = [];
  const spends = await listSpendsByCampaign(campaignId);
  for (const spend of spends) {
    const memo = (spend.memo ?? "").toLowerCase();
    const isOutOfScope = OUT_OF_SCOPE_TERMS.some((term) => memo.includes(term));
    const inFlaggedCategory = spend.category === "SHELTER" || spend.category === "ADMIN";
    if (isOutOfScope && inFlaggedCategory) {
      flags.push({ spendRef: spend.spend_ref, reason: "category_promise_mismatch", value: spend.memo ?? "" });
    }
  }
  return flags;
}

export async function runAnomalyRules(campaignId: number): Promise<AnomalyCandidate[]> {
  return [
    ...(await ruleVendorConcentration(campaignId)),
    ...(await ruleAdminRatio(campaignId)),
    ...(await ruleCategoryPromiseMismatch(campaignId)),
  ];
}
