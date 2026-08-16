import { REPORT_REFRESH_MIN_INTERVAL_MS } from "../config/constants.js";
import type { Report } from "./reportSchema.js";

type CacheEntry = { report: Report; lastRefreshAt: number };

const cache = new Map<number, CacheEntry>();

export function getCachedReport(campaignId: number): Report | null {
  return cache.get(campaignId)?.report ?? null;
}

export function setCachedReport(campaignId: number, report: Report): void {
  cache.set(campaignId, { report, lastRefreshAt: Date.now() });
}

export function invalidateReport(campaignId: number): void {
  cache.delete(campaignId);
}

export function canManualRefresh(campaignId: number): boolean {
  const entry = cache.get(campaignId);
  if (!entry) return true;
  return Date.now() - entry.lastRefreshAt >= REPORT_REFRESH_MIN_INTERVAL_MS;
}
