import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { renderCsrReportXlsx } from "../../src/csr/xlsxReport.js";
import type { CsrReportData } from "../../src/csr/reportData.js";

const FIXTURE: CsrReportData = {
  generatedAt: "2026-08-22T00:00:00.000Z",
  fromDate: null,
  toDate: null,
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

describe("renderCsrReportXlsx", () => {
  it("produces a real, re-readable XLSX with the expected sheets and rows", async () => {
    const buffer = await renderCsrReportXlsx(FIXTURE);
    // XLSX is a zip archive -- "PK" magic bytes confirm it's a real archive,
    // not just arbitrary bytes with an .xlsx extension slapped on.
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheetNames = workbook.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual(["Portfolio summary", "Spend disclosure", "Verification appendix"]);

    // Column `key`s (from worksheet.columns) drive addRow({key: value}) while
    // building, but aren't guaranteed to survive a load() round-trip for
    // getCell(key) lookups -- reference by column letter instead, matching
    // the column order xlsxReport.ts actually declares.
    const spendSheet = workbook.getWorksheet("Spend disclosure")!;
    expect(spendSheet.rowCount).toBe(2); // header + 1 spend
    expect(spendSheet.getRow(2).getCell("F").value).toBe(184); // amount column: 18400 paise -> 184 rupees

    const appendixSheet = workbook.getWorksheet("Verification appendix")!;
    expect(appendixSheet.rowCount).toBe(3); // header + 1 donation + 1 spend
    expect(appendixSheet.getRow(2).getCell("E").value).toBe("0xdon1"); // txHash column
    expect(appendixSheet.getRow(3).getCell("E").value).toBe("0xspendtx1");
  });

  it("handles a portfolio with no campaigns without throwing", async () => {
    const buffer = await renderCsrReportXlsx({ ...FIXTURE, campaignCount: 0, campaigns: [], totalRaisedPaise: 0, totalSpentPaise: 0 });
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
