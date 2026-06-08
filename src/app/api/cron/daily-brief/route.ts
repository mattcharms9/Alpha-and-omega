import { NextRequest, NextResponse } from "next/server";
import { computePerformanceInsights } from "@/lib/analytics/revenue-aggregator";
import { sendDailyBrief } from "@/lib/notifications/email";
import { toSafeErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import {
  computeEmpireScore,
  computeSignalFreshness,
  type EmpireState,
} from "@/lib/ai/empire-engine";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [signals, brands, products, contentPieces, revenueAgg] = await Promise.all([
      prisma.bankedSignal.findMany({ orderBy: { opportunityScore: "desc" } }),
      prisma.brand.findMany(),
      prisma.product.findMany(),
      prisma.contentPiece.findMany(),
      prisma.revenueRecord.aggregate({ _sum: { revenue: true } }),
    ]);

    const totalRevenue = revenueAgg._sum.revenue ?? 0;
    const decayingSignals = signals.filter((s) => !s.activatedAt && computeSignalFreshness(s.createdAt) < 70);
    const activatedSignals = signals.filter((s) => s.activatedAt !== null);

    const partialState = {
      totalRevenue,
      signalCount: signals.length,
      activatedSignalCount: activatedSignals.length,
      decayingSignalCount: decayingSignals.length,
      uniqueTerritoriesOwned: new Set(signals.map((s) => s.territory || s.emotion)).size,
      brandsBuilt: brands.length,
      productsGenerated: products.length,
      contentPiecesCreated: contentPieces.length,
      estimatedMonthlyRevenuePotential: `$${(Math.max(totalRevenue, brands.length * 8500) / 1000).toFixed(0)}K`,
      unrealizedRevenueGap: `$${(Math.max(0, (brands.length - activatedSignals.length) * 8500) / 1000).toFixed(0)}K`,
      activeAlertCount: 0,
      topSignal: signals[0] ? { painPoint: signals[0].painPoint, emotion: signals[0].emotion, monetizationScore: signals[0].monetizationScore, opportunityScore: signals[0].opportunityScore } : null,
      territories: [],
      highestROIMove: "",
    };

    const { empireScore, moatScore } = computeEmpireScore(partialState);
    const state: EmpireState = {
      ...partialState,
      empireScore,
      moatScore,
      weeklyMomentumIndex: Math.min(100, empireScore / 10 + (signals.length > 0 ? 20 : 0)),
    };

    const performance = await computePerformanceInsights();

    await sendDailyBrief({ state, performance });

    return NextResponse.json({ success: true, sentAt: new Date().toISOString() });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
