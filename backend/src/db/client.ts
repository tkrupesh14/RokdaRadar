import pg from "pg";
import { env } from "../config/env.js";

const { Pool, types } = pg;

// pg returns BIGINT (OID 20) and NUMERIC/SUM results (OID 1700) as strings by
// default, to avoid silent precision loss on values outside JS's safe integer
// range. Every amount/timestamp column here comfortably fits in a JS number,
// and the rest of this codebase (ported from better-sqlite3, which always
// returned numbers) assumes that too, so parse both back to numbers here
// once rather than at every call site.
types.setTypeParser(20, (val: string) => Number(val));
types.setTypeParser(1700, (val: string) => Number(val));

// Anything that can run a parameterized query: the pool itself, or a single
// checked-out client mid-transaction. Repositories accept this so the same
// query function works standalone or nested inside withTransaction().
export type Executor = Pick<pg.Pool | pg.PoolClient, "query">;

let poolInstance: pg.Pool | null = null;
let testPoolInstance: pg.Pool | null = null;

function makePool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    // Supabase (and most hosted Postgres) requires TLS on external
    // connections; rejectUnauthorized: false accepts their cert chain
    // without needing the CA bundle installed locally.
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
}

// Under NODE_ENV=test (vitest sets this by default), every caller of
// getPool() -- app code and tests alike -- is transparently redirected to a
// physically separate database, because test/testDb.ts TRUNCATEs every
// table before each test file runs. Running that against DATABASE_URL would
// (and once did) silently destroy real data. This throws rather than
// silently falling back to DATABASE_URL, so that mistake fails loudly at
// the first test instead of quietly wiping whatever's live.
function getTestPool(): pg.Pool {
  if (!testPoolInstance) {
    if (!env.TEST_DATABASE_URL) {
      throw new Error(
        "TEST_DATABASE_URL is not set. Tests must run against a separate database from DATABASE_URL -- " +
          "point it at a second Supabase project (or any scratch Postgres instance) in backend/.env."
      );
    }
    if (env.TEST_DATABASE_URL === env.DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL must not be the same as DATABASE_URL -- this would truncate real data.");
    }
    testPoolInstance = makePool(env.TEST_DATABASE_URL);
  }
  return testPoolInstance;
}

export function getPool(): pg.Pool {
  if (env.NODE_ENV === "test") {
    return getTestPool();
  }
  if (!poolInstance) {
    poolInstance = makePool(env.DATABASE_URL);
  }
  return poolInstance;
}

// Every indexer event handler needs the processed_events idempotency check
// and its domain write to commit atomically (LLD 3.3), so this checks out a
// single client for the whole callback rather than using the pool directly.
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
