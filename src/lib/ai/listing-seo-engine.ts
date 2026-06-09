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
  listingQualityScore: number;
}

const SYSTEM_PROMPT = `You are an expert Etsy SEO copywriter with deep knowledge of the Etsy search algorithm. You write listings that rank for high-volume keywords while remaining compelling to human buyers.

Etsy title rules: 140 characters max. Format: [Emotional Hook] [Product Type] | [Audience] [Key Benefit] | [Format/Pages]. First 40 characters appear in mobile search. Lead with primary keyword. No ALL CAPS. Read naturally.

Etsy tag rules: Return exactly 13 tags. Each tag max 20 characters. Multi-word long-tail phrases buyers actually search. No repeating title words.

Etsy description rules (800-1200 words): Lead with the pain point (2 sentences). What's inside (bullet list). Who it's for (2 sentences). Transformation it creates (2 sentences). What they get (file format, page count). FAQ section (3 questions).

SEO score (0-100): keyword placement in title (30pts), tag quality and count (30pts), description word count 800+ (20pts), keyword density (20pts).

Listing quality score (0-100): title length 120-140 chars (20pts), exactly 13 tags (20pts), description 800+ words (30pts), seoScore (30pts). A score below 75 means the listing should be regenerated.

Return valid JSON: title, description, tags (13 strings), materials, primaryKeyword, secondaryKeywords, seoScore, seoNotes, listingQualityScore.`;

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

Requirements:
- Title: exactly 120-140 characters using format [Emotional Hook] [Product Type] | [Audience] [Key Benefit]
- Description: 800-1200 words with pain point, bullet list of contents, who it's for, transformation, file info, FAQ
- Tags: exactly 13 tags, each ≤20 characters
- listingQualityScore must reflect how well these requirements are met (0-100)

Return JSON: title, description, tags (13 strings), materials, primaryKeyword, secondaryKeywords, seoScore, seoNotes, listingQualityScore.`;

  return generateJSON<OptimizedListing>(SYSTEM_PROMPT, prompt, 4000);
}

export function scoreListingQuality(listing: OptimizedListing): number {
  let score = 0;
  const titleLen = listing.title?.length ?? 0;
  if (titleLen >= 120 && titleLen <= 140) score += 20;
  else if (titleLen >= 100) score += 10;
  const tagCount = listing.tags?.length ?? 0;
  if (tagCount === 13) score += 20;
  else if (tagCount >= 10) score += 10;
  const descWords = (listing.description ?? "").split(/\s+/).length;
  if (descWords >= 800) score += 30;
  else if (descWords >= 400) score += 15;
  score += Math.round((listing.seoScore ?? 0) * 0.3);
  return Math.min(score, 100);
}
