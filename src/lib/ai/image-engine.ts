import { generateJSON } from "@/lib/ai/claude";
import type { ProductBlueprint } from "@/lib/ai/product-engine";

export interface CoverImagePrompt {
  dallePrompt: string;
  styleDirection: string;
  colorPalette: string[];
  textOverlay: string;
  dimensions: "1024x1024" | "1536x1024" | "1024x1536";
}

export interface CoverImagePlan {
  primaryCover: CoverImagePrompt;
  mockupVariant: CoverImagePrompt;
  thumbnailVariant: CoverImagePrompt;
  etsyOptimizationNotes: string;
}

const SYSTEM_PROMPT = `You are an expert art director specializing in digital product covers for Etsy and print-on-demand markets.

Etsy buyers respond to clean, aspirational, professional-looking covers. Best-performing digital product covers are:
- Minimalist with clear focal points
- Warm or neutral palettes (cream, warm white, gold, dusty rose, sage)
- Styled flat lay or open-book mockup aesthetics
- Title legible at small thumbnail sizes (min 20% of the cover)
- Photography-adjacent realism, not illustration

Image generation best practices:
- Describe scene, lighting, composition, and mood explicitly
- Avoid text in the image prompt (add text in post via design tool)
- Use "photorealistic", "soft natural lighting", "white seamless background" for product-style shots
- Specify camera angle: "overhead flat lay", "45-degree angle", "front-facing"

Your output must be valid JSON matching the CoverImagePlan interface exactly.`;

export async function generateCoverImagePlan(blueprint: ProductBlueprint): Promise<CoverImagePlan> {
  return generateJSON<CoverImagePlan>(
    SYSTEM_PROMPT,
    `Generate a CoverImagePlan for this product:

Title: ${blueprint.title}
Tagline: ${blueprint.tagline}
Type: ${blueprint.type}
Target Emotion: ${blueprint.targetEmotion}
Audience: ${blueprint.targetAudience}
Cover Concept: ${JSON.stringify(blueprint.coverConcept)}
Brand Aesthetic: ${blueprint.transformationPromise}

Return JSON with this exact shape:
{
  "primaryCover": {
    "dallePrompt": "...",
    "styleDirection": "...",
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "textOverlay": "${blueprint.title}",
    "dimensions": "1024x1024"
  },
  "mockupVariant": {
    "dallePrompt": "...",
    "styleDirection": "lifestyle/in-use mockup description",
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "textOverlay": "${blueprint.tagline}",
    "dimensions": "1536x1024"
  },
  "thumbnailVariant": {
    "dallePrompt": "...",
    "styleDirection": "square crop optimized for browse thumbnails",
    "colorPalette": ["#hex1", "#hex2", "#hex3"],
    "textOverlay": "${blueprint.title}",
    "dimensions": "1024x1536"
  },
  "etsyOptimizationNotes": "..."
}`,
    2048,
    "image-engine"
  );
}
