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

  // Try parsing the full cleaned text first
  try {
    return JSON.parse(cleaned) as T;
  } catch { /* fall through to extraction */ }

  // Extract the outermost JSON array (Claude sometimes adds a sentence before/after)
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)) as T;
    } catch { /* fall through */ }
  }

  // Extract the outermost JSON object
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(cleaned.slice(objStart, objEnd + 1)) as T;
    } catch { /* fall through */ }
  }

  console.error("[AI] Failed to parse JSON response. Raw length:", cleaned.length);
  throw new Error("AI returned malformed JSON. Try again or reduce the requested count.");
}

export async function generateJSONWithImages<T>(
  systemPrompt: string,
  textPrompt: string,
  imageUrls: string[],
  maxTokens = 2000,
  engineHint = "visual-analyzer"
): Promise<T> {
  const start = Date.now();

  const imageContent = imageUrls
    .filter((url) => url.startsWith("https://"))
    .slice(0, 5)
    .map((url) => ({
      type: "image" as const,
      source: { type: "url" as const, url },
    }));

  const response = await withRetry(() =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt + "\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just raw JSON.", cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            { type: "text", text: textPrompt },
          ],
        },
      ],
    })
  );

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from AI");

  logAICall({
    engine: engineHint,
    action: "vision",
    durationMs: Date.now() - start,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cached: false,
  });

  const cleaned = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("AI vision returned malformed JSON.");
  }
}
