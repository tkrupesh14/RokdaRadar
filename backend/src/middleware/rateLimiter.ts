import type { Request, RequestHandler } from "express";

// Minimal in-process rate limiter keyed by a caller-supplied key function.
// Sufficient for a single-instance deployment; a shared store (Redis etc.)
// would be needed once the API scales beyond one process.
//
// Call this once per route/mount (e.g. inside the router factory) rather
// than at module scope -- the `hits` map is per-call state, so a fresh call
// gives a fresh limiter. Sharing one instance across unrelated routes, or
// creating it at import time, leaks hit counts across otherwise-independent
// callers/tests.
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

// Best-effort caller identity for rate limiting: trusts Express's own
// req.ip resolution (honors `trust proxy` if configured), falling back to
// the raw socket address so a limiter never keys on `undefined` and
// collapses every caller into one bucket.
export function byIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
