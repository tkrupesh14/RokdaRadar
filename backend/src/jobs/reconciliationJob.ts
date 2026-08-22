import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { getPool } from "../db/client.js";
import { migrate } from "../db/migrate.js";
import { listActiveCampaignIds } from "../db/repositories/campaignsRepo.js";
import { countDonations } from "../db/repositories/donationsRepo.js";
import { countSpends } from "../db/repositories/spendsRepo.js";
import {
  countMatchedDonations,
  countMatchedSpends,
  countStatementLines,
  insertStatementLines,
  matchDonation,
  matchSpend,
  unmatchedCreditLines,
  unmatchedDebitLines,
  unmatchedDonations,
  unmatchedSpends,
  type NewStatementLine,
} from "../db/repositories/reconciliationRepo.js";
import type { ReconciliationFlag, ReconciliationSummary } from "../types/domain.js";

export type BankStatementRow = {
  direction: "credit" | "debit";
  /** Raw UTR from the statement. Only meaningful for credit rows -- see reconciliationRepo.ts's schema comment on why debit rows can't be UTR-matched yet. Hashed immediately, never persisted raw (same rule as everywhere else raw UTRs pass through this codebase). */
  utr: string | null;
  amountPaise: number;
  txnDate: string;
};

// Simple CSV: header `date,type,utr,amountPaise`. type is credit|debit
// (case-insensitive); utr may be blank for debit rows (it isn't used for
// those anyway). No quoted-field handling -- a bank statement export at this
// scale doesn't need it, and adding a full CSV parser for one column shape
// isn't worth a new dependency.
export function parseBankStatementCsv(csv: string): BankStatementRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const dateIdx = header.indexOf("date");
  const typeIdx = header.indexOf("type");
  const utrIdx = header.indexOf("utr");
  const amountIdx = header.indexOf("amountpaise");
  if (dateIdx === -1 || typeIdx === -1 || utrIdx === -1 || amountIdx === -1) {
    throw new Error("bank statement CSV must have columns: date,type,utr,amountPaise");
  }

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim());
    const direction = cols[typeIdx]?.toLowerCase();
    if (direction !== "credit" && direction !== "debit") {
      throw new Error(`row ${i + 2}: type must be "credit" or "debit", got "${cols[typeIdx]}"`);
    }
    const amountPaise = Number(cols[amountIdx]);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new Error(`row ${i + 2}: amountPaise must be a positive number, got "${cols[amountIdx]}"`);
    }
    return {
      direction,
      utr: cols[utrIdx] || null,
      amountPaise,
      txnDate: cols[dateIdx],
    };
  });
}

export async function importStatementLines(campaignId: number, rows: BankStatementRow[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const lines: NewStatementLine[] = rows.map((r) => ({
    campaign_id: campaignId,
    direction: r.direction,
    // Raw UTR is hashed immediately and never persisted (LLD 7.1 step 3's
    // rule applied here too) -- keccak256 so it's directly comparable to
    // donations.utr_hash, which is hashed the same way.
    utr_hash: r.utr ? ethers.keccak256(ethers.toUtf8Bytes(r.utr)) : null,
    amount_paise: r.amountPaise,
    txn_date: r.txnDate,
    imported_at: now,
  }));
  await insertStatementLines(lines);
}

// Idempotent: safe to call repeatedly (e.g. nightly) -- only touches rows
// that are still unmatched, so already-matched lines/donations/spends are
// left alone. Runs both directions per LLD 7.2:
//   - credit lines <-> donations, matched exactly by utr_hash
//   - debit lines <-> spends, matched by amount_paise (best-effort: spends
//     don't carry a real settlement UTR yet, see reconciliationRepo.ts)
export async function runReconciliation(campaignId: number): Promise<ReconciliationSummary> {
  const pool = getPool();

  const creditLines = await unmatchedCreditLines(campaignId, pool);
  const donationPool = await unmatchedDonations(campaignId, pool);
  const donationsByUtr = new Map(donationPool.map((d) => [d.utr_hash, d]));
  for (const line of creditLines) {
    if (!line.utr_hash) continue;
    const donation = donationsByUtr.get(line.utr_hash);
    if (!donation) continue;
    await matchDonation(line.id, donation.id, pool);
    donationsByUtr.delete(line.utr_hash); // consume: one line can't match two donations
  }

  const debitLines = await unmatchedDebitLines(campaignId, pool);
  const spendPool = await unmatchedSpends(campaignId, pool);
  for (const line of debitLines) {
    const idx = spendPool.findIndex((s) => s.amount_paise === line.amount_paise);
    if (idx === -1) continue;
    const spend = spendPool[idx];
    await matchSpend(line.id, spend.spend_ref, pool);
    spendPool.splice(idx, 1); // consume: one line can't match two spends
  }

  const [statementLineCount, matchedDonationCount, totalDonationCount, matchedSpendCount, totalSpendCount] = await Promise.all([
    countStatementLines(campaignId, pool),
    countMatchedDonations(campaignId, pool),
    countDonations(campaignId, pool),
    countMatchedSpends(campaignId, pool),
    countSpends(campaignId, pool),
  ]);

  const flags: ReconciliationFlag[] = [];
  for (const line of await unmatchedCreditLines(campaignId, pool)) {
    flags.push({ direction: "credit", reason: "unattested_inbound", amountPaise: line.amount_paise, ref: String(line.id) });
  }
  for (const line of await unmatchedDebitLines(campaignId, pool)) {
    flags.push({ direction: "debit", reason: "unattested_outbound", amountPaise: line.amount_paise, ref: String(line.id) });
  }
  for (const donation of await unmatchedDonations(campaignId, pool)) {
    flags.push({ direction: "credit", reason: "unbacked_donation", amountPaise: donation.amount_paise, ref: String(donation.id) });
  }
  for (const spend of await unmatchedSpends(campaignId, pool)) {
    flags.push({ direction: "debit", reason: "unbacked_spend", amountPaise: spend.amount_paise, ref: spend.spend_ref });
  }

  const totalRecords = totalDonationCount + totalSpendCount;
  const reconciliationMatchPct =
    totalRecords > 0 ? Number((((matchedDonationCount + matchedSpendCount) / totalRecords) * 100).toFixed(1)) : 0;

  return {
    campaignId,
    statementLineCount,
    matchedDonationCount,
    totalDonationCount,
    matchedSpendCount,
    totalSpendCount,
    reconciliationMatchPct,
    flags,
  };
}

// Entry point for a scheduled nightly run (LLD 7.2) -- re-runs matching for
// every active campaign against whatever statement lines have been imported
// so far. Doesn't import anything itself (that's the manager-gated
// POST /api/campaigns/:id/reconciliation/import endpoint); this just
// re-attempts matching, which matters when e.g. a spend gets attested after
// its statement line was already imported.
export async function runNightlyReconciliation(): Promise<ReconciliationSummary[]> {
  const campaignIds = await listActiveCampaignIds();
  const summaries: ReconciliationSummary[] = [];
  for (const id of campaignIds) {
    summaries.push(await runReconciliation(id));
  }
  return summaries;
}

// Allow `npm run reconcile:nightly` to invoke this directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await migrate();
  runNightlyReconciliation()
    .then((summaries) => {
      for (const s of summaries) {
        console.log(
          `campaign ${s.campaignId}: ${s.reconciliationMatchPct}% matched (${s.flags.length} flags)`
        );
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
