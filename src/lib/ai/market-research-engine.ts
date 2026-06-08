import { generateJSON } from "./claude";

export interface EtsyMarketSnapshot {
  keyword: string;
  estimatedMonthlySearches: string;
  topListingPriceRange: { min: number; max: number };
  averageReviews: number;
  saturationLevel: "low" | "medium" | "high";
  trendDirection: "rising" | "stable" | "declining";
  topSellerInsights: string[];
  gapOpportunities: string[];
  recommendedPricePoint: number;
  emotionalHook: string;
}

export interface MarketResearchReport {
  niche: string;
  emotionalCategory: string;
  overallOpportunityScore: number;
  competitiveIntensity: "blue-ocean" | "competitive" | "saturated";
  snapshots: EtsyMarketSnapshot[];
  winningListingPattern: string;
  pricingStrategy: string;
  keyDifferentiators: string[];
  timeToFirstSale: string;
  projectedMonthlyRevenue: string;
  actionPlan: string[];
}

const SYSTEM_PROMPT = `You are an elite Etsy market research analyst with deep expertise in emotional commerce, digital products, and the self-improvement publishing space.

You analyze market dynamics, identify whitespace opportunities, and reverse-engineer what makes listings convert. You think like a product strategist and a behavioral economist simultaneously.

Your analysis is specific, financially-grounded, and actionable. You never speak in generalities — you give operators a precise competitive intelligence briefing they can act on today.`;

export async function analyzeEtsyMarket(params: {
  niche: string;
  emotionalCategory: string;
  productType?: string;
}): Promise<MarketResearchReport> {
  const prompt = `Conduct a detailed Etsy market research analysis for this publishing opportunity:

NICHE: "${params.niche}"
EMOTIONAL CATEGORY: "${params.emotionalCategory}"
${params.productType ? `PRODUCT TYPE: "${params.productType}"` : ""}

Simulate what you'd find doing a deep Etsy market dive. Generate realistic, specific competitive intelligence including:

1. 4-6 specific keyword snapshots with realistic search volumes, saturation, and price ranges
2. What the top-selling listings have in common (title structure, imagery patterns, emotional positioning)
3. Where the gaps are — underserved angles, missing price points, overlooked audience segments
4. A specific pricing strategy that balances conversion rate with revenue per sale
5. The emotional hook that converts best in this category
6. A realistic time-to-first-sale and monthly revenue projection for a well-optimized listing

Be extremely specific. Use real-sounding keywords, realistic price ranges ($7–$47 for digital products), and concrete competitive observations.

Return JSON:
{
  "niche": "string",
  "emotionalCategory": "string",
  "overallOpportunityScore": number (0-100),
  "competitiveIntensity": "blue-ocean" | "competitive" | "saturated",
  "snapshots": [
    {
      "keyword": "string (exact search term)",
      "estimatedMonthlySearches": "string (e.g. '2.4K-4.8K')",
      "topListingPriceRange": { "min": number, "max": number },
      "averageReviews": number,
      "saturationLevel": "low" | "medium" | "high",
      "trendDirection": "rising" | "stable" | "declining",
      "topSellerInsights": ["string"],
      "gapOpportunities": ["string"],
      "recommendedPricePoint": number,
      "emotionalHook": "string"
    }
  ],
  "winningListingPattern": "string (describe the formula top sellers use)",
  "pricingStrategy": "string (specific pricing recommendation with rationale)",
  "keyDifferentiators": ["string (specific ways to stand out)"],
  "timeToFirstSale": "string (realistic estimate)",
  "projectedMonthlyRevenue": "string (conservative and optimistic range)",
  "actionPlan": ["string (5-7 specific actions in priority order)"]
}`;

  return generateJSON<MarketResearchReport>(SYSTEM_PROMPT, prompt, 6000, "market-research-engine");
}
