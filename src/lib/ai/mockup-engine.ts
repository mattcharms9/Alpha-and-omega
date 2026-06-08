import { generateJSON } from "./claude";
import type { ProductBlueprint } from "./product-engine";

export type MockupType =
  | "phone_screen"
  | "printed_desk"
  | "hands_holding"
  | "flat_lay"
  | "lifestyle_context";

export interface MockupConcept {
  dallePrompt: string;
  sceneDescription: string;
  mockupType: MockupType;
  mood: string;
}

const SYSTEM_PROMPT = `You are an expert product photographer and art director specializing in Etsy digital product mockups. You write DALL-E 3 prompts that produce photorealistic lifestyle images showing digital products in context. Your mockups feel authentic, warm, and aspirational — not corporate stock photos.

DALL-E 3 prompt rules:
- Be extremely specific about lighting, setting, props, and mood
- Use "photorealistic", "lifestyle photography", "natural light" for realism
- Describe the scene from a specific angle (overhead, 45-degree, eye-level)
- Include emotion and atmosphere, not just objects
- Avoid mentioning specific brand names

Return valid JSON with fields: dallePrompt, sceneDescription, mockupType, mood.`;

export async function generateMockupConcepts(
  blueprint: ProductBlueprint,
  count: 3 | 5 = 3
): Promise<MockupConcept[]> {
  const prompt = `Generate ${count} DALL-E 3 mockup prompts for this Etsy digital product.

PRODUCT:
Title: ${blueprint.title}
Type: ${blueprint.type}
Target emotion: ${blueprint.targetEmotion}
Target audience: ${blueprint.targetAudience}
Cover concept: ${JSON.stringify(blueprint.coverConcept)}

Generate mockups for these types: phone_screen (product on phone/tablet screen), printed_desk (pages on styled desk), lifestyle_context (in-use scene matching target emotion and audience).

For each mockup, return: dallePrompt (full DALL-E 3 prompt, 80-120 words), sceneDescription (brief human-readable description), mockupType, mood.

Return a JSON array of ${count} objects.`;

  const result = await generateJSON<{ mockups: MockupConcept[] }>(
    SYSTEM_PROMPT,
    prompt,
    3000
  );
  return result.mockups ?? (result as unknown as MockupConcept[]);
}
