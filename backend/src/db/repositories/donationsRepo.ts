import { getPool, type Executor } from "../client.js";
import type { DonationRow } from "../../types/domain.js";

export async function insertDonation(row: Omit<DonationRow, "id">, exec: Executor = getPool()): Promise<void> {
  await exec.query(
    `INSERT INTO donations (campaign_id, utr_hash, donor_ref, amount_paise, ts, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (utr_hash) DO NOTHING`,
    [row.campaign_id, row.utr_hash, row.donor_ref, row.amount_paise, row.ts, row.tx_hash]
  );
}

export async function listDonationsByCampaign(campaignId: number, exec: Executor = getPool()): Promise<DonationRow[]> {
  const result = await exec.query(`SELECT * FROM donations WHERE campaign_id = $1 ORDER BY ts`, [campaignId]);
  return result.rows as DonationRow[];
}

export async function countDonations(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(`SELECT COUNT(*) as n FROM donations WHERE campaign_id = $1`, [campaignId]);
  return Number(result.rows[0].n);
}

export async function medianDonationPaise(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(
    `SELECT amount_paise FROM donations WHERE campaign_id = $1 ORDER BY amount_paise`,
    [campaignId]
  );
  const rows = result.rows as { amount_paise: number }[];
  if (rows.length === 0) return 0;
  const mid = Math.floor(rows.length / 2);
  if (rows.length % 2 === 0) {
    return (rows[mid - 1].amount_paise + rows[mid].amount_paise) / 2;
  }
  return rows[mid].amount_paise;
}

export async function firstDonationTs(campaignId: number, exec: Executor = getPool()): Promise<number | null> {
  const result = await exec.query(`SELECT MIN(ts) as ts FROM donations WHERE campaign_id = $1`, [campaignId]);
  const row = result.rows[0] as { ts: number | null } | undefined;
  return row?.ts ?? null;
}
