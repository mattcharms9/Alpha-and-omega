import { generateJSON } from "./claude";
import type { ProductBlueprint } from "./product-engine";

export interface OptimizedListing {
  title: string;
  description: string;
  tags: string[];
  materials: string[];
  primaryKeyword: string;
  secondaryKeywords: string[];
  seoScore: number;
  seoNotes: string[];
}

const SYSTEM_PROMPT = `You are an expert Etsy SEO copywriter with deep knowledge of the Etsy search algorithm. You write listings that rank for high-volume keywords while remaining compelling to human buyers.

Etsy title rules: 140 characters max. First 40 characters appear in mobile search. Lead with the primary keyword. Include 2-3 secondary keywords naturally. No ALL CAPS. No keyword stuffing. Read naturally as a product title.

Etsy tag rules: Return exactly 13 tags. Each tag max 20 characters. Multi-word tags are phrases, not individual words. Use long-tail phrases buyers actually search. No repeating words from title in tags.

Etsy description rules: First 160 characters appear in Google preview — lead with the most compelling hook. Include all keywords once. Use bullet points for features. Include a clear call to action. Mention instant download and file format.

SEO score rules: 0-100. Score based on: keyword placement in title (30pts), tag quality (30pts), description hook strength (20pts), keyword density balance (20pts). Include 3-5 specific seoNotes explaining improvements.

Return valid JSON with exact field names: title, description, tags (array of 13 strings), materials, primaryKeyword, secondaryKeywords, seoScore, seoNotes.`;

export async function generateOptimizedListing(
  blueprint: ProductBlueprint,
  keywordHints?: string[]
): Promise<OptimizedListing> {
  const prompt = `Generate a fully optimized Etsy listing for this digital product.

PRODUCT:
Title: ${blueprint.title}
Type: ${blueprint.type}
Target emotion: ${blueprint.targetEmotion}
Target audience: ${blueprint.targetAudience}
Transformation promise: ${blueprint.transformationPromise}
Description (short): ${blueprint.descriptionShort}
Keywords: ${(blueprint.keywords as string[]).join(", ")}
${keywordHints ? `High-volume keyword hints: ${keywordHints.join(", ")}` : ""}

Return a JSON object with: title (≤140 chars), description (full listing), tags (exactly 13, each ≤20 chars), materials (["PDF", "Instant Download"...]), primaryKeyword, secondaryKeywords (3), seoScore (0-100), seoNotes (3-5 improvement suggestions).`;

  return generateJSON<OptimizedListing>(SYSTEM_PROMPT, prompt, 3000);
}
