export const CATEGORIES = ["FOOD", "WATER", "MEDICAL", "SHELTER", "LOGISTICS", "ADMIN"] as const;
export type CategoryName = (typeof CATEGORIES)[number];

export const EVIDENCE_MIME_ALLOWLIST = ["image/jpeg", "image/png", "application/pdf"];
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const OUT_OF_SCOPE_TERMS = ["office", "repair", "renovation", "furniture", "vehicle purchase"];

export const VENDOR_CONCENTRATION_THRESHOLD_PCT = 35;
export const ADMIN_RATIO_THRESHOLD_PCT = 15;

export const REPORT_REFRESH_MIN_INTERVAL_MS = 30_000;

// Aadhaar-shaped: 12 digits, optionally grouped 4-4-4. PAN-shaped: 5 letters, 4
// digits, 1 letter. Used only to flag evidence for manual redaction (LLD Section 6);
// never used to extract or store the matched value itself.
export const AADHAAR_SHAPED_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_SHAPED_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/;

// Trust score (LLD Section 8). The published formula has 5 weighted terms,
// but 3 of them depend on systems that don't exist yet: reconciliationMatchPct
// needs the MVP1+ bank reconciliation job, promiseAlignmentScore needs a
// stored promised-category-split to compare against (only a promise *hash*
// is on-chain today), and attestorDiversityScore needs a real attestor roles
// table (the attestor allowlist is deliberately a flat address list until
// MVP2+, see auth/attestorAllowlist.ts). Rather than fake those three, the
// score is computed from only the two terms with real data, reweighted to
// sum to 1 in the same ratio the LLD gives them (0.30:0.25 -> 6/11:5/11).
// The other three are reported as `pending` alongside the score so nothing
// is silently underclaimed -- HLD Section 8 requires the formula be
// published, not just the number.
export const TRUST_SCORE_WEIGHT_EVIDENCED_SPEND = 30 / 55;
export const TRUST_SCORE_WEIGHT_DELIVERY_ATTESTED = 25 / 55;
export const TRUST_SCORE_PENDING_TERMS = [
  "reconciliationMatchPct",
  "promiseAlignmentScore",
  "attestorDiversityScore",
] as const;
