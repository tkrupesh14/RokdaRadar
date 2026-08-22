import { describe, it, expect } from "vitest";
import { renderCsrReportPdf } from "../../src/csr/pdfReport.js";
import type { CsrReportData } from "../../src/csr/reportData.js";

const FIXTURE: CsrReportData = {
  generatedAt: "2026-08-22T00:00:00.000Z",
  fromDate: "2026-01-01",
  toDate: "2026-12-31",
  campaignCount: 1,
  totalRaisedPaise: 50000,
  totalSpentPaise: 18400,
  campaigns: [
    {
      campaignId: 1,
      disasterTag: "KL-WAYANAD-2026-07",
      darpanId: "DARPAN1",
      reg80G: "80G1",
      raisedPaise: 50000,
      spentPaise: 18400,
      donations: [{ utrHash: "0xutr1", amountPaise: 50000, ts: 1_700_000_000, txHash: "0xdon1" }],
      spends: [
        {
          spendRef: "0xspend1",
          vendorRef: "vendorA",
          category: "FOOD",
          amountPaise: 18400,
          ts: 1_700_000_100,
          txHash: "0xspendtx1",
          evidenceCid: "cid1",
        },
      ],
    },
  ],
};

describe("renderCsrReportPdf", () => {
  it("produces a real PDF (starts with the %PDF magic header) with meaningful content", async () => {
    const buffer = await renderCsrReportPdf(FIXTURE);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // A blank/near-empty PDF is a few hundred bytes; this has real text content
    // (portfolio summary, a spend row, two appendix rows) across multiple pages.
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("handles a portfolio with no campaigns without throwing", async () => {
    const buffer = await renderCsrReportPdf({ ...FIXTURE, campaignCount: 0, campaigns: [], totalRaisedPaise: 0, totalSpentPaise: 0 });
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
