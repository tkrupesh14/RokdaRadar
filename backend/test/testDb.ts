import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetDbForTests } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

// Each test file gets an isolated throwaway SQLite file so tests never touch
// the real data/ dir and can run fully in parallel without secrets.
export function freshTestDb() {
  const dbPath = path.join(os.tmpdir(), `relieftrace-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
  const db = resetDbForTests(dbPath);
  migrate(db);
  return db;
}
