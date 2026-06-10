import { generateJSON } from "./claude";
import type { WinningPriceRange } from "@/lib/market-intelligence/types";

export type ProductType = "journal" | "planner" | "workbook" | "digital-system" | "hybrid";

export interface ProductBlueprint {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  type: ProductType;
  targetEmotion: string;
  targetAudience: string;
  audienceArchetype: string;
  pageCount: number;
  sections: ProductSection[];
  psychologicalFramework: string;
  transformationPromise: string;
  emotionalHooks: string[];
  coverConcept: CoverConcept;
  marketingAngles: string[];
  pricingStrategy: PricingStrategy;
  platforms: string[];
  estimatedMonthlyRevenue: string;
  competitiveAdvantage: string;
  keywords: string[];
  descriptionShort: string;
  descriptionLong: string;
}

export interface ProductSection {
  name: string;
  purpose: string;
  pageCount: number;
  prompts: string[];
  psychologicalMechanism: string;
}

export interface CoverConcept {
  colorPalette: string[];
  visualTheme: string;
  typography: string;
  mood: string;
  symbols: string[];
}

export interface PricingStrategy {
  printPrice: number;
  digitalPrice: number;
  bundlePrice: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are the Product Psychology Engine for Alpha & Omega — designing emotionally intelligent transformation products.

You think like a behavioral psychologist, a luxury product designer, and a bestselling author simultaneously.

Every product you design must:
1. Address a specific emotional pain point with surgical precision
2. Create a clear transformation arc (before → during → after)
3. Use psychological reinforcement mechanisms (habit loops, identity reinforcement, dopamine cycles)
4. Feel premium, intentional, and emotionally intelligent
5. Have strong commercial viability

You do NOT create generic journals. You create emotional utility systems.`;

export interface MarketIntelligenceContext {
  winningTitleStructures?: string[];
  winningPriceRange?: WinningPriceRange;
  productOpportunity?: string;
  winningTags?: string[];
}

export async function generateProductBlueprint(
  emotionalFocus: string,
  productType: ProductType,
  audienceArchetype: string,
  marketIntel?: MarketIntelligenceContext
): Promise<ProductBlueprint> {
  const marketIntelSection = marketIntel
    ? `\nMARKET INTELLIGENCE (use this — it's based on real Etsy sales data):
${marketIntel.winningTitleStructures?.length ? `Proven title structures: ${marketIntel.winningTitleStructures.slice(0, 3).join(" | ")}` : ""}
${marketIntel.winningPriceRange ? `Proven price sweet spot: $${marketIntel.winningPriceRange.sweet} (range $${marketIntel.winningPriceRange.min}–$${marketIntel.winningPriceRange.max})` : ""}
${marketIntel.productOpportunity ? `Specific gap to fill: ${marketIntel.productOpportunity}` : ""}
${marketIntel.winningTags?.length ? `Proven Etsy tags: ${marketIntel.winningTags.slice(0, 8).join(", ")}` : ""}\n`
    : "";

  const prompt = `Design a premium ${productType} product for Alpha & Omega targeting this emotional landscape:

Emotional Focus: ${emotionalFocus}
Audience Archetype: ${audienceArchetype}
Product Type: ${productType}${marketIntelSection}

Create a complete product blueprint that will genuinely help this audience transform. Include:

1. A compelling title and subtitle (not generic — psychologically precise)
2. 6-8 structured sections with specific prompts and psychological mechanisms
3. A clear transformation promise
4. Emotional hooks that will drive purchase decisions
5. Cover design concept
6. Pricing strategy
7. Platform recommendations
8. SEO keywords and marketing copy

The product should feel like something Apple would design if they made self-improvement tools — minimal, premium, deeply intentional.

Return JSON matching this schema:
{
  "id": "kebab-case-id",
  "title": "string",
  "subtitle": "string",
  "tagline": "string (under 10 words, emotionally powerful)",
  "type": "${productType}",
  "targetEmotion": "string",
  "targetAudience": "string",
  "audienceArchetype": "string",
  "pageCount": number,
  "sections": [
    {
      "name": "string",
      "purpose": "string",
      "pageCount": number,
      "prompts": ["string (5-8 actual prompts)"],
      "psychologicalMechanism": "string"
    }
  ],
  "psychologicalFramework": "string (the core framework: CBT, ACT, IFS, etc.)",
  "transformationPromise": "string",
  "emotionalHooks": ["string"],
  "coverConcept": {
    "colorPalette": ["string (hex colors)"],
    "visualTheme": "string",
    "typography": "string",
    "mood": "string",
    "symbols": ["string"]
  },
  "marketingAngles": ["string"],
  "pricingStrategy": {
    "printPrice": number,
    "digitalPrice": number,
    "bundlePrice": number,
    "reasoning": "string"
  },
  "platforms": ["string"],
  "estimatedMonthlyRevenue": "string",
  "competitiveAdvantage": "string",
  "keywords": ["string"],
  "descriptionShort": "string (under 100 words)",
  "descriptionLong": "string (200-300 words, emotionally compelling)"
}`;

  return generateJSON<ProductBlueprint>(SYSTEM_PROMPT, prompt, 8000);
}

export async function generateProductVariants(
  baseBlueprint: ProductBlueprint,
  variantCount = 3
): Promise<{ variants: Array<{ title: string; targetAudience: string; twist: string; estimatedRevenue: string }> }> {
  const prompt = `Based on this product: "${baseBlueprint.title}" targeting ${baseBlueprint.targetAudience}

Generate ${variantCount} distinct product variants that target different audience archetypes or emotional angles from the same core concept.

Each variant should have a distinct positioning while sharing the core transformation promise.

Return JSON: { "variants": [{ "title": "string", "targetAudience": "string", "twist": "string", "estimatedRevenue": "string" }] }`;

  return generateJSON(SYSTEM_PROMPT, prompt, 2000);
}
