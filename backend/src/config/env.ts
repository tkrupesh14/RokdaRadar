import "dotenv/config";
import { z } from "zod";

// ANTHROPIC_API_KEY and OPERATOR_PRIVATE_KEY are intentionally optional here.
// The service must boot and serve every non-chain, non-AI route without them;
// individual features degrade cleanly (503 / clear error) instead of crashing
// the whole process. See src/ai/anthropicClient.ts and src/chain/provider.ts.
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Postgres/Supabase connection string)"),
  // Must point at a physically separate database from DATABASE_URL --
  // test/testDb.ts TRUNCATEs every table before each test file. See
  // db/client.ts's getPool() for the hard runtime check that refuses to run
  // tests at all if this is unset or equals DATABASE_URL.
  TEST_DATABASE_URL: z.string().optional(),
  EVIDENCE_DIR: z.string().default("./evidence-store"),
  // "local" (default) is the MVP0 tier: filesystem + SHA-256 hash standing
  // in for a real CID -- fine for dev/demo, doesn't survive redeploys or
  // horizontal scaling. "ipfs" is the real LLD Section 6 MVP1 tier: pins to
  // Pinata (PINATA_JWT required). LLD Section 6 also asks for a redundant
  // pin to a second provider (e.g. web3.storage) so evidence survives one
  // provider's outage -- not implemented yet (see evidence/pinataClient.ts's
  // comment on why: this integration couldn't be verified against a live
  // account in the environment it was written in, and a second provider
  // doubles that unverified surface for comparatively little benefit at
  // MVP1 scale). Worth adding once the primary pin path is confirmed
  // working against a real account.
  EVIDENCE_STORAGE_BACKEND: z.enum(["local", "ipfs"]).default("local"),
  PINATA_JWT: z.string().optional(),

  MONAD_TESTNET_RPC_URL: z.string().default("https://testnet-rpc.monad.xyz"),
  MONAD_TESTNET_CHAIN_ID: z.coerce.number().default(10143),
  MONAD_EXPLORER_TX_BASE_URL: z.string().default("https://testnet.monadscan.com/tx"),
  CONTRACT_ADDRESS: z.string().optional(),

  OPERATOR_PRIVATE_KEY: z.string().optional(),
  ORACLE_PRIVATE_KEY: z.string().optional(),

  WEBHOOK_HMAC_SECRET: z.string().default("change-me-dev-secret"),
  ATTESTOR_ALLOWLIST: z.string().default(""),
  MANAGER_ALLOWLIST: z.string().default(""),

  // AI_PROVIDER picks which model backs the report service. Left unset, it
  // auto-selects whichever key is present (GEMINI_API_KEY preferred, since
  // that's what's actually available right now -- see AI_PROVIDER
  // resolution in this file below). Set explicitly to pin one provider even
  // if both keys happen to be present.
  AI_PROVIDER: z.enum(["anthropic", "gemini"]).optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  // Haiku 4.5 is the cheapest current Claude model. Reports are short,
  // structured JSON grounded entirely in the aggregate payload (no deep
  // reasoning required -- the guardrail, not model quality, is what keeps
  // numbers honest), so a small model keeps token cost minimal by default.
  // Override via .env for a stronger model if report quality needs it.
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),

  GEMINI_API_KEY: z.string().optional(),
  // "-latest" alias, not a pinned version: pinned Gemini model IDs get
  // deprecated/blocked for new API keys over time (hit this directly --
  // gemini-2.5-flash-lite 404'd as "no longer available to new users"
  // despite still being listed by the models API). Flash-Lite is Gemini's
  // cheapest tier, same reasoning as ANTHROPIC_MODEL above: the guardrail
  // (src/ai/guardrail.ts), not model size, is what keeps report numbers
  // honest, so the cheapest tier is the safe default.
  GEMINI_MODEL: z.string().default("gemini-flash-lite-latest"),

  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  // Fail fast rather than silently keeping evidence on ephemeral local disk
  // while the operator believes it's configured for durable IPFS storage --
  // the whole point of issue #9 is that local storage doesn't survive
  // redeploys, so silently falling back here would defeat it invisibly.
  if (parsed.data.EVIDENCE_STORAGE_BACKEND === "ipfs" && !parsed.data.PINATA_JWT) {
    throw new Error("EVIDENCE_STORAGE_BACKEND=ipfs requires PINATA_JWT to be set");
  }
  return parsed.data;
}

export const env = loadEnv();

// Oracle key defaults to the operator key for MVP0 demo simplicity (confirmed
// decision: one funded testnet key plays both roles).
export const oraclePrivateKey = env.ORACLE_PRIVATE_KEY || env.OPERATOR_PRIVATE_KEY;

export const attestorAllowlist = env.ATTESTOR_ALLOWLIST.split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

export const managerAllowlist = env.MANAGER_ALLOWLIST.split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

export const isChainConfigured = Boolean(env.OPERATOR_PRIVATE_KEY && env.CONTRACT_ADDRESS);

// Resolution order: explicit AI_PROVIDER wins; otherwise prefer Gemini
// (that's the key actually available at the moment this was wired up),
// falling back to Anthropic if only that key is present.
export const resolvedAiProvider: "anthropic" | "gemini" | null = env.AI_PROVIDER
  ? env.AI_PROVIDER
  : env.GEMINI_API_KEY
    ? "gemini"
    : env.ANTHROPIC_API_KEY
      ? "anthropic"
      : null;

export const isAiConfigured = resolvedAiProvider !== null;
