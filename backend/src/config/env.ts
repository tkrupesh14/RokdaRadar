import "dotenv/config";
import { z } from "zod";

// ANTHROPIC_API_KEY and OPERATOR_PRIVATE_KEY are intentionally optional here.
// The service must boot and serve every non-chain, non-AI route without them;
// individual features degrade cleanly (503 / clear error) instead of crashing
// the whole process. See src/ai/anthropicClient.ts and src/chain/provider.ts.
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DB_PATH: z.string().default("./data/relieftrace.sqlite"),
  EVIDENCE_DIR: z.string().default("./evidence-store"),

  MONAD_TESTNET_RPC_URL: z.string().default("https://testnet-rpc.monad.xyz"),
  MONAD_TESTNET_CHAIN_ID: z.coerce.number().default(10143),
  MONAD_EXPLORER_TX_BASE_URL: z.string().default("https://testnet.monadscan.com/tx"),
  CONTRACT_ADDRESS: z.string().optional(),

  OPERATOR_PRIVATE_KEY: z.string().optional(),
  ORACLE_PRIVATE_KEY: z.string().optional(),

  WEBHOOK_HMAC_SECRET: z.string().default("change-me-dev-secret"),
  ATTESTOR_ALLOWLIST: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
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

export const isChainConfigured = Boolean(env.OPERATOR_PRIVATE_KEY && env.CONTRACT_ADDRESS);
export const isAiConfigured = Boolean(env.ANTHROPIC_API_KEY);
