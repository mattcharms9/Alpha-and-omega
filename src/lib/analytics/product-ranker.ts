import { prisma } from "@/lib/db/prisma";

export interface ProductPerformanceRank {
  productId: string;
  title: string;
  platform: string;
  views: number;
  sales: number;
  revenue: number;
  conversionRate: number;
  revenuePerView: number;
  daysSinceLive: number;
  tier: "top" | "mid" | "underperforming" | "no_data";
  recommendation: string;
}

function getTier(
  views: number,
  sales: number,
  revenue: number,
  daysSinceLive: number
): "top" | "mid" | "underperforming" | "no_data" {
  if (views === 0 || daysSinceLive < 14) return "no_data";
  const rate = sales / views;
  if (rate > 0.02 || revenue > 50) return "top";
  if (rate >= 0.005 || revenue >= 10) return "mid";
  return "underperforming";
}

function getRecommendation(
  tier: "top" | "mid" | "underperforming" | "no_data",
  views: number
): string {
  if (tier === "top") return "Duplicate this product into 3 variations";
  if (tier === "mid") return "Test a higher price point";
  if (tier === "underperforming" && views >= 50)
    return "Rewrite title and tags — traffic exists but not converting";
  if (tier === "underperforming")
    return "Boost with Pinterest pin — needs more traffic";
  return "Too early to judge — check back in 14 days";
}

export async function rankProducts(): Promise<ProductPerformanceRank[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      platforms: true,
      totalRevenue: true,
      totalSales: true,
      createdAt: true,
      listingVariants: {
        select: { impressions: true, platform: true, isActive: true },
      },
    },
  });

  const now = Date.now();

  return products.map((p) => {
    const platform =
      p.listingVariants.find((v) => v.isActive)?.platform ??
      (Array.isArray(p.platforms) && p.platforms.length > 0
        ? String(p.platforms[0])
        : "unknown");

    const views = p.listingVariants.reduce((sum, v) => sum + v.impressions, 0);
    const sales = p.totalSales;
    const revenue = p.totalRevenue;
    const daysSinceLive = Math.floor(
      (now - new Date(p.createdAt).getTime()) / 86400000
    );
    const conversionRate = views > 0 ? sales / views : 0;
    const revenuePerView = views > 0 ? revenue / views : 0;
    const tier = getTier(views, sales, revenue, daysSinceLive);

    return {
      productId: p.id,
      title: p.title,
      platform,
      views,
      sales,
      revenue,
      conversionRate,
      revenuePerView,
      daysSinceLive,
      tier,
      recommendation: getRecommendation(tier, views),
    };
  });
}
