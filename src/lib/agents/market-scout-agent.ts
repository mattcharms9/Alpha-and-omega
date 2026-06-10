import { generateJSON } from "@/lib/ai/claude";
import { fetchEtsySearchIntelligence, fetchEtsyTrendingSearches } from "@/lib/ai/etsy-market-engine";
import { prisma } from "@/lib/db/prisma";
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

  // 1. Load last 24h market intelligence reports from DB
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoffDate = yesterday.toISOString().slice(0, 10);

  const liveReports = await prisma.marketIntelligenceReport.findMany({
    where: { reportDate: { gte: cutoffDate } },
    orderBy: { opportunityScore: "desc" },
    take: 25,
    select: {
      niche: true,
      opportunityScore: true,
      competitionLevel: true,
      winningPriceRange: true,
      totalListings: true,
      winningTags: true,
      winningTitleStructures: true,
      productOpportunities: true,
    },
  }).catch(() => []);

  // 2. If we have live data with real Etsy listings, use it as primary source
  // Filter out empty-data reports (Etsy API failure at scan time) to avoid poisoning the pipeline
  const usableReports = liveReports.filter((r) => r.totalListings > 0);
  if (usableReports.length >= 5) {
    const opportunities: MarketOpportunity[] = usableReports
      .filter((r) => r.competitionLevel !== "saturated")
      .map((r) => {
        const priceRange = r.winningPriceRange as { min: number; max: number; sweet: number } | null;
        const tags = (r.winningTags as string[]) ?? [];
        return {
          keyword: r.niche,
          category: r.niche.split(" ").slice(-1)[0] ?? "general",
          etsyListingCount: r.totalListings,
          etsyAvgPrice: priceRange?.sweet ?? 12,
          trendingScore: r.opportunityScore,
          competitionLevel: r.competitionLevel as MarketOpportunity["competitionLevel"],
          topRelatedKeywords: tags.slice(0, 5),
          priceGap: (priceRange?.sweet ?? 12) > 18,
          source: "etsy_trending" as const,
        };
      })
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 25);

    const durationMs = Date.now() - start;
    await log("market-scout", { source: "live_db", reportCount: usableReports.length }, opportunities, {
      tokens: 0, cost: 0, durationMs,
    });

    return opportunities;
  }

  // 3. Fall back to live Etsy API + AI if no DB reports available yet
  const topCategories = ctx.performancePatterns
    .filter((p) => p.dimension === "emotion")
    .slice(0, 3)
    .map((p) => p.value);

  const trendingKeywords: string[] = [];
  for (const cat of topCategories.slice(0, 2)) {
    const trends = await fetchEtsyTrendingSearches(cat).catch(() => []);
    trendingKeywords.push(...trends.slice(0, 5));
  }

  const seasonalKeywords = ctx.seasonalSignals
    .filter((s) => s.daysUntilPeak <= 30)
    .map((s) => s.event);

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

  const opportunities: MarketOpportunity[] = [];
  for (const keyword of allCandidates) {
    const intel = await fetchEtsySearchIntelligence([keyword]).catch(() => null);
    if (!intel || intel.competitionLevel === "saturated" || intel.totalListingsEstimate < 20) continue;

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
  await log("market-scout", { source: "ai_fallback", categories: topCategories, candidateCount: allCandidates.length }, sorted, {
    tokens: 500, cost: estimateCost(500), durationMs,
  });

  return sorted;
}
