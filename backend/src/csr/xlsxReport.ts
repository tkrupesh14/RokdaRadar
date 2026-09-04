import ExcelJS from "exceljs";
import { explorerTxUrl, type CsrReportData } from "./reportData.js";

function toRupees(paise: number): number {
  return paise / 100;
}

// Same three-part structure as the PDF (portfolio summary, per-campaign
// spend disclosure, verification appendix) -- LLD Section 9 -- as separate
// sheets, since a spreadsheet's natural unit is a sheet/table rather than
// a page.
export async function renderCsrReportXlsx(data: CsrReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date(data.generatedAt);

  const summarySheet = workbook.addWorksheet("Portfolio summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 40 },
  ];
  summarySheet.addRows([
    { field: "Generated", value: data.generatedAt },
    { field: "Period from", value: data.fromDate ?? "inception" },
    { field: "Period to", value: data.toDate ?? "present" },
    { field: "Campaigns", value: data.campaignCount },
    { field: "Total raised (in period, INR)", value: toRupees(data.totalRaisedPaise) },
    { field: "Total spent (in period, INR)", value: toRupees(data.totalSpentPaise) },
  ]);

  const spendSheet = workbook.addWorksheet("Spend disclosure");
  spendSheet.columns = [
    { header: "Campaign ID", key: "campaignId", width: 12 },
    { header: "Disaster tag", key: "disasterTag", width: 22 },
    { header: "Date", key: "date", width: 12 },
    { header: "Category", key: "category", width: 12 },
    { header: "Vendor ref", key: "vendorRef", width: 20 },
    { header: "Amount (INR)", key: "amount", width: 14 },
    { header: "Evidence CID", key: "evidenceCid", width: 40 },
  ];
  for (const campaign of data.campaigns) {
    for (const s of campaign.spends) {
      spendSheet.addRow({
        campaignId: campaign.campaignId,
        disasterTag: campaign.disasterTag,
        date: new Date(s.ts * 1000).toISOString().slice(0, 10),
        category: s.category,
        vendorRef: s.vendorRef,
        amount: toRupees(s.amountPaise),
        evidenceCid: s.evidenceCid,
      });
    }
  }

  // Verification appendix: every donation/spend included above, with its
  // hash and explorer link, independent of ReliefTrace's own rendering
  // (LLD Section 9's "reproduce every figure from the appendix alone").
  const appendixSheet = workbook.addWorksheet("Verification appendix");
  appendixSheet.columns = [
    { header: "Campaign ID", key: "campaignId", width: 12 },
    { header: "Type", key: "type", width: 10 },
    { header: "Date", key: "date", width: 12 },
    { header: "Amount (INR)", key: "amount", width: 14 },
    { header: "Tx hash", key: "txHash", width: 68 },
    { header: "Explorer link", key: "explorerUrl", width: 60 },
  ];
  for (const campaign of data.campaigns) {
    for (const d of campaign.donations) {
      appendixSheet.addRow({
        campaignId: campaign.campaignId,
        type: "donation",
        date: new Date(d.ts * 1000).toISOString().slice(0, 10),
        amount: toRupees(d.amountPaise),
        txHash: d.txHash,
        explorerUrl: explorerTxUrl(d.txHash),
      });
    }
    for (const s of campaign.spends) {
      appendixSheet.addRow({
        campaignId: campaign.campaignId,
        type: "spend",
        date: new Date(s.ts * 1000).toISOString().slice(0, 10),
        amount: toRupees(s.amountPaise),
        txHash: s.txHash,
        explorerUrl: explorerTxUrl(s.txHash),
      });
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
