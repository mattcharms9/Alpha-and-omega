import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/claude";

export interface KeywordMetrics {
  keyword: string;
  monthlySearches: number | null;
  competition: "low" | "medium" | "high";
  avgPrice: number | null;
  topSellers: number | null;
  trend: "rising" | "stable" | "declining";
  isEstimated: boolean;
  source: "erank" | "ai_estimate";
}

export interface KeywordReport {
  primaryKeyword: KeywordMetrics;
  relatedKeywords: KeywordMetrics[];
  bestKeyword: KeywordMetrics;
  overallOpportunityScore: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are an Etsy market analyst. Estimate keyword metrics for digital product keywords based on typical Etsy search patterns. Return realistic estimates for search volume, competition level, average price, and market trend.`;

async function estimateWithAI(keyword: string): Promise<KeywordMetrics> {
  const result = await generateJSON<KeywordMetrics>(
    SYSTEM_PROMPT,
    `Estimate Etsy keyword metrics for: "${keyword}"

Return JSON with this exact shape:
{
  "keyword": "${keyword}",
  "monthlySearches": <number between 200 and 50000>,
  "competition": "low" | "medium" | "high",
  "avgPrice": <number in dollars>,
  "topSellers": <number of listings with 100+ sales>,
  "trend": "rising" | "stable" | "declining",
  "isEstimated": true,
  "source": "ai_estimate"
}`,
    512,
    "keyword-intelligence"
  );
  return { ...result, isEstimated: true, source: "ai_estimate" };
}

async function fetchFromErank(keyword: string): Promise<KeywordMetrics | null> {
  const apiKey = process.env.ERANK_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.erank.com/v2/keywords?query=${encodeURIComponent(keyword)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { keywords?: Array<{ keyword: string; monthly_searches: number; competition_score: number; average_price: number; top_seller_count: number; trend: string }> };
    const kw = data.keywords?.[0];
    if (!kw) return null;

    return {
      keyword,
      monthlySearches: kw.monthly_searches ?? null,
      competition: kw.competition_score < 33 ? "low" : kw.competition_score < 67 ? "medium" : "high",
      avgPrice: kw.average_price ?? null,
      topSellers: kw.top_seller_count ?? null,
      trend: (kw.trend as KeywordMetrics["trend"]) ?? "stable",
      isEstimated: false,
      source: "erank",
    };
  } catch {
    return null;
  }
}

async function getMetricsWithCache(keyword: string): Promise<KeywordMetrics> {
  const cached = await prisma.keywordCache.findFirst({
    where: { keyword, expiresAt: { gt: new Date() } },
  });
  if (cached) return cached.metricsJson as unknown as KeywordMetrics;

  const live = await fetchFromErank(keyword);
  const metrics = live ?? (await estimateWithAI(keyword));

  await prisma.keywordCache.upsert({
    where: { keyword },
    create: { keyword, metricsJson: metrics as object, source: metrics.source, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
    update: { metricsJson: metrics as object, source: metrics.source, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
  });

  return metrics;
}

function computeOpportunityScore(metrics: KeywordMetrics): number {
  if (metrics.isEstimated) return 0;
  const searchScore = Math.min(100, ((metrics.monthlySearches ?? 0) / 20000) * 100);
  const competitionBonus = metrics.competition === "low" ? 30 : metrics.competition === "medium" ? 10 : 0;
  const trendBonus = metrics.trend === "rising" ? 15 : metrics.trend === "stable" ? 5 : 0;
  return Math.round(Math.min(100, searchScore * 0.55 + competitionBonus + trendBonus));
}

export async function getKeywordMetrics(
  primaryKeyword: string,
  relatedTerms: string[] = []
): Promise<KeywordReport> {
  const [primary, ...related] = await Promise.all([
    getMetricsWithCache(primaryKeyword),
    ...relatedTerms.slice(0, 4).map((t) => getMetricsWithCache(t)),
  ]);

  const allMetrics = [primary, ...related];
  const bestKeyword = allMetrics.reduce((best, cur) => {
    const bestScore = computeOpportunityScore(best);
    const curScore = computeOpportunityScore(cur);
    return curScore > bestScore ? cur : best;
  }, primary);

  const overallOpportunityScore = primary.isEstimated
    ? 0
    : computeOpportunityScore(primary);

  return { primaryKeyword: primary, relatedKeywords: related, bestKeyword, overallOpportunityScore };
}
