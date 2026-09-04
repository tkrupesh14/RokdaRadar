import { Router } from "express";
import { z } from "zod";
import { listCampaigns } from "../db/repositories/campaignsRepo.js";
import { computeAggregate } from "../indexer/aggregate.js";
import { buildCsrReportData } from "../csr/reportData.js";
import { renderCsrReportPdf } from "../csr/pdfReport.js";
import { renderCsrReportXlsx } from "../csr/xlsxReport.js";

export const csrRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Shape-matching the regex isn't enough -- "2026-13-99" matches it but isn't
// a real date, and new Date() on it silently produces Invalid Date (NaN),
// which would make buildCsrReportData's `ts >= fromTs` comparisons always
// false and silently return an empty report instead of erroring.
const dateString = z
  .string()
  .regex(DATE_RE, "must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "must be a valid calendar date");
const reportQuerySchema = z.object({
  format: z.enum(["pdf", "xlsx"]),
  from: dateString.optional(),
  to: dateString.optional(),
});

/**
 * @openapi
 * /api/csr/portfolio:
 *   get:
 *     summary: Aggregate data across every on-chain campaign, for the CSR compliance dashboard
 *     description: >
 *       There is no company/donor-attribution data model in this system (donations are anonymous
 *       UPI payments with no link to a specific CSR company) -- this returns one shared portfolio
 *       across every real on-chain campaign, matching the CSR dashboard's actual current design
 *       (a shared view for any logged-in CSR compliance user, not a per-company subset).
 *     tags: [CSR]
 *     responses:
 *       200:
 *         description: Portfolio summary plus per-campaign aggregates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CsrPortfolio'
 */
csrRouter.get("/api/csr/portfolio", async (_req, res) => {
  const campaigns = await listCampaigns();
  const aggregates = await Promise.all(campaigns.map((c) => computeAggregate(c.id)));

  const campaignSummaries = campaigns.map((c, i) => {
    const agg = aggregates[i]!; // computeAggregate(c.id) can't return null here -- c came from listCampaigns()
    return {
      campaignId: c.id,
      operator: c.operator,
      disasterTag: c.disaster_tag,
      darpanId: c.darpan_id,
      reg80G: c.reg_80g,
      active: Boolean(c.active),
      raisedPaise: agg.raisedPaise,
      spentPaise: agg.spentPaise,
      trustScore: agg.trustScore,
      evidencedSpendPct: agg.evidencedSpendPct,
      anomalyCount: agg.anomalyCandidates.length,
    };
  });

  const totalRaisedPaise = campaignSummaries.reduce((sum, c) => sum + c.raisedPaise, 0);
  const totalSpentPaise = campaignSummaries.reduce((sum, c) => sum + c.spentPaise, 0);
  const avgTrustScore =
    campaignSummaries.length > 0
      ? Math.round(campaignSummaries.reduce((sum, c) => sum + c.trustScore, 0) / campaignSummaries.length)
      : 0;
  // Weighted by spend, not a simple average across campaigns -- a ₹500 spend
  // that's 100% evidenced shouldn't count the same as a ₹5,00,000 one.
  const avgEvidencedSpendPct =
    totalSpentPaise > 0
      ? Number(
          (campaignSummaries.reduce((sum, c) => sum + c.evidencedSpendPct * c.spentPaise, 0) / totalSpentPaise).toFixed(1)
        )
      : 0;
  const campaignsWithAnomalies = campaignSummaries.filter((c) => c.anomalyCount > 0).length;

  res.json({
    campaignCount: campaignSummaries.length,
    totalRaisedPaise,
    totalSpentPaise,
    avgTrustScore,
    avgEvidencedSpendPct,
    campaignsWithAnomalies,
    campaigns: campaignSummaries,
  });
});

/**
 * @openapi
 * /api/csr/report:
 *   get:
 *     summary: CSR compliance report (PDF or XLSX) across every on-chain campaign
 *     description: >
 *       LLD Section 9. Portfolio summary, per-campaign spend disclosure, and a verification
 *       appendix listing every included donation/spend's tx hash and Monad Explorer link -- every
 *       figure in the report is reproducible from the appendix alone. There is no company/donor
 *       attribution data model in this system, so (unlike the LLD's literal `:companyId` path) this
 *       covers the same shared portfolio `/api/csr/portfolio` does, optionally scoped to a date
 *       range with `from`/`to`.
 *     tags: [CSR]
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema: { type: string, enum: [pdf, xlsx] }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: "2026-01-01" }
 *         description: Inclusive start date (YYYY-MM-DD). Omit for no lower bound.
 *       - in: query
 *         name: to
 *         schema: { type: string, example: "2026-12-31" }
 *         description: Inclusive end date (YYYY-MM-DD). Omit for no upper bound.
 *     responses:
 *       200:
 *         description: Generated report file
 *         content:
 *           application/pdf: {}
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet: {}
 *       400:
 *         description: Invalid query parameters
 */
csrRouter.get("/api/csr/report", async (req, res, next) => {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "BAD_REQUEST", detail: parsed.error.issues.map((i) => i.message).join("; ") });
      return;
    }
    const { format, from, to } = parsed.data;

    const data = await buildCsrReportData(from ?? null, to ?? null);
    const filenameDate = new Date().toISOString().slice(0, 10);

    if (format === "pdf") {
      const buffer = await renderCsrReportPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="rokdaradar-csr-report-${filenameDate}.pdf"`);
      res.send(buffer);
      return;
    }

    const buffer = await renderCsrReportXlsx(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="rokdaradar-csr-report-${filenameDate}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});
