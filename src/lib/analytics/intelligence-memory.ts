import { generateJSON } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { EmotionalTrend } from "@/lib/ai/intelligence-engine";
import type { Prisma } from "@prisma/client";

export type InsightType =
  | "hot_niche"
  | "saturating_niche"
  | "price_discovery"
  | "audience_finding"
  | "format_insight";

export interface IntelligenceInsight {
  id: string;
  discoveredAt: string;
  insightType: InsightType;
  content: string;
  supportingData: Record<string, unknown>;
  actionTaken: boolean;
  productId: string | null;
  revenue: number;
}

const SYSTEM_PROMPT = `You are an intelligence extraction engine for a digital product seller.

Given a set of emotional trend scan results, extract the 3–5 most valuable insights the seller should remember.

Focus on insights that are:
1. Specific and actionable (not generic observations)
2. Different from what a seller could guess without the scan
3. Time-sensitive (things that matter now or will matter soon)
4. Revenue-relevant (connected to what might sell)

For each insight, assign a type:
- hot_niche: A specific niche with clear buyer demand right now
- saturating_niche: A niche that's getting crowded quickly
- price_discovery: Information about what price points are working or available
- audience_finding: A specific audience segment with unmet needs
- format_insight: Information about which product formats are winning or losing

Return valid JSON array.`;

export async function extractInsightsFromScan(
  trends: EmotionalTrend[]
): Promise<IntelligenceInsight[]> {
  if (trends.length === 0) return [];

  const trendSummary = trends.map((t) => ({
    emotion: t.emotion,
    painPoint: t.painPoint,
    monetizationScore: t.monetizationScore,
    competitionLevel: t.competitionLevel,
    searchVolumeTrend: t.searchVolumeTrend,
    realListings: t.realMarketData?.totalListingsEstimate ?? null,
    realAvgPrice: t.realMarketData?.avgPrice ?? null,
  }));

  const result = await generateJSON<Array<{
    insightType: InsightType;
    content: string;
    supportingData: Record<string, unknown>;
  }>>(
    SYSTEM_PROMPT,
    `Extract 3-5 key insights from this scan:\n${JSON.stringify(trendSummary, null, 2)}\n\nReturn JSON array: [{ insightType, content (1-2 specific sentences), supportingData (key data points) }]`,
    1500
  ).catch(() => []);

  if (!Array.isArray(result) || result.length === 0) return [];

  const saved = await Promise.all(
    result.map((insight) =>
      prisma.intelligenceInsight.create({
        data: {
          insightType: insight.insightType,
          content: insight.content,
          supportingData: insight.supportingData as Prisma.InputJsonValue,
        },
      }).catch(() => null)
    )
  );

  return saved
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({
      id: s.id,
      discoveredAt: s.discoveredAt.toISOString(),
      insightType: s.insightType as InsightType,
      content: s.content,
      supportingData: s.supportingData as Record<string, unknown>,
      actionTaken: s.actionTaken,
      productId: s.productId,
      revenue: s.revenue,
    }));
}

export async function getInsightHistory(limit = 50): Promise<IntelligenceInsight[]> {
  const records = await prisma.intelligenceInsight.findMany({
    orderBy: { discoveredAt: "desc" },
    take: limit,
  });

  return records.map((s) => ({
    id: s.id,
    discoveredAt: s.discoveredAt.toISOString(),
    insightType: s.insightType as InsightType,
    content: s.content,
    supportingData: s.supportingData as Record<string, unknown>,
    actionTaken: s.actionTaken,
    productId: s.productId,
    revenue: s.revenue,
  }));
}
