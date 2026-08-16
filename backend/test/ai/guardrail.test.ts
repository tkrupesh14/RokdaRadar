import { describe, it, expect } from "vitest";
import { validateReport, isDerivedPercentage } from "../../src/ai/guardrail.js";
import type { CampaignAggregate } from "../../src/types/domain.js";
import type { Report } from "../../src/ai/reportSchema.js";

const basePayload: CampaignAggregate = {
  campaignId: 1,
  disasterTag: "KL-WAYANAD-2026-07",
  raisedPaise: 482000,
  spentPaise: 376000,
  unspentPaise: 106000,
  donationCount: 41,
  spendCount: 15,
  categorySplit: { FOOD: 142000, WATER: 78000, MEDICAL: 56000, SHELTER: 64000, LOGISTICS: 24000, ADMIN: 12000 },
  fieldVsAdminRatio: 0.968,
  vendorConcentration: [{ vendorRef: "0x9a3f", sharePct: 41.2, spendCount: 4 }],
  medianDonationPaise: 5000,
  medianDisbursementLatencyHours: 31,
  deliveryAttestedPct: 60,
  anomalyCandidates: [{ spendRef: "0x77c1", reason: "vendor_concentration", value: 41.2 }],
  txIndex: { "0x77c1": "0xabc123", "1": "0xcreatehash" },
};

function baseReport(overrides: Partial<Report> = {}): Report {
  return {
    generatedAt: "2026-08-13T09:14:02Z",
    headline: "This campaign has spent 376000 paise on relief so far.",
    summary: "Spend recorded against 15 transactions.",
    breakdown: [{ category: "FOOD", text: "142000 paise spent on food.", ref: "0x77c1" }],
    anomalies: [
      {
        spendRef: "0x77c1",
        severity: "concern",
        finding: "Vendor concentration at 41.2%.",
        reasoning: "One vendor received 41.2% of spend.",
      },
    ],
    promiseConsistency: { verdict: "aligned", text: "Spend matches disaster relief purpose.", },
    translations: {},
    ...overrides,
  };
}

describe("guardrail: numbers must come from the payload", () => {
  it("accepts a report using only literal payload numbers", () => {
    expect(validateReport(baseReport(), basePayload).valid).toBe(true);
  });

  it("accepts every categorySplit value cited literally", () => {
    const report = baseReport({
      summary: "142000 paise on food, 78000 on water, 56000 on medical, 64000 on shelter, 24000 on logistics, 12000 on admin.",
    });
    expect(validateReport(report, basePayload).valid).toBe(true);
  });

  it("accepts raisedPaise/spentPaise/unspentPaise cited literally", () => {
    const report = baseReport({ summary: "Raised 482000, spent 376000, leaving 106000 unspent." });
    expect(validateReport(report, basePayload).valid).toBe(true);
  });

  it("accepts donationCount/spendCount cited literally", () => {
    const report = baseReport({ summary: "41 donations funded 15 spends." });
    expect(validateReport(report, basePayload).valid).toBe(true);
  });

  it("accepts vendorConcentration sharePct cited literally", () => {
    const report = baseReport({ summary: "One vendor received 41.2% of total spend." });
    expect(validateReport(report, basePayload).valid).toBe(true);
  });

  it("accepts fieldVsAdminRatio cited literally", () => {
    const report = baseReport({ headline: "0.968 of spend went to direct relief categories." });
    expect(validateReport(report, basePayload).valid).toBe(true);
  });

  it("accepts a simple derived percentage (spentPaise/raisedPaise*100)", () => {
    const derivedPct = Number(((376000 / 482000) * 100).toFixed(1));
    const report = baseReport({ summary: `This campaign has spent ${derivedPct}% of what it raised.` });
    expect(validateReport(report, basePayload).valid).toBe(true);
  });

  it("rejects a hallucinated number not present in the payload", () => {
    const report = baseReport({ summary: "This campaign has spent 999999 paise." });
    const result = validateReport(report, basePayload);
    expect(result.valid).toBe(false);
  });

  it("rejects a plausible-but-wrong rounded figure", () => {
    const report = baseReport({ summary: "Roughly 380000 paise has been spent so far." });
    expect(validateReport(report, basePayload).valid).toBe(false);
  });

  it("rejects a breakdown claim whose ref is not in txIndex", () => {
    const report = baseReport({
      breakdown: [{ category: "FOOD", text: "Food spend recorded.", ref: "0xnotintxindex" }],
    });
    expect(validateReport(report, basePayload).valid).toBe(false);
  });

  it("rejects an anomaly claim whose spendRef is not in txIndex", () => {
    const report = baseReport({
      anomalies: [
        {
          spendRef: "0xghost",
          severity: "query",
          finding: "unsupported claim",
          reasoning: "not real",
        },
      ],
    });
    expect(validateReport(report, basePayload).valid).toBe(false);
  });

  it("adversarial: a payload with no anomalyCandidates must not hallucinate one", () => {
    const cleanPayload: CampaignAggregate = { ...basePayload, anomalyCandidates: [] };
    const report = baseReport({
      anomalies: [
        {
          spendRef: "0x77c1",
          severity: "concern",
          finding: "invented anomaly not present in anomalyCandidates",
          reasoning: "hallucinated",
        },
      ],
    });
    // 0x77c1 is still a valid txIndex ref, but it was never flagged by the
    // deterministic anomaly rules for this (clean) payload -- the guardrail
    // must reject on that basis alone (LLD 5.2 rule 5: only assign severity
    // to entries that already exist in anomalyCandidates).
    const result = validateReport(report, cleanPayload);
    expect(result.valid).toBe(false);
  });

  it("accepts a report with an empty anomalies array against a clean payload", () => {
    const cleanPayload: CampaignAggregate = { ...basePayload, anomalyCandidates: [] };
    const report = baseReport({ anomalies: [] });
    expect(validateReport(report, cleanPayload).valid).toBe(true);
  });

  it("isDerivedPercentage: recognizes a two-number ratio as *100", () => {
    expect(isDerivedPercentage(50, [1, 2])).toBe(true); // 1/2*100 = 50
  });

  it("isDerivedPercentage: rejects an unrelated number", () => {
    expect(isDerivedPercentage(12345, [1, 2, 3])).toBe(false);
  });
});
