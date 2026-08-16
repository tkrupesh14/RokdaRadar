import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { ethers } from "ethers";
import { getCampaign } from "../db/repositories/campaignsRepo.js";
import { getOracleContract } from "../chain/contractClient.js";
import { env } from "../config/env.js";

export const donateRouter = Router();

const donateSchema = z.object({
  amountPaise: z.number().int().positive(),
  donorVpa: z.string().optional(),
});

/**
 * @openapi
 * /api/campaigns/{id}/donate:
 *   post:
 *     summary: Make a mock UPI donation, confirmed on-chain immediately
 *     description: There is no real PSP in MVP0 (that's MVP1 scope), so this endpoint stands in for the PSP itself -- it generates a mock payment/UTR reference and, in the same request, calls attestDonation on-chain from the backend's oracle wallet exactly as the real POST /api/webhooks/upi handler would. The indexer then picks up the emitted event and the amount shows up in the campaign's aggregate/feed within a couple of seconds.
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
 *         description: Donation confirmed on-chain
 *       404:
 *         description: Campaign not found
 *       422:
 *         description: Contract reverted
 */
donateRouter.post("/api/campaigns/:id/donate", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const campaign = getCampaign(id);
    if (!campaign) {
      res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${id} not found` });
      return;
    }

    const body = donateSchema.parse(req.body);
    const paymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;
    const utr = crypto.randomInt(100000000000, 999999999999).toString();

    // Raw UTR and VPA are hashed immediately and never stored/logged (same
    // anonymization as the real webhook handler in routes/webhooks.ts).
    const utrHash = ethers.keccak256(ethers.toUtf8Bytes(utr));
    const donorRef = ethers.keccak256(ethers.toUtf8Bytes(`${body.donorVpa ?? "unknown"}:${env.WEBHOOK_HMAC_SECRET}`));

    // getOracleContract() throws synchronously (e.g. contract artifact
    // missing, CONTRACT_ADDRESS unset) -- must stay inside this try/catch.
    // A throw here in an unguarded async handler becomes an unhandled
    // promise rejection, and Node terminates the whole process for that by
    // default, which is what was crash-looping the service (LLD 3.4 assumes
    // this handler never lets an error escape uncaught).
    const contract = getOracleContract();
    let tx;
    try {
      tx = await contract.attestDonation(id, utrHash, donorRef, body.amountPaise);
    } catch (err: any) {
      res.status(422).json({
        error: "The contract rejected this transaction.",
        code: "CONTRACT_REVERT",
        detail: err?.shortMessage ?? err?.message ?? "unknown revert",
      });
      return;
    }
    const receipt = await tx.wait();

    res.status(201).json({
      paymentId,
      utr,
      amountPaise: body.amountPaise,
      campaignId: id,
      status: "confirmed",
      txHash: receipt.hash,
    });
  } catch (err) {
    next(err);
  }
});
