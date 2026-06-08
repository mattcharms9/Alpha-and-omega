import { prisma } from "@/lib/db/prisma";

export interface PerformanceInsight {
  topEmotions: Array<{ emotion: string; revenue: number; conversionRate: number }>;
  topProductTypes: Array<{ type: string; avgRevenue: number; avgRating: number }>;
  bestPricingRange: { min: number; max: number; avgRevenue: number };
  bestPlatform: { platform: string; revenue: number; conversionRate: number };
  worstPerformers: Array<{ productId: string; title: string; issue: string }>;
  seasonalTrends: Array<{ month: string; revenueIndex: number }>;
  hasData: boolean;
}

export async function computePerformanceInsights(): Promise<PerformanceInsight> {
  const [products, revenueRecords] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, title: true, targetEmotion: true, type: true, totalRevenue: true, totalSales: true, monthlyRevenue: true, rating: true, status: true },
    }),
    prisma.revenueRecord.findMany({
      orderBy: { date: "asc" },
    }),
  ]);

  const hasData = revenueRecords.length > 0 || products.some((p) => p.totalRevenue > 0);

  if (!hasData) {
    return {
      topEmotions: [],
      topProductTypes: [],
      bestPricingRange: { min: 7, max: 15, avgRevenue: 0 },
      bestPlatform: { platform: "etsy", revenue: 0, conversionRate: 0 },
      worstPerformers: [],
      seasonalTrends: [],
      hasData: false,
    };
  }

  // Aggregate by emotion
  const emotionMap: Record<string, { revenue: number; sales: number }> = {};
  for (const p of products) {
    if (!emotionMap[p.targetEmotion]) emotionMap[p.targetEmotion] = { revenue: 0, sales: 0 };
    emotionMap[p.targetEmotion].revenue += p.totalRevenue;
    emotionMap[p.targetEmotion].sales += p.totalSales;
  }
  const topEmotions = Object.entries(emotionMap)
    .map(([emotion, { revenue, sales }]) => ({
      emotion,
      revenue,
      conversionRate: sales > 0 ? Math.round((revenue / sales) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Aggregate by product type
  const typeMap: Record<string, { revenue: number; count: number; ratingSum: number }> = {};
  for (const p of products) {
    if (!typeMap[p.type]) typeMap[p.type] = { revenue: 0, count: 0, ratingSum: 0 };
    typeMap[p.type].revenue += p.totalRevenue;
    typeMap[p.type].count += 1;
    typeMap[p.type].ratingSum += p.rating;
  }
  const topProductTypes = Object.entries(typeMap)
    .map(([type, { revenue, count, ratingSum }]) => ({
      type,
      avgRevenue: count > 0 ? revenue / count : 0,
      avgRating: count > 0 ? ratingSum / count : 0,
    }))
    .sort((a, b) => b.avgRevenue - a.avgRevenue);

  // Platform aggregation
  const platformMap: Record<string, { revenue: number; sales: number }> = {};
  for (const r of revenueRecords) {
    if (!platformMap[r.platform]) platformMap[r.platform] = { revenue: 0, sales: 0 };
    platformMap[r.platform].revenue += r.revenue;
    platformMap[r.platform].sales += r.sales;
  }
  const bestPlatformEntry = Object.entries(platformMap).sort(([, a], [, b]) => b.revenue - a.revenue)[0];
  const bestPlatform = bestPlatformEntry
    ? {
        platform: bestPlatformEntry[0],
        revenue: bestPlatformEntry[1].revenue,
        conversionRate: bestPlatformEntry[1].sales > 0 ? bestPlatformEntry[1].revenue / bestPlatformEntry[1].sales : 0,
      }
    : { platform: "etsy", revenue: 0, conversionRate: 0 };

  // Monthly trend
  const monthlyMap: Record<string, number> = {};
  for (const r of revenueRecords) {
    const key = r.date.toISOString().slice(0, 7);
    monthlyMap[key] = (monthlyMap[key] ?? 0) + r.revenue;
  }
  const totalMonthly = Object.values(monthlyMap).reduce((a, b) => a + b, 0);
  const avgMonthly = totalMonthly / Math.max(Object.keys(monthlyMap).length, 1);
  const seasonalTrends = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenueIndex: avgMonthly > 0 ? Math.round((revenue / avgMonthly) * 100) : 100 }));

  // Worst performers
  const worstPerformers = products
    .filter((p) => p.status === "active" && p.totalSales === 0)
    .slice(0, 3)
    .map((p) => ({ productId: p.id, title: p.title, issue: "Active but zero sales" }));

  return {
    topEmotions,
    topProductTypes,
    bestPricingRange: { min: 7, max: 15, avgRevenue: avgMonthly },
    bestPlatform,
    worstPerformers,
    seasonalTrends,
    hasData: true,
  };
}
