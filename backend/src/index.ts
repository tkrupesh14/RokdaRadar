import { migrate } from "./db/migrate.js";
import { getDb } from "./db/client.js";
import { createApp } from "./app.js";
import { env, isChainConfigured } from "./config/env.js";
import { startIndexer } from "./indexer/listener.js";

async function main() {
  migrate(getDb());

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
    console.log(`[api] swagger docs at http://localhost:${env.PORT}/docs`);
  });

  // MVP0 runs the indexer in the same process as the API (HLD: "Node process
  // + SQLite, local"). It only starts once CONTRACT_ADDRESS + a signer are
  // configured; until then chain-dependent routes 503/422 cleanly and every
  // other route still works.
  if (isChainConfigured) {
    startIndexer().catch((err) => {
      console.error("[indexer] fatal error, continuing without live indexing", err);
    });
  } else {
    console.warn("[indexer] CONTRACT_ADDRESS/OPERATOR_PRIVATE_KEY not configured; indexer not started");
  }
}

main().catch((err) => {
  console.error("[api] fatal startup error", err);
  process.exitCode = 1;
});
