import { z } from "zod";

// Mirrors LLD Section 4.2's response shape exactly.
export const reportBreakdownItemSchema = z.object({
  category: z.string(),
  text: z.string(),
  ref: z.string(),
});

export const reportAnomalySchema = z.object({
  spendRef: z.string(),
  severity: z.enum(["info", "query", "concern"]),
  finding: z.string(),
  reasoning: z.string(),
});

export const reportTranslationSchema = z.object({
  headline: z.string(),
  summary: z.string(),
});

export const reportSchema = z.object({
  generatedAt: z.string(),
  headline: z.string(),
  summary: z.string(),
  breakdown: z.array(reportBreakdownItemSchema),
  anomalies: z.array(reportAnomalySchema),
  promiseConsistency: z.object({
    verdict: z.enum(["aligned", "drifting", "mismatch"]),
    text: z.string(),
  }),
  translations: z.record(z.string(), reportTranslationSchema),
});

export type Report = z.infer<typeof reportSchema>;

export const REPORT_JSON_SCHEMA_TEXT = JSON.stringify(
  {
    type: "object",
    required: ["generatedAt", "headline", "summary", "breakdown", "anomalies", "promiseConsistency", "translations"],
    properties: {
      generatedAt: { type: "string" },
      headline: { type: "string" },
      summary: { type: "string" },
      breakdown: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "text", "ref"],
          properties: { category: { type: "string" }, text: { type: "string" }, ref: { type: "string" } },
        },
      },
      anomalies: {
        type: "array",
        items: {
          type: "object",
          required: ["spendRef", "severity", "finding", "reasoning"],
          properties: {
            spendRef: { type: "string" },
            severity: { type: "string", enum: ["info", "query", "concern"] },
            finding: { type: "string" },
            reasoning: { type: "string" },
          },
        },
      },
      promiseConsistency: {
        type: "object",
        required: ["verdict", "text"],
        properties: {
          verdict: { type: "string", enum: ["aligned", "drifting", "mismatch"] },
          text: { type: "string" },
        },
      },
      translations: {
        type: "object",
        additionalProperties: {
          type: "object",
          required: ["headline", "summary"],
          properties: { headline: { type: "string" }, summary: { type: "string" } },
        },
      },
    },
  },
  null,
  2
);
