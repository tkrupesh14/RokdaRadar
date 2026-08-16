import { Router } from "express";
import { listDonationsByCampaign } from "../db/repositories/donationsRepo.js";
import { listSpendsByCampaign } from "../db/repositories/spendsRepo.js";

export const feedRouter = Router();

type FeedItem =
  | { type: "donation"; ts: number; txHash: string; amountPaise: number }
  | { type: "spend"; ts: number; txHash: string; amountPaise: number; category: string; memo: string | null; spendRef: string };

/**
 * @openapi
 * /api/campaigns/{id}/feed:
 *   get:
 *     summary: Paginated transaction feed
 *     tags: [Feed]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Feed page
 */
feedRouter.get("/api/campaigns/:id/feed", (req, res) => {
  const id = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const donations: FeedItem[] = listDonationsByCampaign(id).map((d) => ({
    type: "donation",
    ts: d.ts,
    txHash: d.tx_hash,
    amountPaise: d.amount_paise,
  }));

  const spends: FeedItem[] = listSpendsByCampaign(id).map((s) => ({
    type: "spend",
    ts: s.ts,
    txHash: s.tx_hash,
    amountPaise: s.amount_paise,
    category: s.category,
    memo: s.memo,
    spendRef: s.spend_ref,
  }));

  const merged = [...donations, ...spends].sort((a, b) => b.ts - a.ts);
  const page = merged.slice(offset, offset + limit);

  res.json({ items: page, total: merged.length, limit, offset });
});
