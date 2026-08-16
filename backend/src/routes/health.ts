import { Router } from "express";
import { getDb } from "../db/client.js";
import { isAiConfigured, isChainConfigured } from "../config/env.js";

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
healthRouter.get("/health", (_req, res) => {
  let dbOk = false;
  try {
    getDb().prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  res.json({
    status: "ok",
    db: dbOk ? "ok" : "error",
    chain: isChainConfigured ? "configured" : "unconfigured",
    ai: isAiConfigured ? "configured" : "unconfigured",
  });
});
