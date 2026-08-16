import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "../config/env.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!isAiConfigured) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function callReportModel(systemPrompt: string): Promise<string> {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Generate the transparency report JSON now, following every hard rule above.",
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response contained no text block");
  }
  return textBlock.text;
}
