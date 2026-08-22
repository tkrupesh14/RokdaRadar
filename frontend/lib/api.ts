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

// Partial by design (LLD Section 8): only 2 of the formula's 5 terms have
// real backing data today. `pending` lists the rest so the UI can disclose
// the score is provisional rather than implying it's the full formula.
export type ApiTrustScoreBreakdown = {
  evidencedSpendPct: number;
  deliveryAttestedPct: number;
  weights: { evidencedSpendPct: number; deliveryAttestedPct: number };
  pending: string[];
};

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
  evidencedSpendPct: number;
  deliveryAttestedPct: number;
  trustScore: number;
  trustScoreBreakdown: ApiTrustScoreBreakdown;
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

export type OperatorAuth = {
  authAddress: string;
  authNonce: string;
  authTimestamp: number;
  authSignature: string;
};

export type ApiSpendResponse = {
  spendRef?: string;
  txHash: string;
  explorerUrl: string;
  evidenceCID: string;
  status: "confirmed";
};

export type SpendResult =
  | { ok: true; data: ApiSpendResponse }
  | { ok: false; error: string; code?: string };

// Operator-signature-gated write (POST /api/campaigns/:id/spend), multipart
// so the evidence file travels in the same request the backend hashes and
// stores (see backend/src/routes/spend.ts). `auth` comes from
// lib/wallet.ts's signOperatorRequest("POST /api/campaigns/:id/spend", id, address).
export async function recordSpend(
  campaignId: number,
  input: { vendorRef: string; amountPaise: number; category: string; memo: string; evidenceFile: File },
  auth: OperatorAuth
): Promise<SpendResult> {
  try {
    const form = new FormData();
    form.append("vendorRef", input.vendorRef);
    form.append("amountPaise", String(input.amountPaise));
    form.append("category", input.category);
    form.append("memo", input.memo);
    form.append("authAddress", auth.authAddress);
    form.append("authNonce", auth.authNonce);
    form.append("authTimestamp", String(auth.authTimestamp));
    form.append("authSignature", auth.authSignature);
    form.append("evidenceFile", input.evidenceFile);

    const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/spend`, { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.detail || body?.error || `Spend failed (${res.status})`, code: body?.code };
    }
    return { ok: true, data: body as ApiSpendResponse };
  } catch {
    return { ok: false, error: "Could not reach the backend. Is it running?" };
  }
}

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

export type ApiCsrPortfolioCampaign = {
  campaignId: number;
  operator: string;
  disasterTag: string;
  darpanId: string | null;
  reg80G: string | null;
  active: boolean;
  raisedPaise: number;
  spentPaise: number;
  trustScore: number;
  evidencedSpendPct: number;
  anomalyCount: number;
};

// One shared portfolio across every real on-chain campaign -- there's no
// company/donor-attribution data model in this system, see the backend
// route's own description (src/routes/csr.ts).
export type ApiCsrPortfolio = {
  campaignCount: number;
  totalRaisedPaise: number;
  totalSpentPaise: number;
  avgTrustScore: number;
  /** Spend-weighted, not a simple average across campaigns. */
  avgEvidencedSpendPct: number;
  campaignsWithAnomalies: number;
  campaigns: ApiCsrPortfolioCampaign[];
};

export function getCsrPortfolio() {
  return safeFetch<ApiCsrPortfolio>(`/api/csr/portfolio`);
}

// Direct download link, not a safeFetch() JSON call -- the browser navigates
// to this URL (or an <a download> triggers it) to stream the generated
// file, same as any other file-download endpoint.
export function csrReportUrl(format: "pdf" | "xlsx"): string {
  return `${API_BASE_URL}/api/csr/report?format=${format}`;
}

export type ApiDonateResponse = {
  paymentId: string;
  utr: string;
  amountPaise: number;
  campaignId: number;
  status: "confirmed";
  txHash: string;
};

export type DonateResult = { ok: true; data: ApiDonateResponse } | { ok: false; error: string };

// Unlike the read helpers above, this can't silently return null on failure --
// the donate flow needs to tell the donor whether their money actually moved.
export async function donateToCampaign(id: number, amountPaise: number, donorVpa?: string): Promise<DonateResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/campaigns/${id}/donate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaise, donorVpa }),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, error: body?.detail || body?.error || `Donation failed (${res.status})` };
    }
    return { ok: true, data: body as ApiDonateResponse };
  } catch {
    return { ok: false, error: "Could not reach the backend. Is it running?" };
  }
}
