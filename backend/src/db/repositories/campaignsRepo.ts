import { getDb } from "../client.js";
import type { CampaignRow } from "../../types/domain.js";

export function insertCampaign(row: Omit<CampaignRow, "raised_paise" | "spent_paise" | "active">): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO campaigns
         (id, operator, disaster_tag, darpan_id, reg_80g, promise_hash, raised_paise, spent_paise, active, created_at, creation_tx_hash)
       VALUES (@id, @operator, @disaster_tag, @darpan_id, @reg_80g, @promise_hash, 0, 0, 1, @created_at, @creation_tx_hash)`
    )
    .run(row);
}

export function incrementRaised(campaignId: number, amountPaise: number): void {
  getDb()
    .prepare(`UPDATE campaigns SET raised_paise = raised_paise + ? WHERE id = ?`)
    .run(amountPaise, campaignId);
}

export function incrementSpent(campaignId: number, amountPaise: number): void {
  getDb()
    .prepare(`UPDATE campaigns SET spent_paise = spent_paise + ? WHERE id = ?`)
    .run(amountPaise, campaignId);
}

export function deactivateCampaign(campaignId: number): void {
  getDb().prepare(`UPDATE campaigns SET active = 0 WHERE id = ?`).run(campaignId);
}

export function getCampaign(campaignId: number): CampaignRow | undefined {
  return getDb().prepare(`SELECT * FROM campaigns WHERE id = ?`).get(campaignId) as CampaignRow | undefined;
}

export function listCampaigns(): CampaignRow[] {
  return getDb().prepare(`SELECT * FROM campaigns ORDER BY id`).all() as CampaignRow[];
}
