import { Router } from "express";
import { z } from "zod";
import { getSpend } from "../db/repositories/spendsRepo.js";
import { getOperatorContract } from "../chain/contractClient.js";
import { verifyAttestor } from "../auth/attestorAllowlist.js";

export const deliveryRouter = Router();

const deliverBodySchema = z.object({
  authAddress: z.string(),
  authNonce: z.string(),
  authTimestamp: z.number(),
  authSignature: z.string(),
});

/**
 * @openapi
 * /api/campaigns/{id}/spend/{spendRef}/deliver:
 *   post:
 *     summary: Attest delivery for a spend
 *     tags: [Delivery]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: spendRef
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeliverRequest'
 *     responses:
 *       201:
 *         description: Delivery attested
 *       401:
 *         description: Attestor not authorized
 *       404:
 *         description: Spend not found
 */
deliveryRouter.post("/api/campaigns/:id/spend/:spendRef/deliver", async (req, res, next) => {
  try {
    const campaignId = Number(req.params.id);
    const spendRef = req.params.spendRef;

    const spend = await getSpend(spendRef);
    if (!spend || spend.campaign_id !== campaignId) {
      res.status(404).json({ error: "NOT_FOUND", detail: `spend ${spendRef} not found for campaign ${campaignId}` });
      return;
    }

    const body = deliverBodySchema.parse(req.body);
    const authCheck = verifyAttestor("POST /api/campaigns/:id/spend/:spendRef/deliver", campaignId, {
      address: body.authAddress,
      nonce: body.authNonce,
      timestamp: body.authTimestamp,
      signature: body.authSignature,
    });
    if (!authCheck.ok) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: authCheck.reason });
      return;
    }

    const contract = getOperatorContract();
    let tx;
    try {
      tx = await contract.attestDelivery(campaignId, spendRef);
    } catch (err: any) {
      res.status(422).json({
        error: "CONTRACT_REVERT",
        detail: err?.shortMessage ?? err?.message ?? "unknown revert",
      });
      return;
    }
    const receipt = await tx.wait();

    res.status(201).json({ txHash: receipt.hash, status: "confirmed" });
  } catch (err) {
    next(err);
  }
});
