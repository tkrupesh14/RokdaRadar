import { getPool, type Executor } from "../client.js";
import type { BankStatementLineRow } from "../../types/domain.js";

export type NewStatementLine = {
  campaign_id: number;
  direction: "credit" | "debit";
  utr_hash: string | null;
  amount_paise: number;
  txn_date: string;
  imported_at: number;
};

export async function insertStatementLines(lines: NewStatementLine[], exec: Executor = getPool()): Promise<void> {
  for (const line of lines) {
    await exec.query(
      `INSERT INTO bank_statement_lines (campaign_id, direction, utr_hash, amount_paise, txn_date, imported_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [line.campaign_id, line.direction, line.utr_hash, line.amount_paise, line.txn_date, line.imported_at]
    );
  }
}

export async function listStatementLines(campaignId: number, exec: Executor = getPool()): Promise<BankStatementLineRow[]> {
  const result = await exec.query(`SELECT * FROM bank_statement_lines WHERE campaign_id = $1 ORDER BY txn_date`, [campaignId]);
  return result.rows as BankStatementLineRow[];
}

export async function unmatchedCreditLines(campaignId: number, exec: Executor = getPool()): Promise<BankStatementLineRow[]> {
  const result = await exec.query(
    `SELECT * FROM bank_statement_lines
     WHERE campaign_id = $1 AND direction = 'credit' AND matched_donation_id IS NULL
     ORDER BY id`,
    [campaignId]
  );
  return result.rows as BankStatementLineRow[];
}

export async function unmatchedDebitLines(campaignId: number, exec: Executor = getPool()): Promise<BankStatementLineRow[]> {
  const result = await exec.query(
    `SELECT * FROM bank_statement_lines
     WHERE campaign_id = $1 AND direction = 'debit' AND matched_spend_ref IS NULL
     ORDER BY id`,
    [campaignId]
  );
  return result.rows as BankStatementLineRow[];
}

// Donations with no credit statement line matched to them yet -- either the
// bank statement hasn't been imported yet, or (if it has) this is a real
// "attested but no matching bank transaction" flag.
export async function unmatchedDonations(
  campaignId: number,
  exec: Executor = getPool()
): Promise<{ id: number; utr_hash: string; amount_paise: number }[]> {
  const result = await exec.query(
    `SELECT d.id, d.utr_hash, d.amount_paise FROM donations d
     WHERE d.campaign_id = $1
       AND NOT EXISTS (SELECT 1 FROM bank_statement_lines b WHERE b.matched_donation_id = d.id)
     ORDER BY d.id`,
    [campaignId]
  );
  return result.rows;
}

export async function unmatchedSpends(
  campaignId: number,
  exec: Executor = getPool()
): Promise<{ spend_ref: string; amount_paise: number }[]> {
  const result = await exec.query(
    `SELECT s.spend_ref, s.amount_paise FROM spends s
     WHERE s.campaign_id = $1
       AND NOT EXISTS (SELECT 1 FROM bank_statement_lines b WHERE b.matched_spend_ref = s.spend_ref)
     ORDER BY s.spend_ref`,
    [campaignId]
  );
  return result.rows;
}

export async function matchDonation(lineId: number, donationId: number, exec: Executor = getPool()): Promise<void> {
  await exec.query(`UPDATE bank_statement_lines SET matched_donation_id = $2 WHERE id = $1`, [lineId, donationId]);
}

export async function matchSpend(lineId: number, spendRef: string, exec: Executor = getPool()): Promise<void> {
  await exec.query(`UPDATE bank_statement_lines SET matched_spend_ref = $2 WHERE id = $1`, [lineId, spendRef]);
}

export async function countStatementLines(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(`SELECT COUNT(*) as n FROM bank_statement_lines WHERE campaign_id = $1`, [campaignId]);
  return Number(result.rows[0].n);
}

// DISTINCT matters here (not just row count): a duplicate/erroneous
// statement line sharing another line's utr_hash would otherwise inflate
// this past the number of donations actually backed by a real transaction.
export async function countMatchedDonations(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(
    `SELECT COUNT(DISTINCT matched_donation_id) as n FROM bank_statement_lines
     WHERE campaign_id = $1 AND direction = 'credit' AND matched_donation_id IS NOT NULL`,
    [campaignId]
  );
  return Number(result.rows[0].n);
}

export async function countMatchedSpends(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(
    `SELECT COUNT(DISTINCT matched_spend_ref) as n FROM bank_statement_lines
     WHERE campaign_id = $1 AND direction = 'debit' AND matched_spend_ref IS NOT NULL`,
    [campaignId]
  );
  return Number(result.rows[0].n);
}

// Read-only: reports the match rate as of the last time runReconciliation()
// actually ran (on import, or the nightly job) -- doesn't attempt any new
// matching itself. Used by the trust score, which is computed on every read
// (see indexer/aggregate.ts) and must not perform writes as a side effect of
// a GET request.
export async function reconciliationMatchPct(campaignId: number, exec: Executor = getPool()): Promise<number> {
  const [matchedDonations, totalDonations, matchedSpends, totalSpends] = await Promise.all([
    countMatchedDonations(campaignId, exec),
    exec.query(`SELECT COUNT(*) as n FROM donations WHERE campaign_id = $1`, [campaignId]).then((r) => Number(r.rows[0].n)),
    countMatchedSpends(campaignId, exec),
    exec.query(`SELECT COUNT(*) as n FROM spends WHERE campaign_id = $1`, [campaignId]).then((r) => Number(r.rows[0].n)),
  ]);
  const total = totalDonations + totalSpends;
  return total > 0 ? Number((((matchedDonations + matchedSpends) / total) * 100).toFixed(1)) : 0;
}
