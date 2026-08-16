import type { CampaignAggregate } from "../types/domain.js";
import type { Report } from "./reportSchema.js";

// Real, deterministic TypeScript port of LLD Section 5.3's validate_report
// pseudocode. This is the enforcement of HLD principle #3 ("the AI computes
// nothing") -- the model's numeric/ref claims are never trusted, only
// checked against the payload that was actually handed to it.

const NUMBER_TOLERANCE = 1e-6;

function extractAllNumbers(value: unknown, excludeKeys: Set<string> = new Set(), keyHint?: string): number[] {
  const numbers: number[] = [];

  if (typeof value === "number" && Number.isFinite(value)) {
    if (!keyHint || !excludeKeys.has(keyHint)) numbers.push(value);
    return numbers;
  }

  if (Array.isArray(value)) {
    for (const item of value) numbers.push(...extractAllNumbers(item, excludeKeys));
    return numbers;
  }

  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      numbers.push(...extractAllNumbers(v, excludeKeys, key));
    }
    return numbers;
  }

  return numbers;
}

// Allows simple, auditable derived values (e.g. a percentage computed from
// two payload numbers) -- per LLD 5.3, this is a temporary MVP0 allowance to
// tighten later, not a permanent escape hatch. Checks: n is close to
// a/b*100 for some pair of payload numbers, or a-b, or a+b, for any pair.
export function isDerivedPercentage(n: number, payloadNumbers: number[]): boolean {
  for (const a of payloadNumbers) {
    for (const b of payloadNumbers) {
      if (b === 0) continue;
      const candidates = [(a / b) * 100, a - b, a + b];
      if (candidates.some((c) => Math.abs(c - n) < Math.max(NUMBER_TOLERANCE, Math.abs(n) * 0.005))) {
        return true;
      }
    }
  }
  return false;
}

function numbersMatch(n: number, payloadNumbers: number[]): boolean {
  return payloadNumbers.some((p) => Math.abs(p - n) < NUMBER_TOLERANCE);
}

export type GuardrailResult = { valid: true } | { valid: false; reason: string };

export function validateReport(report: Report, payload: CampaignAggregate): GuardrailResult {
  const payloadNumbers = extractAllNumbers(payload as unknown as Record<string, unknown>);
  const reportNumbers = extractAllNumbers(report as unknown as Record<string, unknown>, new Set(["ref", "spendRef"]));

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
