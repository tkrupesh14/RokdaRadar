import { migrate } from "../db/migrate.js";
import { startIndexer } from "./listener.js";

// Standalone entrypoint so the indexer can be split into its own process
// later (npm run indexer:dev) without a rewrite, even though MVP0 runs it
// in-process with the API by default (src/index.ts).
await migrate();
startIndexer().catch((err) => {
  console.error("[indexer] fatal error", err);
  process.exitCode = 1;
});
