import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    exclude: ["contracts/**"],
    testTimeout: 30000,
    // Test files now share one live Postgres DB (Supabase) instead of each
    // getting its own throwaway SQLite file, so they can't run in parallel:
    // one file's freshTestDb() TRUNCATE would wipe rows another file just
    // inserted mid-run.
    fileParallelism: false,
    // Set here, not inside individual test files: ES module static imports
    // resolve (including transitive imports of src/config/env.ts) before a
    // test file's own top-level `process.env.X = ...` assignments run, so a
    // per-file override race-loses against config/env.ts's own zod parse.
    // Vite injects `test.env` before any test module graph loads at all.
    env: {
      EVIDENCE_DIR: path.join(os.tmpdir(), "relieftrace-test-evidence"),
    },
  },
});
