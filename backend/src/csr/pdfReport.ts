import PDFDocument from "pdfkit";
import { explorerTxUrl, type CsrReportData } from "./reportData.js";

function fmtINR(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// LLD Section 9: portfolio summary, per-campaign spend tables, and a
// verification appendix listing every included transaction's hash + Monad
// Explorer link, so an auditor can reproduce every figure from the
// appendix alone.
export async function renderCsrReportPdf(data: CsrReportData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(20).text("RokdaRadar CSR Compliance Report", { align: "left" });
  doc.fontSize(10).fillColor("#555").text(`Generated ${data.generatedAt}`);
  if (data.fromDate || data.toDate) {
    doc.text(`Period: ${data.fromDate ?? "inception"} to ${data.toDate ?? "present"}`);
  }
  doc.fillColor("#000").moveDown();

  doc.fontSize(14).text("Portfolio summary");
  doc.fontSize(10);
  doc.text(`Campaigns: ${data.campaignCount}`);
  doc.text(`Total raised (in period): ${fmtINR(data.totalRaisedPaise)}`);
  doc.text(`Total spent (in period): ${fmtINR(data.totalSpentPaise)}`);
  doc.moveDown();

  for (const campaign of data.campaigns) {
    if (campaign.donations.length === 0 && campaign.spends.length === 0) continue; // nothing in this period

    doc.addPage();
    doc.fontSize(14).text(`Campaign #${campaign.campaignId} — ${campaign.disasterTag}`);
    doc.fontSize(9).fillColor("#555");
    doc.text(`Darpan ID: ${campaign.darpanId ?? "—"}    80G: ${campaign.reg80G ?? "—"}`);
    doc.fillColor("#000").fontSize(10);
    doc.text(`Raised (in period): ${fmtINR(campaign.raisedPaise)}    Spent (in period): ${fmtINR(campaign.spentPaise)}`);
    doc.moveDown();

    if (campaign.spends.length > 0) {
      doc.fontSize(12).text("Spend disclosure");
      doc.fontSize(9);
      for (const s of campaign.spends) {
        doc.text(`${fmtDate(s.ts)}  ${s.category.padEnd(9)}  ${s.vendorRef.padEnd(20)}  ${fmtINR(s.amountPaise)}`);
      }
      doc.moveDown();
    }
  }

  // Verification appendix: every transaction included above, with its hash
  // and explorer link, independent of ReliefTrace's own rendering.
  doc.addPage();
  doc.fontSize(14).text("Verification appendix");
  doc.fontSize(8).fillColor("#555");
  doc.text("Every transaction included in this report. Reproduce any figure above by summing the matching rows here.");
  doc.fillColor("#000").moveDown(0.5);

  for (const campaign of data.campaigns) {
    if (campaign.donations.length === 0 && campaign.spends.length === 0) continue;
    doc.fontSize(10).text(`Campaign #${campaign.campaignId} — ${campaign.disasterTag}`);
    doc.fontSize(8);
    for (const d of campaign.donations) {
      doc.text(`  DONATION  ${fmtDate(d.ts)}  ${fmtINR(d.amountPaise)}  tx:${d.txHash}  ${explorerTxUrl(d.txHash)}`);
    }
    for (const s of campaign.spends) {
      doc.text(`  SPEND     ${fmtDate(s.ts)}  ${fmtINR(s.amountPaise)}  tx:${s.txHash}  ${explorerTxUrl(s.txHash)}`);
    }
    doc.moveDown(0.5);
  }

  doc.end();
  return done;
}
