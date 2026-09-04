import { getPool } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

// Postgres (Supabase) is shared, not a throwaway per-test file like the old
// SQLite setup -- so instead of creating a new DB, each test file truncates
// every table before running. getPool() (src/db/client.ts) transparently
// points this at TEST_DATABASE_URL under NODE_ENV=test and refuses to run at
// all if that isn't set to something other than DATABASE_URL -- this must
// never run against the same database the dev server reads from.
let migrated = false;

export async function freshTestDb(): Promise<void> {
  const pool = getPool();
  if (!migrated) {
    await migrate();
    migrated = true;
  }
  await pool.query(
    `TRUNCATE TABLE processed_events, delivery_attestations, pending_spends, bank_statement_lines, spends, donations, campaigns, indexer_state RESTART IDENTITY CASCADE`
  );
}
