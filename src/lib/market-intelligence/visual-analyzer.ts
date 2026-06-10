import { generateJSONWithImages } from "@/lib/ai/claude";
import type { VisualIntelligence } from "./types";

const SYSTEM_PROMPT = `You are an expert art director analyzing digital product cover images on Etsy.
You identify visual patterns that correlate with top-selling listings.
Be specific and data-driven — describe what you actually see, not what you guess.`;

const FALLBACK: VisualIntelligence = {
  dominantColors: ["#f5f0eb", "#ffffff", "#2d2d2d"],
  dominantStyle: "minimal",
  titleOnCover: true,
  fontStyle: "serif",
  commonElements: ["clean white background", "minimal design"],
  whatToAvoid: ["cluttered layouts", "low-resolution images"],
  exampleImageUrls: [],
};

export async function analyzeVisualStyle(
  niche: string,
  imageUrls: string[]
): Promise<VisualIntelligence> {
  const validUrls = imageUrls.filter((u) => u.startsWith("https://")).slice(0, 5);

  if (validUrls.length === 0) return { ...FALLBACK, exampleImageUrls: [] };

  const prompt = `Analyze these cover images from top-selling Etsy digital products in the "${niche}" niche.

Identify and return JSON with exactly these fields:
- dominantColors: array of 3-5 hex color values that appear most in these covers
- dominantStyle: one of "minimal" | "illustrated" | "photo" | "typographic" | "mixed"
- titleOnCover: boolean — do these covers show the product title as text?
- fontStyle: one of "serif" | "sans-serif" | "script" | "mixed"
- commonElements: array of 4-6 visual elements (e.g. "gold accent lines", "watercolor flowers", "clean white background")
- whatToAvoid: array of 2-4 visual patterns that appear in lower-quality or lower-ranked listings
- exampleImageUrls: return the same URLs you analyzed

Return JSON matching the VisualIntelligence interface.`;

  return generateJSONWithImages<VisualIntelligence>(SYSTEM_PROMPT, prompt, validUrls, 800).catch(
    () => ({ ...FALLBACK, exampleImageUrls: validUrls })
  );
}
