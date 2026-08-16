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
