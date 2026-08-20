import { getPool, type Executor } from "../client.js";
import type { CampaignRow } from "../../types/domain.js";

export async function insertCampaign(
  row: Omit<CampaignRow, "raised_paise" | "spent_paise" | "active">,
  exec: Executor = getPool()
): Promise<void> {
  await exec.query(
    `INSERT INTO campaigns
       (id, operator, disaster_tag, darpan_id, reg_80g, promise_hash, raised_paise, spent_paise, active, created_at, creation_tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 1, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [row.id, row.operator, row.disaster_tag, row.darpan_id, row.reg_80g, row.promise_hash, row.created_at, row.creation_tx_hash]
  );
}

export async function incrementRaised(campaignId: number, amountPaise: number, exec: Executor = getPool()): Promise<void> {
  await exec.query(`UPDATE campaigns SET raised_paise = raised_paise + $1 WHERE id = $2`, [amountPaise, campaignId]);
}

export async function incrementSpent(campaignId: number, amountPaise: number, exec: Executor = getPool()): Promise<void> {
  await exec.query(`UPDATE campaigns SET spent_paise = spent_paise + $1 WHERE id = $2`, [amountPaise, campaignId]);
}

export async function deactivateCampaign(campaignId: number, exec: Executor = getPool()): Promise<void> {
  await exec.query(`UPDATE campaigns SET active = 0 WHERE id = $1`, [campaignId]);
}

export async function getCampaign(campaignId: number, exec: Executor = getPool()): Promise<CampaignRow | undefined> {
  const result = await exec.query(`SELECT * FROM campaigns WHERE id = $1`, [campaignId]);
  return result.rows[0] as CampaignRow | undefined;
}

export async function listCampaigns(exec: Executor = getPool()): Promise<CampaignRow[]> {
  const result = await exec.query(`SELECT * FROM campaigns ORDER BY id`);
  return result.rows as CampaignRow[];
}
