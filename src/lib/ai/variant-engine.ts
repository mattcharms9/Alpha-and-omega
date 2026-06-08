import { generateJSON } from "@/lib/ai/claude";
import type { ProductBlueprint } from "@/lib/ai/product-engine";

export interface ListingVariantOutput {
  variantLabel: string;
  title: string;
  description: string;
  tags: string[];
  price: number;
  positioningAngle: string;
  hypothesis: string;
}

const SYSTEM_PROMPT = `You are an expert Etsy SEO and conversion specialist.

You create A/B test variants for digital product listings. Each variant must have:
- Meaningfully different positioning (not just word swaps)
- A clear hypothesis about who it will appeal to and why it might outperform
- Etsy-optimized title (max 140 chars, keyword-rich, front-loaded)
- 13 relevant tags optimized for Etsy search
- Price hypothesis based on perceived value positioning

Variant patterns:
- A (control): Benefit-forward title, broad appeal, anchor price
- B: Problem/pain-point-forward title, specific struggling audience, slight premium
- C: Outcome/transformation-forward title, aspirational positioning, premium pricing

Return a JSON array of variant objects.`;

export async function generateListingVariants(
  blueprint: ProductBlueprint,
  variantCount = 3
): Promise<ListingVariantOutput[]> {
  const labels = ["A", "B", "C", "D", "E", "F"].slice(0, variantCount);
  return generateJSON<ListingVariantOutput[]>(
    SYSTEM_PROMPT,
    `Generate ${variantCount} A/B test listing variants for this product:

Title: ${blueprint.title}
Tagline: ${blueprint.tagline}
Target Emotion: ${blueprint.targetEmotion}
Audience: ${blueprint.targetAudience}
Transformation: ${blueprint.transformationPromise}
Type: ${blueprint.type}
Keywords: ${Array.isArray(blueprint.keywords) ? (blueprint.keywords as string[]).join(", ") : ""}

Variant labels: ${labels.join(", ")}

Return a JSON array of ${variantCount} objects with this shape:
[
  {
    "variantLabel": "A",
    "title": "Etsy-optimized title (max 140 chars)",
    "description": "2-3 paragraph description with emotional hooks and benefits",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"],
    "price": 7.00,
    "positioningAngle": "benefit-forward / problem-forward / transformation-forward",
    "hypothesis": "Why this positioning might outperform the others"
  }
]`,
    3000,
    "variant-engine"
  );
}
