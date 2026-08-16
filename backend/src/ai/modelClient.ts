import { resolvedAiProvider } from "../config/env.js";
import { callReportModel as callAnthropic } from "./anthropicClient.js";
import { callReportModel as callGemini } from "./geminiClient.js";

// Single entry point reportService.ts calls -- picks the provider resolved
// from env (src/config/env.ts) so the rest of the AI pipeline (prompt
// builder, guardrail, cache) stays provider-agnostic. Both clients expose
// the same (systemPrompt) => Promise<string> shape.
export async function callReportModel(systemPrompt: string): Promise<string> {
  switch (resolvedAiProvider) {
    case "gemini":
      return callGemini(systemPrompt);
    case "anthropic":
      return callAnthropic(systemPrompt);
    default:
      throw new Error("No AI provider configured (set GEMINI_API_KEY or ANTHROPIC_API_KEY)");
  }
}
