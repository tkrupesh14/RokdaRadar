import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { getCampaign } from "../db/repositories/campaignsRepo.js";

export const donateRouter = Router();

const donateSchema = z.object({
  amountPaise: z.number().int().positive(),
  donorVpa: z.string().optional(),
});

/**
 * @openapi
 * /api/campaigns/{id}/donate:
 *   post:
 *     summary: Initiate a mock UPI payment
 *     description: Returns a fake payment reference. Real PSP integration is MVP1 (out of scope). Confirm with POST /api/webhooks/upi via scripts/simulateUpiWebhook.ts.
 *     tags: [Donations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amountPaise]
 *             properties:
 *               amountPaise: { type: integer }
 *               donorVpa: { type: string }
 *     responses:
 *       201:
 *         description: Mock payment initiated
 *       404:
 *         description: Campaign not found
 */
donateRouter.post("/api/campaigns/:id/donate", (req, res) => {
  const id = Number(req.params.id);
  const campaign = getCampaign(id);
  if (!campaign) {
    res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${id} not found` });
    return;
  }

  const body = donateSchema.parse(req.body);
  const paymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
  const utr = crypto.randomInt(100000000000, 999999999999).toString();

  res.status(201).json({
    paymentId,
    utr,
    amountPaise: body.amountPaise,
    campaignId: id,
    status: "pending_confirmation",
    note: "This is a mock UPI initiation. Confirm it via POST /api/webhooks/upi (see scripts/simulateUpiWebhook.ts).",
  });
});
