import Anthropic from "@anthropic-ai/sdk";
import { logAICall } from "@/lib/logger";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("[AI] ANTHROPIC_API_KEY is not set — all AI engines will fail at runtime");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 10_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
  engineHint = "claude"
): Promise<string> {
  const start = Date.now();
  const response = await withRetry(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    })
  );

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from AI");

  const cached = (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens
    ? (response.usage as { cache_read_input_tokens: number }).cache_read_input_tokens > 0
    : false;

  logAICall({
    engine: engineHint,
    action: "generate",
    durationMs: Date.now() - start,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cached,
  });

  return content.text;
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
  engineHint = "claude"
): Promise<T> {
  const text = await generateWithClaude(
    systemPrompt + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just raw JSON.",
    userPrompt,
    maxTokens,
    engineHint
  );

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error("[AI] Failed to parse JSON response. Raw length:", cleaned.length);
    throw new Error("AI returned malformed JSON. Try again or reduce the requested count.");
  }
}
