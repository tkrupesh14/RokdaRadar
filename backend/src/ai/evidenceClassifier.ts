import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

export type EvidenceClassification = { isBill: boolean; reason: string };

// First line of defense before a spend even reaches manager review: reject
// evidence that plainly isn't a bill/receipt/invoice before it's stored or
// queued at all. This is a screen, not the guardrail -- a manager still
// reviews everything this lets through (LLD's evidence chain-of-custody
// intent), so it's deliberately deployed as "does this look like a payment
// record" rather than attempting fraud detection.
const CLASSIFY_PROMPT = `You are screening evidence files submitted by disaster-relief field operators to document a spend (a purchase made with relief funds).

Decide whether the attached file is a genuine bill, receipt, invoice, or other purchase/payment record (printed or handwritten, photographed or scanned) that could plausibly document a relief-related purchase.

Reject (isBill: false) anything that is clearly NOT such a document: selfies or portraits, unrelated random photos, screenshots unrelated to a purchase, blank or unreadable images, memes, test images, or any other non-receipt content.

Respond with ONLY strict JSON, no markdown fences, matching exactly:
{"isBill": boolean, "reason": string}
"reason" must be a short (under 160 characters) plain-English explanation of the decision.`;

export async function classifyEvidence(buffer: Buffer, mimetype: string): Promise<EvidenceClassification> {
  const gemini = getClient();
  const response = await gemini.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: CLASSIFY_PROMPT }, { inlineData: { mimeType: mimetype, data: buffer.toString("base64") } }],
      },
    ],
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini evidence classification returned no text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini evidence classification returned malformed JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { isBill?: unknown }).isBill !== "boolean"
  ) {
    throw new Error("Gemini evidence classification response missing isBill");
  }

  const { isBill, reason } = parsed as { isBill: boolean; reason?: unknown };
  return { isBill, reason: typeof reason === "string" ? reason : "" };
}
