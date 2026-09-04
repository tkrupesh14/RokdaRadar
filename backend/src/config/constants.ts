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
// but 2 of them still depend on systems that don't exist yet:
// promiseAlignmentScore needs a stored promised-category-split to compare
// against (only a promise *hash* is on-chain today), and
// attestorDiversityScore needs a real attestor roles table (the attestor
// allowlist is deliberately a flat address list until MVP2+, see
// auth/attestorAllowlist.ts). reconciliationMatchPct (issue #10) is now live,
// backed by the bank reconciliation job (issue #5, src/jobs/reconciliationJob.ts).
// Rather than fake the remaining two, the score is computed from only the
// three terms with real data, reweighted to sum to 1 in the same ratio the
// LLD gives them (0.30:0.25:0.20 -> 30/75:25/75:20/75). The other two are
// reported as `pending` alongside the score so nothing is silently
// underclaimed -- HLD Section 8 requires the formula be published, not just
// the number.
export const TRUST_SCORE_WEIGHT_EVIDENCED_SPEND = 30 / 75;
export const TRUST_SCORE_WEIGHT_DELIVERY_ATTESTED = 25 / 75;
export const TRUST_SCORE_WEIGHT_RECONCILIATION_MATCH = 20 / 75;
export const TRUST_SCORE_PENDING_TERMS = ["promiseAlignmentScore", "attestorDiversityScore"] as const;
