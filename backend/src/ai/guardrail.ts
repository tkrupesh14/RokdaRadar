import type { CampaignAggregate } from "../types/domain.js";
import type { Report } from "./reportSchema.js";

// Real, deterministic TypeScript port of LLD Section 5.3's validate_report
// pseudocode. This is the enforcement of HLD principle #3 ("the AI computes
// nothing") -- the model's numeric/ref claims are never trusted, only
// checked against the payload that was actually handed to it.

const NUMBER_TOLERANCE = 1e-6;

// The payload is structured JSON: every figure that matters is already a
// numeric field, so this only needs to walk actual `number` values.
function extractPayloadNumbers(value: unknown): number[] {
  const numbers: number[] = [];

  if (typeof value === "number" && Number.isFinite(value)) {
    numbers.push(value);
    return numbers;
  }

  if (Array.isArray(value)) {
    for (const item of value) numbers.push(...extractPayloadNumbers(item));
    return numbers;
  }

  if (value && typeof value === "object") {
    for (const v of Object.values(value)) numbers.push(...extractPayloadNumbers(v));
    return numbers;
  }

  return numbers;
}

// Hex-ish tokens (spendRef/txHash strings the model quotes in prose, e.g.
// "0x62381717a1...") must be stripped *before* number-matching runs, not
// after -- otherwise the number regex still grabs the leading all-digit
// prefix of the hex string (e.g. "62381717") as if it were a standalone
// figure. Requires at least one a-f letter so this never strips a genuine
// decimal figure like "482000" (which happens to also be valid hex digits
// but contains none of the distinguishing letters).
const HEX_TOKEN_RE = /\b(?:0x)?(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{6,}\b/g;

// ISO-ish dates ("2026-08-16", "2026-08") read as digit runs too -- their
// individual components (year, month, day) are never payload numbers in
// their own right, so they must be stripped before number-matching runs,
// same reasoning as hex tokens above.
const DATE_TOKEN_RE = /\b\d{4}-\d{2}(?:-\d{2})?\b/g;

// No leading sign: every figure this domain ever reports (paise amounts,
// percentages, hour counts) is non-negative, and allowing a leading "-"
// caused hyphenated identifiers like disasterTag ("KL-WAYANAD-2026-07") or
// ISO dates ("2026-08-16") to be misread as negative numbers (e.g. "-2026").
const NUMBER_IN_TEXT_RE = /\d[\d,]*\.?\d*/g;

function numbersInText(text: string, disasterTag: string): number[] {
  const withoutDisasterTag = disasterTag ? text.split(disasterTag).join(" ") : text;
  const withoutHexTokens = withoutDisasterTag.replace(HEX_TOKEN_RE, " ");
  const withoutDates = withoutHexTokens.replace(DATE_TOKEN_RE, " ");
  const matches = withoutDates.match(NUMBER_IN_TEXT_RE) ?? [];
  return matches.map((m) => Number(m.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
}

// The model's report is natural-language prose ("...spent 96.8% of...") --
// its numeric claims live inside string fields, not as typed JSON numbers.
// Every string field is regex-scanned for embedded numeric literals, except
// keys that are legitimately non-numeric identifiers/timestamps/refs.
function extractReportNumbers(value: unknown, excludeKeys: Set<string>, disasterTag: string, keyHint?: string): number[] {
  const numbers: number[] = [];
  const isExcluded = Boolean(keyHint && excludeKeys.has(keyHint));

  if (typeof value === "number" && Number.isFinite(value)) {
    if (!isExcluded) numbers.push(value);
    return numbers;
  }

  if (typeof value === "string") {
    if (!isExcluded) numbers.push(...numbersInText(value, disasterTag));
    return numbers;
  }

  if (Array.isArray(value)) {
    for (const item of value) numbers.push(...extractReportNumbers(item, excludeKeys, disasterTag));
    return numbers;
  }

  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      numbers.push(...extractReportNumbers(v, excludeKeys, disasterTag, key));
    }
    return numbers;
  }

  return numbers;
}

// Allows simple, auditable derived values (e.g. a percentage computed from
// two payload numbers) -- per LLD 5.3, this is a temporary MVP0 allowance to
// tighten later, not a permanent escape hatch.
//
// Deliberately narrow: only a genuine ratio*100 ("what % is a of b") gets a
// rounding tolerance, since the model may report it to 1 decimal place.
// a-b/a+b are checked with an exact match (no tolerance) -- they're integer
// arithmetic (e.g. unspentPaise = raisedPaise - spentPaise) that shouldn't
// need "close enough", and loosening that tolerance let coincidental sums of
// two unrelated payload numbers (e.g. spentPaise + medianDonationPaise)
// slip a hallucinated figure through.
const PERCENTAGE_ROUNDING_TOLERANCE = 0.15;

export function isDerivedPercentage(n: number, payloadNumbers: number[]): boolean {
  for (const a of payloadNumbers) {
    for (const b of payloadNumbers) {
      if (b === 0) continue;
      if (Math.abs((a / b) * 100 - n) < PERCENTAGE_ROUNDING_TOLERANCE) return true;
      if (Math.abs(a - b - n) < NUMBER_TOLERANCE) return true;
      if (Math.abs(a + b - n) < NUMBER_TOLERANCE) return true;
    }
  }
  return false;
}

function numbersMatch(n: number, payloadNumbers: number[]): boolean {
  return payloadNumbers.some((p) => Math.abs(p - n) < NUMBER_TOLERANCE);
}

export type GuardrailResult = { valid: true } | { valid: false; reason: string };

const REPORT_TEXT_EXCLUDE_KEYS = new Set(["ref", "spendRef", "generatedAt", "category", "severity", "verdict"]);

export function validateReport(report: Report, payload: CampaignAggregate): GuardrailResult {
  const payloadNumbers = extractPayloadNumbers(payload as unknown as Record<string, unknown>);
  const reportNumbers = extractReportNumbers(
    report as unknown as Record<string, unknown>,
    REPORT_TEXT_EXCLUDE_KEYS,
    payload.disasterTag
  );

  for (const n of reportNumbers) {
    if (!numbersMatch(n, payloadNumbers) && !isDerivedPercentage(n, payloadNumbers)) {
      return { valid: false, reason: `number ${n} not present in payload and not a simple derived percentage` };
    }
  }

  for (const claim of [...report.breakdown, ...report.anomalies]) {
    const ref = "ref" in claim ? claim.ref : claim.spendRef;
    if (!ref || !(ref in payload.txIndex)) {
      return { valid: false, reason: `claim ref "${String(ref)}" not present in payload.txIndex` };
    }
  }

  // Rule 5 of the system prompt (LLD 5.2) says the model may only assign
  // severity/reasoning to entries that already exist in anomalyCandidates --
  // it must never invent a new anomaly. Enforce that here rather than
  // trusting the model to have followed the instruction.
  const flaggedSpendRefs = new Set(payload.anomalyCandidates.map((a) => a.spendRef));
  for (const anomaly of report.anomalies) {
    if (!flaggedSpendRefs.has(anomaly.spendRef)) {
      return { valid: false, reason: `anomaly for "${anomaly.spendRef}" is not in payload.anomalyCandidates` };
    }
  }

  return { valid: true };
}
