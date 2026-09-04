import "dotenv/config";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The `import "dotenv/config"` above must run before the `originalEnv`
// snapshot below, so DATABASE_URL etc. from backend/.env are captured and
// can be restored after each test -- otherwise the first test's dynamic
// `import("../../src/config/env.js")` would load them as a side effect,
// and restoring "the original env" would wipe them back out again.
//
// env.ts reads process.env at import time and caches the result as a
// module-level singleton, so exercising different NODE_ENV/secret
// combinations requires resetting the module registry and re-importing
// between assertions, restoring process.env after each case.
describe("assertProductionSecretsAreSafe (env.ts boot guard)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when NODE_ENV=production and WEBHOOK_HMAC_SECRET is still the dev default", async () => {
    process.env.NODE_ENV = "production";
    process.env.WEBHOOK_HMAC_SECRET = "change-me-dev-secret";
    delete process.env.OPERATOR_PRIVATE_KEY;
    delete process.env.ORACLE_PRIVATE_KEY;

    await expect(import("../../src/config/env.js")).rejects.toThrow(/WEBHOOK_HMAC_SECRET/);
  });

  it("throws when NODE_ENV=production, OPERATOR_PRIVATE_KEY is set, and ORACLE_PRIVATE_KEY is not", async () => {
    process.env.NODE_ENV = "production";
    process.env.WEBHOOK_HMAC_SECRET = "a-unique-production-secret";
    process.env.OPERATOR_PRIVATE_KEY = "0x" + "1".repeat(64);
    delete process.env.ORACLE_PRIVATE_KEY;

    await expect(import("../../src/config/env.js")).rejects.toThrow(/ORACLE_PRIVATE_KEY/);
  });

  it("boots cleanly when NODE_ENV=production with a unique secret and separate operator/oracle keys", async () => {
    process.env.NODE_ENV = "production";
    process.env.WEBHOOK_HMAC_SECRET = "a-unique-production-secret";
    process.env.OPERATOR_PRIVATE_KEY = "0x" + "1".repeat(64);
    process.env.ORACLE_PRIVATE_KEY = "0x" + "2".repeat(64);

    const { env } = await import("../../src/config/env.js");
    expect(env.NODE_ENV).toBe("production");
  });

  it("does not enforce the production checks outside NODE_ENV=production", async () => {
    process.env.NODE_ENV = "development";
    process.env.WEBHOOK_HMAC_SECRET = "change-me-dev-secret";
    process.env.OPERATOR_PRIVATE_KEY = "0x" + "1".repeat(64);
    delete process.env.ORACLE_PRIVATE_KEY;

    const { env } = await import("../../src/config/env.js");
    expect(env.NODE_ENV).toBe("development");
  });
});
