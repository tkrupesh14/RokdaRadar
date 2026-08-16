import { getDb } from "../client.js";
import type { SpendRow } from "../../types/domain.js";

export function insertSpend(row: Omit<SpendRow, "delivery_attested">): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO spends
         (spend_ref, campaign_id, utr_hash, vendor_ref, amount_paise, category, evidence_cid, memo, ts, tx_hash, delivery_attested)
       VALUES (@spend_ref, @campaign_id, @utr_hash, @vendor_ref, @amount_paise, @category, @evidence_cid, @memo, @ts, @tx_hash, 0)`
    )
    .run(row);
}

export function markDeliveryAttested(spendRef: string): void {
  getDb().prepare(`UPDATE spends SET delivery_attested = 1 WHERE spend_ref = ?`).run(spendRef);
}

export function getSpend(spendRef: string): SpendRow | undefined {
  return getDb().prepare(`SELECT * FROM spends WHERE spend_ref = ?`).get(spendRef) as SpendRow | undefined;
}

export function listSpendsByCampaign(campaignId: number): SpendRow[] {
  return getDb()
    .prepare(`SELECT * FROM spends WHERE campaign_id = ? ORDER BY ts`)
    .all(campaignId) as SpendRow[];
}

export function countSpends(campaignId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM spends WHERE campaign_id = ?`)
    .get(campaignId) as { n: number };
  return row.n;
}

export function countDeliveryAttestedSpends(campaignId: number): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM spends WHERE campaign_id = ? AND delivery_attested = 1`)
    .get(campaignId) as { n: number };
  return row.n;
}

export function categorySplit(campaignId: number): Record<string, number> {
  const rows = getDb()
    .prepare(`SELECT category, SUM(amount_paise) as total FROM spends WHERE campaign_id = ? GROUP BY category`)
    .all(campaignId) as { category: string; total: number }[];
  const result: Record<string, number> = {};
  for (const r of rows) result[r.category] = r.total;
  return result;
}

export function vendorTotals(campaignId: number): { vendor_ref: string; total: number; count: number }[] {
  return getDb()
    .prepare(
      `SELECT vendor_ref, SUM(amount_paise) as total, COUNT(*) as count
       FROM spends WHERE campaign_id = ? GROUP BY vendor_ref ORDER BY total DESC`
    )
    .all(campaignId) as { vendor_ref: string; total: number; count: number }[];
}
