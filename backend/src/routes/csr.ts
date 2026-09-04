import { Router } from "express";
import { listCampaigns } from "../db/repositories/campaignsRepo.js";
import { computeAggregate } from "../indexer/aggregate.js";

export const csrRouter = Router();

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
