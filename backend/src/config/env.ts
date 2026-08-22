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

const DEFAULT_WEBHOOK_HMAC_SECRET = "change-me-dev-secret";

// Fails fast at boot rather than letting a demo-grade secret or a shared
// admin/oracle key reach production silently -- see area:security issue
// #18 (secrets and key management review). These are deliberately not
// zod .refine() checks on the schema itself: they must only fire for
// NODE_ENV=production, and zod validates before NODE_ENV is known to be
// "production" vs "development"/"test".
function assertProductionSecretsAreSafe(parsed: Env): void {
  if (parsed.NODE_ENV !== "production") return;

  const problems: string[] = [];
  if (parsed.WEBHOOK_HMAC_SECRET === DEFAULT_WEBHOOK_HMAC_SECRET) {
    problems.push("WEBHOOK_HMAC_SECRET is still the default dev placeholder -- set a unique production secret.");
  }
  if (parsed.OPERATOR_PRIVATE_KEY && !parsed.ORACLE_PRIVATE_KEY) {
    problems.push(
      "ORACLE_PRIVATE_KEY is unset, so the oracle role would silently fall back to OPERATOR_PRIVATE_KEY. " +
        "Production must use a distinct key per role (operator: createCampaign/attestSpend/attestDelivery; " +
        "oracle: attestDonation only) so a compromised oracle key can't be used for privileged operator actions."
    );
  }

  if (problems.length > 0) {
    throw new Error(`Unsafe production secrets configuration:\n- ${problems.join("\n- ")}`);
  }
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  assertProductionSecretsAreSafe(parsed.data);
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
