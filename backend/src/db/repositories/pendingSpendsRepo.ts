import { getPool, type Executor } from "../client.js";
import type { CategoryName } from "../../config/constants.js";

// "ai_rejected" is a terminal state assigned at insert time (never goes
// through manager review) -- the AI screen already decided, but the record
// (including the evidence file, retained rather than discarded) stays as
// proof of what was submitted and by whom, same as a manager's "rejected".
export type PendingSpendStatus = "pending" | "approved" | "rejected" | "ai_rejected";

export type PendingSpendRow = {
  id: number;
  campaign_id: number;
  vendor_ref_hash: string;
  amount_paise: number;
  category: CategoryName;
  memo: string | null;
  evidence_cid: string;
  evidence_mimetype: string;
  ai_reason: string | null;
  status: PendingSpendStatus;
  operator_address: string;
  submitted_at: number;
  reviewed_at: number | null;
  reviewer_address: string | null;
  review_note: string | null;
  tx_hash: string | null;
};

export type NewPendingSpend = {
  campaign_id: number;
  vendor_ref_hash: string;
  amount_paise: number;
  category: CategoryName;
  memo: string | null;
  evidence_cid: string;
  evidence_mimetype: string;
  ai_reason: string | null;
  operator_address: string;
  submitted_at: number;
};

export async function insertPendingSpend(row: NewPendingSpend, exec: Executor = getPool()): Promise<number> {
  const result = await exec.query(
    `INSERT INTO pending_spends
       (campaign_id, vendor_ref_hash, amount_paise, category, memo, evidence_cid, evidence_mimetype, ai_reason, operator_address, submitted_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
     RETURNING id`,
    [
      row.campaign_id,
      row.vendor_ref_hash,
      row.amount_paise,
      row.category,
      row.memo,
      row.evidence_cid,
      row.evidence_mimetype,
      row.ai_reason,
      row.operator_address,
      row.submitted_at,
    ]
  );
  return result.rows[0].id as number;
}

// Evidence the AI screen rejected as not a bill/receipt: recorded (not
// discarded) as fraud-attempt evidence -- same table, terminal status set at
// insert time since there's nothing for a manager to review. reviewer_address
// is set to a synthetic "ai:gemini" marker so this reads consistently
// alongside human-reviewed rows in the same audit trail.
export async function insertAiRejectedSpend(row: NewPendingSpend, exec: Executor = getPool()): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await exec.query(
    `INSERT INTO pending_spends
       (campaign_id, vendor_ref_hash, amount_paise, category, memo, evidence_cid, evidence_mimetype, ai_reason, operator_address, submitted_at, status, reviewed_at, reviewer_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ai_rejected',$11,'ai:gemini')
     RETURNING id`,
    [
      row.campaign_id,
      row.vendor_ref_hash,
      row.amount_paise,
      row.category,
      row.memo,
      row.evidence_cid,
      row.evidence_mimetype,
      row.ai_reason,
      row.operator_address,
      row.submitted_at,
      now,
    ]
  );
  return result.rows[0].id as number;
}

export async function getPendingSpend(id: number, exec: Executor = getPool()): Promise<PendingSpendRow | undefined> {
  const result = await exec.query(`SELECT * FROM pending_spends WHERE id = $1`, [id]);
  return result.rows[0] as PendingSpendRow | undefined;
}

export async function listPendingSpends(campaignId: number, exec: Executor = getPool()): Promise<PendingSpendRow[]> {
  const result = await exec.query(
    `SELECT * FROM pending_spends WHERE campaign_id = $1 AND status = 'pending' ORDER BY submitted_at`,
    [campaignId]
  );
  return result.rows as PendingSpendRow[];
}

// Fraud-audit view: everything the AI screen or a manager has rejected for
// this campaign (or, with no filter, every reviewed/rejected/pending record),
// each still carrying its evidenceCID -- the file itself is never deleted on
// rejection (see evidence/storage.ts), so this plus evidenceCID is the full
// proof trail for a submission that was flagged as fraudulent.
export async function listSpendsByStatus(
  campaignId: number,
  statuses: PendingSpendStatus[],
  exec: Executor = getPool()
): Promise<PendingSpendRow[]> {
  const result = await exec.query(
    `SELECT * FROM pending_spends WHERE campaign_id = $1 AND status = ANY($2::text[]) ORDER BY submitted_at DESC`,
    [campaignId, statuses]
  );
  return result.rows as PendingSpendRow[];
}

export async function markApproved(
  id: number,
  reviewerAddress: string,
  note: string | null,
  txHash: string,
  exec: Executor = getPool()
): Promise<void> {
  await exec.query(
    `UPDATE pending_spends SET status = 'approved', reviewed_at = $2, reviewer_address = $3, review_note = $4, tx_hash = $5 WHERE id = $1`,
    [id, Math.floor(Date.now() / 1000), reviewerAddress, note, txHash]
  );
}

export async function markRejected(
  id: number,
  reviewerAddress: string,
  note: string | null,
  exec: Executor = getPool()
): Promise<void> {
  await exec.query(
    `UPDATE pending_spends SET status = 'rejected', reviewed_at = $2, reviewer_address = $3, review_note = $4 WHERE id = $1`,
    [id, Math.floor(Date.now() / 1000), reviewerAddress, note]
  );
}
