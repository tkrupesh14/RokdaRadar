import { getDb } from "../client.js";
import type { DonationRow } from "../../types/domain.js";

export function insertDonation(row: Omit<DonationRow, "id">): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO donations (campaign_id, utr_hash, donor_ref, amount_paise, ts, tx_hash)
       VALUES (@campaign_id, @utr_hash, @donor_ref, @amount_paise, @ts, @tx_hash)`
    )
    .run(row);
}

export function listDonationsByCampaign(campaignId: number): DonationRow[] {
  return getDb()
    .prepare(`SELECT * FROM donations WHERE campaign_id = ? ORDER BY ts`)
    .all(campaignId) as DonationRow[];
}

export function countDonations(campaignId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM donations WHERE campaign_id = ?`)
    .get(campaignId) as { n: number };
  return row.n;
}

export function medianDonationPaise(campaignId: number): number {
  const rows = getDb()
    .prepare(`SELECT amount_paise FROM donations WHERE campaign_id = ? ORDER BY amount_paise`)
    .all(campaignId) as { amount_paise: number }[];
  if (rows.length === 0) return 0;
  const mid = Math.floor(rows.length / 2);
  if (rows.length % 2 === 0) {
    return (rows[mid - 1].amount_paise + rows[mid].amount_paise) / 2;
  }
  return rows[mid].amount_paise;
}

export function firstDonationTs(campaignId: number): number | null {
  const row = getDb()
    .prepare(`SELECT MIN(ts) as ts FROM donations WHERE campaign_id = ?`)
    .get(campaignId) as { ts: number | null };
  return row.ts ?? null;
}
