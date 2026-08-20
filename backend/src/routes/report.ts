import { Router } from "express";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { getReport, refreshReport, AiServiceUnavailableError, CampaignNotFoundError, RefreshRateLimitedError } from "../ai/reportService.js";

export const reportRouter = Router();

/**
 * @openapi
 * /api/campaigns/{id}/report:
 *   get:
 *     summary: AI-generated report (cached)
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Guardrail-validated report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Campaign not found
 *       503:
 *         description: AI service unavailable (ANTHROPIC_API_KEY not configured)
 */
reportRouter.get("/api/campaigns/:id/report", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!(await getCampaign(id))) {
    res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${id} not found` });
    return;
  }
  try {
    const report = await getReport(id);
    res.json(report);
  } catch (err) {
    if (err instanceof AiServiceUnavailableError) {
      res.status(503).json({ error: "AI_SERVICE_UNAVAILABLE", detail: err.message });
      return;
    }
    if (err instanceof CampaignNotFoundError) {
      res.status(404).json({ error: "NOT_FOUND", detail: err.message });
      return;
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/campaigns/{id}/report/refresh:
 *   post:
 *     summary: Force report regeneration
 *     description: Rate-limited to once per 30 seconds per campaign.
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Freshly regenerated, guardrail-validated report
 *       404:
 *         description: Campaign not found
 *       429:
 *         description: Rate limited
 *       503:
 *         description: AI service unavailable
 */
reportRouter.post("/api/campaigns/:id/report/refresh", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!(await getCampaign(id))) {
    res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${id} not found` });
    return;
  }
  try {
    const report = await refreshReport(id);
    res.json(report);
  } catch (err) {
    if (err instanceof AiServiceUnavailableError) {
      res.status(503).json({ error: "AI_SERVICE_UNAVAILABLE", detail: err.message });
      return;
    }
    if (err instanceof RefreshRateLimitedError) {
      res.status(429).json({ error: "RATE_LIMITED", detail: err.message });
      return;
    }
    if (err instanceof CampaignNotFoundError) {
      res.status(404).json({ error: "NOT_FOUND", detail: err.message });
      return;
    }
    next(err);
  }
});
