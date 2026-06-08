import { prisma } from "@/lib/db/prisma";

export interface ProductPerformanceProfile {
  productId: string;
  title: string;
  format: string;
  emotionalTheme: string;
  nicheKeywords: string[];
  targetAudience: string;
  pricePoint: number;
  platform: string;
  totalRevenue: number;
  unitsSold: number;
  avgOrderValue: number;
  views: number;
  favorites: number;
  conversionRate: number;
  revenueScore: number;
  conversionScore: number;
  momentumScore: number;
  overallScore: number;
  tier: "hero" | "performer" | "average" | "underperformer" | "dead";
}

export interface PerformingPattern {
  dimension: "format" | "emotion" | "pricePoint" | "audience";
  value: string;
  avgRevenue: number;
  avgConversion: number;
  productCount: number;
  confidence: "high" | "medium" | "low";
}

export async function buildPerformanceModel(): Promise<ProductPerformanceProfile[]> {
  const [products, etsyListings, revenueRecords] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, status: { not: "archived" } },
      include: { etsyListings: true },
    }),
    prisma.etsyListing.findMany({ where: { status: "active" } }),
    prisma.revenueRecord.findMany({ orderBy: { date: "desc" } }),
  ]);

  if (products.length === 0) return [];

  // Revenue stats for normalization
  const revenues = products.map((p) => p.totalRevenue);
  const maxRevenue = Math.max(...revenues, 1);
  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;

  // 30-day window for momentum
  const now = Date.now();
  const day30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const day60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

  const revenueByProduct30: Record<string, number> = {};
  const revenueByProduct60: Record<string, number> = {};

  for (const r of revenueRecords) {
    if (!r.productId) continue;
    const t = r.date.getTime();
    if (t > day30.getTime()) {
      revenueByProduct30[r.productId] = (revenueByProduct30[r.productId] ?? 0) + r.revenue;
    } else if (t > day60.getTime()) {
      revenueByProduct60[r.productId] = (revenueByProduct60[r.productId] ?? 0) + r.revenue;
    }
  }

  const etsyMap = new Map(etsyListings.map((l) => [l.productId, l]));

  return products.map((p) => {
    const etsy = etsyMap.get(p.id);
    const views = etsy?.views ?? 0;
    const favorites = etsy?.favorites ?? 0;
    const unitsSold = p.totalSales;
    const conversionRate = views > 0 ? unitsSold / views : 0;

    const revenueScore = Math.min(100, Math.round((p.totalRevenue / maxRevenue) * 100));
    const conversionScore = Math.min(100, Math.round(conversionRate * 3000)); // 3% → 90

    const r30 = revenueByProduct30[p.id] ?? 0;
    const r60 = revenueByProduct60[p.id] ?? 0;
    const momentumScore = r60 > 0
      ? Math.min(100, Math.round(((r30 - r60) / r60) * 50 + 50))
      : r30 > 0 ? 75 : 25;

    const overallScore = Math.round(
      revenueScore * 0.4 + conversionScore * 0.3 + momentumScore * 0.3
    );

    const tier: ProductPerformanceProfile["tier"] =
      overallScore >= 75 ? "hero"
      : overallScore >= 55 ? "performer"
      : overallScore >= 35 ? "average"
      : unitsSold > 0 ? "underperformer"
      : "dead";

    const pricingStrategy = p.pricingStrategy as { digitalPrice?: number } | null;

    return {
      productId: p.id,
      title: p.title,
      format: p.type,
      emotionalTheme: p.targetEmotion,
      nicheKeywords: Array.isArray(p.keywords) ? (p.keywords as string[]).slice(0, 5) : [],
      targetAudience: p.targetAudience,
      pricePoint: pricingStrategy?.digitalPrice ?? 0,
      platform: etsy ? "etsy" : p.gumroadProductId ? "gumroad" : "both",
      totalRevenue: p.totalRevenue,
      unitsSold,
      avgOrderValue: unitsSold > 0 ? p.totalRevenue / unitsSold : 0,
      views,
      favorites,
      conversionRate,
      revenueScore,
      conversionScore,
      momentumScore,
      overallScore,
      tier,
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

export async function getTopPerformingPatterns(): Promise<PerformingPattern[]> {
  const profiles = await buildPerformanceModel();
  const topProducts = profiles.filter((p) => p.tier === "hero" || p.tier === "performer");

  if (topProducts.length === 0) return [];

  const patterns: PerformingPattern[] = [];

  // Format patterns
  const formatMap: Record<string, { revenues: number[]; conversions: number[] }> = {};
  for (const p of topProducts) {
    if (!formatMap[p.format]) formatMap[p.format] = { revenues: [], conversions: [] };
    formatMap[p.format].revenues.push(p.totalRevenue);
    formatMap[p.format].conversions.push(p.conversionRate);
  }
  for (const [format, data] of Object.entries(formatMap)) {
    const avgRevenue = data.revenues.reduce((a, b) => a + b, 0) / data.revenues.length;
    const avgConversion = data.conversions.reduce((a, b) => a + b, 0) / data.conversions.length;
    patterns.push({
      dimension: "format",
      value: format,
      avgRevenue,
      avgConversion,
      productCount: data.revenues.length,
      confidence: data.revenues.length >= 5 ? "high" : data.revenues.length >= 2 ? "medium" : "low",
    });
  }

  // Emotion patterns
  const emotionMap: Record<string, { revenues: number[]; conversions: number[] }> = {};
  for (const p of topProducts) {
    if (!emotionMap[p.emotionalTheme]) emotionMap[p.emotionalTheme] = { revenues: [], conversions: [] };
    emotionMap[p.emotionalTheme].revenues.push(p.totalRevenue);
    emotionMap[p.emotionalTheme].conversions.push(p.conversionRate);
  }
  for (const [emotion, data] of Object.entries(emotionMap)) {
    const avgRevenue = data.revenues.reduce((a, b) => a + b, 0) / data.revenues.length;
    const avgConversion = data.conversions.reduce((a, b) => a + b, 0) / data.conversions.length;
    patterns.push({
      dimension: "emotion",
      value: emotion,
      avgRevenue,
      avgConversion,
      productCount: data.revenues.length,
      confidence: data.revenues.length >= 3 ? "high" : data.revenues.length >= 2 ? "medium" : "low",
    });
  }

  return patterns.sort((a, b) => b.avgRevenue - a.avgRevenue);
}
