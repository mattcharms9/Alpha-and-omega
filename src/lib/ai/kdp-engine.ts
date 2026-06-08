import { generateJSON } from "./claude";
import type { ProductBlueprint } from "./product-engine";

export type KDPTrimSize = "6x9" | "8.5x11" | "5x8" | "5.5x8.5";

export interface KDPMetadata {
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  categories: string[];
  trimSize: KDPTrimSize;
  pageCount: number;
  pricingTiers: { us: number; uk: number; ca: number; au: number };
  royaltyEstimate: number;
  isbnNote: string;
}

const SYSTEM_PROMPT = `You are an expert Amazon KDP publisher specializing in journals, planners, and workbooks. You write KDP metadata optimized for Amazon's A9 search algorithm.

Rules for KDP metadata:
- Title: same as Etsy title but can be longer (no character limit on KDP)
- Subtitle: descriptive, adds keywords not in title
- Description: HTML formatting allowed, max 4,000 chars. Use <b>, <p>, <ul>, <li>. NO ALL CAPS headlines. Lead with transformation promise. Include social proof language ("thousands of people use this to..."). Backend keywords go in keywords field, NOT description.
- Keywords: exactly 7 keyword phrases (not single words). These are Amazon backend keywords — buyers never see them. Think like Amazon shoppers: "anxiety journal for women pdf", "gratitude workbook adults printable", etc.
- Categories: 2 BISAC category codes (e.g. "HEALTH & FITNESS / Mental Health", "SELF-HELP / Personal Growth / Success")
- Trim size: choose the most popular for the product type (journals/planners: 6x9, workbooks: 8.5x11)
- Pricing: US price $7-19 depending on page count and type. Use 60% royalty rate for US, convert for UK/CA/AU.
- royaltyEstimate: US price × 0.60 (60% royalty rate) minus printing cost (~$3 for 100-150 pages)

Return valid JSON with: title, subtitle, description (HTML), keywords (array of 7), categories (array of 2), trimSize, pageCount, pricingTiers ({ us, uk, ca, au }), royaltyEstimate, isbnNote.`;

export async function generateKDPMetadata(
  blueprint: ProductBlueprint
): Promise<KDPMetadata> {
  const prompt = `Generate complete Amazon KDP metadata for this digital product.

PRODUCT:
Title: ${blueprint.title}
Subtitle: ${blueprint.subtitle}
Type: ${blueprint.type}
Target emotion: ${blueprint.targetEmotion}
Target audience: ${blueprint.targetAudience}
Transformation promise: ${blueprint.transformationPromise}
Page count: ${blueprint.pageCount}
Description (short): ${blueprint.descriptionShort}
Description (long): ${blueprint.descriptionLong.slice(0, 400)}

Return KDP-ready metadata. Use HTML in description field. Return exactly 7 keywords and 2 BISAC categories.`;

  return generateJSON<KDPMetadata>(SYSTEM_PROMPT, prompt, 3000);
}
