import { computeAggregate } from "../indexer/aggregate.js";
import { buildSystemPrompt } from "./promptBuilder.js";
import { callReportModel } from "./anthropicClient.js";
import { reportSchema, type Report } from "./reportSchema.js";
import { validateReport } from "./guardrail.js";
import { getCachedReport, setCachedReport, canManualRefresh } from "./cache.js";
import { isAiConfigured } from "../config/env.js";

export class AiServiceUnavailableError extends Error {}
export class CampaignNotFoundError extends Error {}
export class RefreshRateLimitedError extends Error {}

async function generateAndValidate(campaignId: number): Promise<Report> {
  const aggregate = computeAggregate(campaignId);
  if (!aggregate) throw new CampaignNotFoundError(`campaign ${campaignId} not found`);

  for (const strict of [false, true]) {
    const prompt = buildSystemPrompt(aggregate, strict);
    const raw = await callReportModel(prompt);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      continue; // malformed JSON counts as a validation failure; retry once strict
    }

    const zodResult = reportSchema.safeParse(parsedJson);
    if (!zodResult.success) continue;

    const guardrailResult = validateReport(zodResult.data, aggregate);
    if (guardrailResult.valid) {
      return zodResult.data;
    }
    console.warn(`[ai] guardrail rejected report for campaign ${campaignId} (strict=${strict}):`, guardrailResult.reason);
  }

  const cached = getCachedReport(campaignId);
  if (cached) {
    console.error(`[ai] serving last known-good cached report for campaign ${campaignId} after repeated guardrail failure`);
    return cached;
  }

  throw new Error(`AI report generation failed guardrail validation twice and no cached report exists for campaign ${campaignId}`);
}

export async function getReport(campaignId: number): Promise<Report> {
  if (!isAiConfigured) throw new AiServiceUnavailableError("ANTHROPIC_API_KEY not configured");

  const cached = getCachedReport(campaignId);
  if (cached) return cached;

  const report = await generateAndValidate(campaignId);
  setCachedReport(campaignId, report);
  return report;
}

export async function refreshReport(campaignId: number): Promise<Report> {
  if (!isAiConfigured) throw new AiServiceUnavailableError("ANTHROPIC_API_KEY not configured");
  if (!canManualRefresh(campaignId)) {
    throw new RefreshRateLimitedError("refresh is rate-limited to once per 30s per campaign");
  }

  const report = await generateAndValidate(campaignId);
  setCachedReport(campaignId, report);
  return report;
}
