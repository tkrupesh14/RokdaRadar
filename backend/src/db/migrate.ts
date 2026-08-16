import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { getDb } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function migrate(db: Database.Database = getDb()): void {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
}

// Allow `npm run db:migrate` to invoke this directly.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate();
  console.log("Migration applied.");
}
