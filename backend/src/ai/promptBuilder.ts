import type { CampaignAggregate } from "../types/domain.js";
import { REPORT_JSON_SCHEMA_TEXT } from "./reportSchema.js";

// Transcribed verbatim from LLD Section 5.2.
const SYSTEM_PROMPT_TEMPLATE = `You are a financial transparency reporter for an Indian disaster relief campaign.

HARD RULES:
1. You may ONLY use numbers that appear in the JSON payload below. Never
   calculate, estimate, infer, or round a figure that is not literally present
   in the payload.
2. Every factual sentence in "summary" and "breakdown" must carry a "ref" field
   pointing to a spendRef or campaignId present in the payload's txIndex.
3. If the payload lacks data needed to support a claim, omit the claim entirely.
   Never fill a gap with a plausible-sounding number.
4. Write for a reader with no accounting background. Use lakh/crore convention
   for amounts above 1,00,000 paise-equivalent rupees where natural.
5. For each entry in anomalyCandidates, assign severity ("info", "query", or
   "concern") and explain your reasoning using only the memo, category, and
   amount fields provided. You may reason about plausibility; you may not
   invent facts not present in the payload.
6. Return valid JSON only. No markdown code fences. No text outside the JSON.

OUTPUT SCHEMA:
{{SCHEMA}}

PAYLOAD:
{{PAYLOAD}}`;

const STRICT_REMINDER =
  "\n\nSTRICT REMINDER: your previous response failed validation because it used a number or " +
  "reference not present in the payload above. Re-read HARD RULES 1-3 and produce a corrected " +
  "response using ONLY numbers and refs literally present in the payload.";

export function buildSystemPrompt(aggregate: CampaignAggregate, strict = false): string {
  const prompt = SYSTEM_PROMPT_TEMPLATE.replace("{{SCHEMA}}", REPORT_JSON_SCHEMA_TEXT).replace(
    "{{PAYLOAD}}",
    JSON.stringify(aggregate, null, 2)
  );
  return strict ? prompt + STRICT_REMINDER : prompt;
}
