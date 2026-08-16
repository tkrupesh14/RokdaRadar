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

export async function callReportModel(systemPrompt: string): Promise<string> {
  const gemini = getClient();
  const response = await gemini.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: "Generate the transparency report JSON now, following every hard rule above.",
    config: {
      systemInstruction: systemPrompt,
      // The prompt already hard-requires "valid JSON only, no markdown code
      // fences" (LLD 5.2 rule 6); this just makes that structurally
      // guaranteed rather than relying on the model to comply with prose.
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini response contained no text");
  }
  return text;
}
