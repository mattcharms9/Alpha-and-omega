import { generateJSON } from "./claude";
import { prisma } from "@/lib/db/prisma";
import { getTopPerformingPatterns } from "@/lib/analytics/performance-model";
import { fetchEtsyCompetitionScore } from "./etsy-market-engine";

export interface PriceOptimizationReport {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  expectedRevenueChange: string;
  reasoning: string;
  dataPoints: {
    yourCatalogAvgAtThisFormat: number;
    etsyMarketAvg: number;
    yourConversionRate: number;
    priceElasticitySignal: "price_sensitive" | "value_insensitive" | "unknown";
  };
}

const SYSTEM_PROMPT = `You are a pricing strategist for digital products on Etsy.

Given real conversion data and market averages, recommend an optimal price point.

Rules:
- If conversion rate >3% and price is below market avg → recommend 15–25% price increase
- If conversion rate <0.5% and price is above market avg → recommend testing 20% lower
- If conversion rate 0.5–3% at market avg → price is likely optimal, minor adjustment only
- Never recommend below $3.99 for any digital product
- Recommend in standard Etsy price increments ($2 steps for $5–15 range, $5 steps above $15)
- reasoning must be 2 sentences max, specific to the data provided

Return valid JSON matching PriceOptimizationReport exactly.`;

export async function optimizeProductPrice(productId: string): Promise<PriceOptimizationReport> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { etsyListings: true },
  });

  const pricing = product.pricingStrategy as { digitalPrice?: number } | null;
  const currentPrice = pricing?.digitalPrice ?? 9.99;
  const etsy = product.etsyListings[0];
  const views = etsy?.views ?? 0;
  const unitsSold = product.totalSales;
  const conversionRate = views > 0 ? unitsSold / views : 0;

  // Get catalog avg for this format
  const patterns = await getTopPerformingPatterns().catch(() => []);
  const formatPattern = patterns.find((p) => p.dimension === "format" && p.value === product.type);
  const catalogAvg = formatPattern?.avgRevenue ?? 0;
  const catalogAvgPrice = catalogAvg > 0 ? Math.min(24, Math.max(3.99, catalogAvg / Math.max(1, unitsSold))) : 0;

  // Try to get real Etsy market data
  const keywords = Array.isArray(product.keywords) ? (product.keywords as string[]).slice(0, 1) : [];
  let etsyMarketAvg = 0;
  if (keywords.length > 0) {
    const competition = await fetchEtsyCompetitionScore(keywords[0]).catch(() => null);
    etsyMarketAvg = competition?.avgPrice ?? 0;
  }

  const elasticity: PriceOptimizationReport["dataPoints"]["priceElasticitySignal"] =
    conversionRate > 0.03 ? "value_insensitive"
    : conversionRate < 0.005 && views > 100 ? "price_sensitive"
    : "unknown";

  const prompt = `Optimize the price for this digital product.

Product: "${product.title}"
Format: ${product.type}
Current price: $${currentPrice}
Conversion rate: ${(conversionRate * 100).toFixed(2)}% (${views} views, ${unitsSold} sales)
Your catalog avg price for this format: $${catalogAvgPrice.toFixed(2)}
Etsy market avg price: ${etsyMarketAvg > 0 ? `$${etsyMarketAvg.toFixed(2)}` : "unknown"}
Price elasticity signal: ${elasticity}

Return JSON: { productId: "${productId}", currentPrice: ${currentPrice}, recommendedPrice: number, expectedRevenueChange: string, reasoning: string, dataPoints: { yourCatalogAvgAtThisFormat: ${catalogAvgPrice}, etsyMarketAvg: ${etsyMarketAvg}, yourConversionRate: ${conversionRate}, priceElasticitySignal: "${elasticity}" } }`;

  return generateJSON<PriceOptimizationReport>(SYSTEM_PROMPT, prompt, 1000);
}
