import { Router } from "express";
import { computeAggregate } from "../indexer/aggregate.js";

export const aggregateRouter = Router();

/**
 * @openapi
 * /api/campaigns/{id}/aggregate:
 *   get:
 *     summary: Deterministic aggregate for a campaign
 *     description: Pure SQL + arithmetic, no AI involvement. This exact shape is the Intelligence Domain's only input.
 *     tags: [Aggregate]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Aggregate JSON
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Aggregate'
 *       404:
 *         description: Campaign not found
 */
aggregateRouter.get("/api/campaigns/:id/aggregate", (req, res) => {
  const id = Number(req.params.id);
  const aggregate = computeAggregate(id);
  if (!aggregate) {
    res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${id} not found` });
    return;
  }
  res.json(aggregate);
});
