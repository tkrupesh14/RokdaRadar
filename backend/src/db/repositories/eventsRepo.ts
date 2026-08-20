import { getPool, type Executor } from "../client.js";

// Returns true if this (txHash, logIndex) has already been applied, inserting
// it into the ledger as a side effect if not. Callers must run this inside the
// same Postgres transaction as the domain write it guards (pass the same
// client through as `exec`).
export async function markProcessedIfNew(txHash: string, logIndex: number, exec: Executor = getPool()): Promise<boolean> {
  const result = await exec.query(
    `INSERT INTO processed_events (tx_hash, log_index) VALUES ($1, $2) ON CONFLICT (tx_hash, log_index) DO NOTHING`,
    [txHash, logIndex]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getLastProcessedBlock(exec: Executor = getPool()): Promise<number | null> {
  const result = await exec.query(`SELECT value FROM indexer_state WHERE key = 'last_processed_block'`);
  const row = result.rows[0] as { value: string } | undefined;
  return row ? Number(row.value) : null;
}

export async function setLastProcessedBlock(blockNumber: number, exec: Executor = getPool()): Promise<void> {
  await exec.query(
    `INSERT INTO indexer_state (key, value) VALUES ('last_processed_block', $1)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [String(blockNumber)]
  );
}
