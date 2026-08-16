// Typed client for the RokdaRadar backend (../backend). See
// ReliefTrace_LLD.md Section 3.4/4.2 for the exact response shapes this
// mirrors. Every function returns `null` on any failure (network error,
// 404, backend not running) rather than throwing -- callers merge onto
// static fallback content, since the backend has no seeded campaigns until
// a real one is created on-chain (see backend/README.md).

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export type ApiCategorySplit = Record<"FOOD" | "WATER" | "MEDICAL" | "SHELTER" | "LOGISTICS" | "ADMIN", number>;

export type ApiCampaign = {
  campaignId: number;
  operator: string;
  disasterTag: string;
  darpanId: string | null;
  reg80G: string | null;
  promiseHash: string;
  raisedPaise: number;
  spentPaise: number;
  active: boolean;
  createdAt: number;
};

export type ApiVendorConcentration = { vendorRef: string; sharePct: number; spendCount: number };
export type ApiAnomalyCandidate = { spendRef: string; reason: string; value: number | string };

export type ApiAggregate = {
  campaignId: number;
  disasterTag: string;
  raisedPaise: number;
  spentPaise: number;
  unspentPaise: number;
  donationCount: number;
  spendCount: number;
  categorySplit: ApiCategorySplit;
  fieldVsAdminRatio: number;
  vendorConcentration: ApiVendorConcentration[];
  medianDonationPaise: number;
  medianDisbursementLatencyHours: number;
  deliveryAttestedPct: number;
  anomalyCandidates: ApiAnomalyCandidate[];
  txIndex: Record<string, string>;
};

export type ApiFeedItem =
  | { type: "donation"; ts: number; txHash: string; amountPaise: number }
  | {
      type: "spend";
      ts: number;
      txHash: string;
      amountPaise: number;
      category: string;
      memo: string | null;
      spendRef: string;
    };

export type ApiFeed = { items: ApiFeedItem[]; total: number; limit: number; offset: number };

export type ApiReport = {
  generatedAt: string;
  headline: string;
  summary: string;
  breakdown: { category: string; text: string; ref: string }[];
  anomalies: { spendRef: string; severity: "info" | "query" | "concern"; finding: string; reasoning: string }[];
  promiseConsistency: { verdict: "aligned" | "drifting" | "mismatch"; text: string };
  translations: Record<string, { headline: string; summary: string }>;
};

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Backend not running / unreachable -- callers fall back to static content.
    return null;
  }
}

export function getCampaign(id: number) {
  return safeFetch<ApiCampaign>(`/api/campaigns/${id}`);
}

export function getAggregate(id: number) {
  return safeFetch<ApiAggregate>(`/api/campaigns/${id}/aggregate`);
}

export function getFeed(id: number, limit = 20) {
  return safeFetch<ApiFeed>(`/api/campaigns/${id}/feed?limit=${limit}`);
}

export function getReport(id: number) {
  return safeFetch<ApiReport>(`/api/campaigns/${id}/report`);
}

export function listCampaigns() {
  return safeFetch<{ campaigns: ApiCampaign[] }>(`/api/campaigns`);
}
