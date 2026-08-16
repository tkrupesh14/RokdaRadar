import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

function openDb(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = openDb(env.DB_PATH);
  }
  return dbInstance;
}

// Test-only escape hatch: point the singleton at a throwaway DB file so each
// test file gets an isolated database without touching the real data/ dir.
export function resetDbForTests(dbPath: string): Database.Database {
  if (dbInstance) dbInstance.close();
  dbInstance = openDb(dbPath);
  return dbInstance;
}
