import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { getCampaign, listCampaigns } from "../db/repositories/campaignsRepo.js";
import { getOperatorContract } from "../chain/contractClient.js";
import { verifySignedRequest } from "../auth/operatorSignature.js";

export const campaignsRouter = Router();

const createCampaignSchema = z.object({
  oracleAddress: z.string(),
  disasterTag: z.string().min(1),
  darpanId: z.string().min(1),
  reg80G: z.string().min(1),
  promiseText: z.string().min(1),
  auth: z.object({
    address: z.string(),
    nonce: z.string(),
    timestamp: z.number(),
    signature: z.string(),
  }),
});

/**
 * @openapi
 * /api/campaigns:
 *   post:
 *     summary: Create a campaign
 *     tags: [Campaigns]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCampaignRequest'
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateCampaignResponse'
 *       401:
 *         description: Operator signature invalid
 *       422:
 *         description: Contract reverted
 */
campaignsRouter.post("/api/campaigns", async (req, res, next) => {
  try {
    const body = createCampaignSchema.parse(req.body);

    const authCheck = verifySignedRequest("POST /api/campaigns", null, body.auth);
    if (!authCheck.ok) {
      res.status(401).json({ error: "UNAUTHORIZED", detail: authCheck.reason });
      return;
    }

    const promiseHash = ethers.keccak256(ethers.toUtf8Bytes(body.promiseText));
    const contract = getOperatorContract();

    let tx;
    try {
      tx = await contract.createCampaign(body.oracleAddress, body.disasterTag, body.darpanId, body.reg80G, promiseHash);
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
      txHash: receipt.hash,
      status: "confirmed",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/campaigns/{id}:
 *   get:
 *     summary: Campaign metadata
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Campaign metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Campaign'
 *       404:
 *         description: Campaign not found
 */
campaignsRouter.get("/api/campaigns/:id", async (req, res) => {
  const id = Number(req.params.id);
  const campaign = await getCampaign(id);
  if (!campaign) {
    res.status(404).json({ error: "NOT_FOUND", detail: `campaign ${id} not found` });
    return;
  }
  res.json({
    campaignId: campaign.id,
    operator: campaign.operator,
    disasterTag: campaign.disaster_tag,
    darpanId: campaign.darpan_id,
    reg80G: campaign.reg_80g,
    promiseHash: campaign.promise_hash,
    raisedPaise: campaign.raised_paise,
    spentPaise: campaign.spent_paise,
    active: Boolean(campaign.active),
    createdAt: campaign.created_at,
  });
});

/**
 * @openapi
 * /api/campaigns:
 *   get:
 *     summary: List all campaigns
 *     tags: [Campaigns]
 *     responses:
 *       200:
 *         description: List of campaigns
 */
campaignsRouter.get("/api/campaigns", async (_req, res) => {
  const campaigns = (await listCampaigns()).map((c) => ({
    campaignId: c.id,
    operator: c.operator,
    disasterTag: c.disaster_tag,
    raisedPaise: c.raised_paise,
    spentPaise: c.spent_paise,
    active: Boolean(c.active),
  }));
  res.json({ campaigns });
});
