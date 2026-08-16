import type { RequestHandler } from "express";

// Minimal in-process rate limiter keyed by a caller-supplied key function.
// Sufficient for MVP0 single-instance deployment; a shared store would be
// needed once the API scales beyond one process.
export function simpleRateLimiter(windowMs: number, max: number, keyFn: (req: Parameters<RequestHandler>[0]) => string): RequestHandler {
  const hits = new Map<string, number[]>();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) {
      res.status(429).json({ error: "RATE_LIMITED", detail: "Too many requests, try again later." });
      return;
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}
