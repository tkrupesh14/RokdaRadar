import { getPool, type Executor } from "../client.js";
import type { SpendRow } from "../../types/domain.js";

export async function insertSpend(row: Omit<SpendRow, "delivery_attested">, exec: Executor = getPool()): Promise<void> {
  await exec.query(
    `INSERT INTO spends
       (spend_ref, campaign_id, utr_hash, vendor_ref, amount_paise, category, evidence_cid, memo, ts, tx_hash, delivery_attested)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
     ON CONFLICT (spend_ref) DO NOTHING`,
    [
      row.spend_ref,
      row.campaign_id,
      row.utr_hash,
      row.vendor_ref,
      row.amount_paise,
      row.category,
      row.evidence_cid,
      row.memo,
      row.ts,
      row.tx_hash,
    ]
  );
}

export async function markDeliveryAttested(spendRef: string, exec: Executor = getPool()): Promise<void> {
  await exec.query(`UPDATE spends SET delivery_attested = 1 WHERE spend_ref = $1`, [spendRef]);
}

export async function getSpend(spendRef: string, exec: Executor = getPool()): Promise<SpendRow | undefined> {
  const result = await exec.query(`SELECT * FROM spends WHERE spend_ref = $1`, [spendRef]);
  return result.rows[0] as SpendRow | undefined;
}

export async function listSpendsByCampaign(campaignId: number, exec: Executor = getPool()): Promise<SpendRow[]> {
  const result = await exec.query(`SELECT * FROM spends WHERE campaign_id = $1 ORDER BY ts`, [campaignId]);
  return result.rows as SpendRow[];
}

export async function countSpends(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(`SELECT COUNT(*) as n FROM spends WHERE campaign_id = $1`, [campaignId]);
  return Number(result.rows[0].n);
}

export async function countDeliveryAttestedSpends(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(
    `SELECT COUNT(*) as n FROM spends WHERE campaign_id = $1 AND delivery_attested = 1`,
    [campaignId]
  );
  return Number(result.rows[0].n);
}

// Trust score's evidencedSpendPct (LLD Section 8) is amount-weighted, not
// count-weighted -- one large undocumented spend should move the score more
// than several small ones. evidence_cid is NOT NULL at the schema level
// (every confirmed spend has one, since attestSpend() reverts without it --
// contracts/contracts/ReliefTraceIN.sol), so this is a genuine query, not a
// hardcoded 100: it'll still work correctly if that contract invariant ever
// loosens.
export async function evidencedSpendPaise(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(
    `SELECT COALESCE(SUM(amount_paise), 0) as total FROM spends WHERE campaign_id = $1 AND evidence_cid != ''`,
    [campaignId]
  );
  return Number(result.rows[0].total);
}

export async function categorySplit(campaignId: number, exec: Executor = getPool()): Promise<Record<string, number>> {
  const result = await exec.query(
    `SELECT category, SUM(amount_paise) as total FROM spends WHERE campaign_id = $1 GROUP BY category`,
    [campaignId]
  );
  const out: Record<string, number> = {};
  for (const r of result.rows as { category: string; total: number }[]) out[r.category] = r.total;
  return out;
}

export async function vendorTotals(
  campaignId: number,
  exec: Executor = getPool()
): Promise<{ vendor_ref: string; total: number; count: number }[]> {
  const result = await exec.query(
    `SELECT vendor_ref, SUM(amount_paise) as total, COUNT(*) as count
     FROM spends WHERE campaign_id = $1 GROUP BY vendor_ref ORDER BY total DESC`,
    [campaignId]
  );
  return result.rows as { vendor_ref: string; total: number; count: number }[];
}
