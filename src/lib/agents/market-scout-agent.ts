import { generateJSON } from "@/lib/ai/claude";
import { fetchEtsySearchIntelligence, fetchEtsyTrendingSearches } from "@/lib/ai/etsy-market-engine";
import type { AgentContext, MarketOpportunity } from "./agent-types";
import type { LogFn } from "./agent-logger";
import { estimateCost } from "./agent-logger";

const SYSTEM_PROMPT = `You are the Market Scout Agent for an autonomous digital product publishing platform.
Your job is to identify specific, actionable Etsy market opportunities with real demand and manageable competition.
Be specific — "anxiety journal for new moms" not "anxiety journal".
Return opportunities a solo creator can realistically capitalize on within 48 hours.
Return a JSON array of MarketOpportunity objects.`;

export async function runMarketScoutAgent(
  ctx: AgentContext,
  log: LogFn
): Promise<MarketOpportunity[]> {
  const start = Date.now();

  // 1. Fetch trending categories from top performing formats
  const topCategories = ctx.performancePatterns
    .filter((p) => p.dimension === "emotion")
    .slice(0, 3)
    .map((p) => p.value);

  const trendingKeywords: string[] = [];
  for (const cat of topCategories.slice(0, 2)) {
    const trends = await fetchEtsyTrendingSearches(cat).catch(() => []);
    trendingKeywords.push(...trends.slice(0, 5));
  }

  // 2. Seasonal signal keywords
  const seasonalKeywords = ctx.seasonalSignals
    .filter((s) => s.daysUntilPeak <= 30)
    .map((s) => s.event);

  // 3. Claude adjacency keywords
  const adjacencyResult = await generateJSON<{ keywords: string[] }>(
    SYSTEM_PROMPT,
    `This seller's top-performing niches: ${ctx.performancePatterns.slice(0, 5).map((p) => p.value).join(", ")}.
What are 10 adjacent keywords they haven't explored yet that likely have Etsy demand?
Return JSON: { "keywords": ["keyword1", ...] }`,
    500
  ).catch(() => ({ keywords: [] }));

  const allCandidates = [...new Set([
    ...trendingKeywords,
    ...seasonalKeywords,
    ...adjacencyResult.keywords,
    ...ctx.catalogSnapshot.topEmotions.slice(0, 3),
  ])].slice(0, 25);

  // 4. Fetch real Etsy data for each candidate
  const opportunities: MarketOpportunity[] = [];
  for (const keyword of allCandidates) {
    const intel = await fetchEtsySearchIntelligence([keyword]).catch(() => null);
    if (!intel || (intel.competitionLevel === "saturated") || intel.totalListingsEstimate < 20) continue;

    const isSeasonal = seasonalKeywords.includes(keyword);
    opportunities.push({
      keyword,
      category: topCategories[0] ?? "general",
      etsyListingCount: intel.totalListingsEstimate,
      etsyAvgPrice: intel.avgPrice,
      trendingScore: intel.opportunityScore,
      competitionLevel: intel.competitionLevel,
      topRelatedKeywords: intel.topTags.slice(0, 5),
      priceGap: intel.avgPrice > 18,
      source: isSeasonal ? "seasonal" : trendingKeywords.includes(keyword) ? "etsy_trending" : "performance_adjacency",
    });
  }

  const sorted = opportunities.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 25);
  const durationMs = Date.now() - start;
  await log("market-scout", { categories: topCategories, candidateCount: allCandidates.length }, sorted, {
    tokens: 500, cost: estimateCost(500), durationMs,
  });

  return sorted;
}
