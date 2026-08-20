import { Router } from "express";
import { getPool } from "../db/client.js";
import { isAiConfigured, isChainConfigured, resolvedAiProvider } from "../config/env.js";

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness and subsystem configuration status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: OK
 */
healthRouter.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await getPool().query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  res.json({
    status: "ok",
    db: dbOk ? "ok" : "error",
    chain: isChainConfigured ? "configured" : "unconfigured",
    ai: isAiConfigured ? `configured (${resolvedAiProvider})` : "unconfigured",
  });
});
