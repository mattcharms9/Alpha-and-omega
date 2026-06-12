export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rankProducts } from "@/lib/analytics/product-ranker";
import { buildPerformanceModel } from "@/lib/analytics/performance-model";
import { buildAttributionReport } from "@/lib/analytics/attribution";

export interface PortfolioStats {
  totalProducts: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalContent: number;
  productsByType: Record<string, number>;
  productsByEmotion: Record<string, number>;
  productsByStatus: Record<string, number>;
  platformRevenue: Record<string, number>;
  monthlyRevenueSeries: Array<{ date: string; revenue: number }>;
  avgVirality: number;
  contentByPlatform: Record<string, number>;
  topEmotions: Array<{ emotion: string; count: number; revenue: number }>;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "rankings") {
      const rankings = await rankProducts();
      return NextResponse.json({ success: true, data: rankings });
    }

    if (action === "performance") {
      const profiles = await buildPerformanceModel();
      return NextResponse.json({ success: true, data: profiles });
    }

    if (action === "attribution") {
      const days = parseInt(new URL(req.url).searchParams.get("days") ?? "30", 10);
      const report = await buildAttributionReport(days);
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "price-audit") {
      const { optimizeProductPrice } = await import("@/lib/ai/price-optimizer");
      const products = await prisma.product.findMany({
        where: { deletedAt: null, status: { in: ["published_etsy", "published"] } },
        select: { id: true },
        take: 20,
      });
      const reports = await Promise.allSettled(products.map((p) => optimizeProductPrice(p.id)));
      const results = reports
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof optimizeProductPrice>>> => r.status === "fulfilled")
        .map((r) => r.value);

      const underpriced = results.filter((r) => r.recommendedPrice > r.currentPrice * 1.1);
      const overpriced = results.filter((r) => r.recommendedPrice < r.currentPrice * 0.9);
      const correct = results.filter((r) => {
        const ratio = r.recommendedPrice / r.currentPrice;
        return ratio >= 0.9 && ratio <= 1.1;
      });

      return NextResponse.json({ success: true, data: { underpriced, overpriced, correct, total: results.length } });
    }

    if (action === "products") {
      const cards = await prisma.launchCard.findMany({
        where: { productId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const productIds = cards.map((c) => c.productId).filter((id): id is string => id !== null);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true, type: true, etsyListingUrl: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));
      const items = cards.map((c) => {
        const product = c.productId ? productMap.get(c.productId) : null;
        return {
          cardId: c.id,
          productId: c.productId ?? "",
          title: product?.title ?? c.productTitle,
          type: product?.type ?? c.productFormat,
          buildStatus: c.buildStatus,
          buildCompleteness: c.buildCompleteness,
          stagesFailed: c.stagesFailed,
          etsyListingUrl: product?.etsyListingUrl ?? null,
          failureReason: c.failureReason,
          publishedAt: c.publishedAt?.toISOString() ?? null,
        };
      });
      return NextResponse.json({ success: true, data: items });
    }

    if (action === "revenue-summary") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [allTime, thisMonth] = await Promise.all([
        prisma.revenueRecord.groupBy({ by: ["platform"], _sum: { revenue: true } }),
        prisma.revenueRecord.groupBy({ by: ["platform"], where: { date: { gte: monthStart } }, _sum: { revenue: true } }),
      ]);
      const sum = (data: typeof allTime, platform: string) =>
        data.find((r) => r.platform === platform)?._sum.revenue ?? 0;
      return NextResponse.json({
        success: true,
        data: {
          etsy: sum(allTime, "etsy"),
          gumroad: sum(allTime, "gumroad"),
          etsyMonth: sum(thisMonth, "etsy"),
          gumroadMonth: sum(thisMonth, "gumroad"),
        },
      });
    }
    const [products, revenueRecords, contentPieces] = await Promise.all([
      prisma.product.findMany({ select: { type: true, targetEmotion: true, status: true, totalRevenue: true, monthlyRevenue: true } }),
      prisma.revenueRecord.findMany({ orderBy: { date: "asc" } }),
      prisma.contentPiece.findMany({ select: { platform: true, virality: true } }),
    ]);

    const totalRevenue = revenueRecords.reduce((sum, r) => sum + r.revenue, 0);
    const monthlyRevenue = products.reduce((sum, p) => sum + p.monthlyRevenue, 0);

    const productsByType: Record<string, number> = {};
    const productsByEmotion: Record<string, number> = {};
    const productsByStatus: Record<string, number> = {};
    const emotionRevenue: Record<string, number> = {};

    for (const p of products) {
      productsByType[p.type] = (productsByType[p.type] ?? 0) + 1;
      productsByEmotion[p.targetEmotion] = (productsByEmotion[p.targetEmotion] ?? 0) + 1;
      productsByStatus[p.status] = (productsByStatus[p.status] ?? 0) + 1;
      emotionRevenue[p.targetEmotion] = (emotionRevenue[p.targetEmotion] ?? 0) + p.totalRevenue;
    }

    const platformRevenue: Record<string, number> = {};
    const monthlyMap: Record<string, number> = {};

    for (const r of revenueRecords) {
      platformRevenue[r.platform] = (platformRevenue[r.platform] ?? 0) + r.revenue;
      const monthKey = r.date.toISOString().slice(0, 7);
      monthlyMap[monthKey] = (monthlyMap[monthKey] ?? 0) + r.revenue;
    }

    const monthlyRevenueSeries = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));

    const contentByPlatform: Record<string, number> = {};
    let viralitySum = 0;
    for (const c of contentPieces) {
      contentByPlatform[c.platform] = (contentByPlatform[c.platform] ?? 0) + 1;
      viralitySum += c.virality;
    }
    const avgVirality = contentPieces.length > 0 ? viralitySum / contentPieces.length : 0;

    const topEmotions = Object.entries(productsByEmotion)
      .map(([emotion, count]) => ({ emotion, count, revenue: emotionRevenue[emotion] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const stats: PortfolioStats = {
      totalProducts: products.length,
      totalRevenue,
      monthlyRevenue,
      totalContent: contentPieces.length,
      productsByType,
      productsByEmotion,
      productsByStatus,
      platformRevenue,
      monthlyRevenueSeries,
      avgVirality,
      contentByPlatform,
      topEmotions,
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Portfolio API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
