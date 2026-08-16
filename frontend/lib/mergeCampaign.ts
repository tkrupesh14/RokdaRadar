import { getAggregate, getFeed, getReport, type ApiReport } from "./api";
import type { CampaignDetail, LedgerRow } from "./campaigns";
import { paiseToRupees } from "./format";

const CAT_COLORS = [
  "var(--color-accent-500)",
  "var(--color-accent-2-500)",
  "var(--color-accent-300)",
  "var(--color-accent-2-300)",
  "var(--color-accent-700)",
  "var(--color-neutral-400)",
];
// Matches the backend's Category enum order (LLD Section 2.1) and the
// display names already used throughout the frontend mock data.
const CATEGORY_DISPLAY_ORDER: { key: "FOOD" | "WATER" | "MEDICAL" | "SHELTER" | "LOGISTICS" | "ADMIN"; name: string }[] = [
  { key: "FOOD", name: "Food" },
  { key: "WATER", name: "Water" },
  { key: "MEDICAL", name: "Medical" },
  { key: "SHELTER", name: "Shelter" },
  { key: "LOGISTICS", name: "Logistics" },
  { key: "ADMIN", name: "Admin" },
];

function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
}

function fmtDate(tsSeconds: number): string {
  return new Date(tsSeconds * 1000).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/**
 * Overlays real backend data (aggregate, feed, AI report) onto a static mock
 * campaign, for any mock entry with a `backendId`. Every field the backend
 * doesn't model at all -- org, story, updates, mapLabel, donor names,
 * trustScore (trustScore is a published MVP2 formula, LLD Section 8, not yet
 * implemented) -- is left as static content. Falls back to the untouched
 * mock silently if the backend is unreachable or the campaign doesn't exist
 * there yet (expected until a real on-chain campaign is created).
 */
export async function overlayBackendData(
  base: CampaignDetail
): Promise<{ campaign: CampaignDetail; report: ApiReport | null }> {
  // Explicit undefined check, not a truthy check: campaignId 0 is a valid,
  // real backend id (the contract's campaignCount starts at 0, so the very
  // first campaign ever created gets id 0) and would be wrongly treated as
  // "no backend campaign" by `!base.backendId` since 0 is falsy in JS.
  if (base.backendId === undefined) return { campaign: base, report: null };

  const [aggregate, feed, report] = await Promise.all([
    getAggregate(base.backendId),
    getFeed(base.backendId, 30),
    getReport(base.backendId),
  ]);

  if (!aggregate) return { campaign: base, report: null };

  const categories = CATEGORY_DISPLAY_ORDER.map(({ key, name }, i) => ({
    name,
    pct: aggregate.spentPaise > 0 ? Math.round((aggregate.categorySplit[key] / aggregate.spentPaise) * 100) : 0,
    color: CAT_COLORS[i],
  }));

  const ledger: LedgerRow[] = feed
    ? feed.items
        .filter((item): item is Extract<typeof item, { type: "spend" }> => item.type === "spend")
        .map((item) => ({
          date: fmtDate(item.ts),
          desc: item.memo || `Spend recorded on-chain`,
          category: item.category.charAt(0) + item.category.slice(1).toLowerCase(),
          amount: paiseToRupees(item.amountPaise),
          hash: shortHash(item.txHash),
        }))
    : base.ledger;

  // Donor identities are never stored by the backend (HLD principle #2) --
  // only a per-deployment-salted hash and the amount. Real donation entries
  // overlay anonymized, real mock names never mix with real amounts.
  const donors = feed
    ? feed.items
        .filter((item): item is Extract<typeof item, { type: "donation" }> => item.type === "donation")
        .slice(0, 8)
        .map((item) => ({ name: "Verified donor", amount: paiseToRupees(item.amountPaise) }))
    : base.donors;

  return {
    campaign: {
      ...base,
      raised: paiseToRupees(aggregate.raisedPaise),
      spent: paiseToRupees(aggregate.spentPaise),
      categories,
      ledger: ledger.length > 0 ? ledger : base.ledger,
      donors: donors.length > 0 ? donors : base.donors,
    },
    report,
  };
}
