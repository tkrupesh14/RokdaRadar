import { getDb } from "../client.js";

// Returns true if this (txHash, logIndex) has already been applied, inserting
// it into the ledger as a side effect if not. Callers must run this inside the
// same better-sqlite3 transaction as the domain write it guards.
export function markProcessedIfNew(txHash: string, logIndex: number): boolean {
  const result = getDb()
    .prepare(`INSERT OR IGNORE INTO processed_events (tx_hash, log_index) VALUES (?, ?)`)
    .run(txHash, logIndex);
  return result.changes > 0;
}

export function getLastProcessedBlock(): number | null {
  const row = getDb()
    .prepare(`SELECT value FROM indexer_state WHERE key = 'last_processed_block'`)
    .get() as { value: string } | undefined;
  return row ? Number(row.value) : null;
}

export function setLastProcessedBlock(blockNumber: number): void {
  getDb()
    .prepare(
      `INSERT INTO indexer_state (key, value) VALUES ('last_processed_block', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(String(blockNumber));
}
