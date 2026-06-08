import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  computeEmpireScore,
  computeSignalFreshness,
  generateOperatorBrief,
  generateNextBestAction,
  generateStrategicAlerts,
  type EmpireState,
} from "@/lib/ai/empire-engine";
import { generateTodaysPriority } from "@/lib/ai/priority-engine";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";

async function buildEmpireState(): Promise<EmpireState> {
  const [signals, brands, products, contentPieces, revenueAgg] = await Promise.all([
    prisma.bankedSignal.findMany({ orderBy: { opportunityScore: "desc" } }),
    prisma.brand.findMany(),
    prisma.product.findMany(),
    prisma.contentPiece.findMany(),
    prisma.revenueRecord.aggregate({ _sum: { revenue: true } }),
  ]);
  const totalRevenue = revenueAgg._sum.revenue ?? 0;

  const now = Date.now();
  const decayingSignals = signals.filter((s) => {
    if (s.activatedAt) return false;
    const freshness = computeSignalFreshness(s.createdAt);
    return freshness < 70;
  });

  const activatedSignals = signals.filter((s) => s.activatedAt !== null);

  const territoryMap = new Map<string, { signals: typeof signals; hasActivated: boolean }>();
  for (const s of signals) {
    const t = s.territory || s.emotion;
    if (!territoryMap.has(t)) territoryMap.set(t, { signals: [], hasActivated: false });
    const entry = territoryMap.get(t)!;
    entry.signals.push(s);
    if (s.activatedAt) entry.hasActivated = true;
  }

  const territories = Array.from(territoryMap.entries()).map(([name, { signals: tsigs, hasActivated }]) => {
    const avgMon = tsigs.reduce((sum, s) => sum + s.monetizationScore, 0) / tsigs.length;
    const dominanceScore = Math.min(100, tsigs.length * 20 + avgMon * 5);
    const hasProduct = brands.some((b) => b.emotionalCategory?.toLowerCase().includes(name.toLowerCase()));
    const status: "scouted" | "claimed" | "developed" | "operating" =
      products.length > 0 && hasProduct ? "operating" :
      hasActivated && hasProduct ? "developed" :
      hasActivated ? "claimed" : "scouted";
    return { name, signalCount: tsigs.length, dominanceScore, status };
  });

  const topSignal = signals[0] ? {
    painPoint: signals[0].painPoint,
    emotion: signals[0].emotion,
    monetizationScore: signals[0].monetizationScore,
    opportunityScore: signals[0].opportunityScore,
  } : null;

  const revenuePotential = Math.max(totalRevenue, brands.length * 8500);
  const unrealizedRevenue = (brands.length - activatedSignals.length) * 8500;

  const partialState = {
    totalRevenue,
    signalCount: signals.length,
    activatedSignalCount: activatedSignals.length,
    decayingSignalCount: decayingSignals.length,
    uniqueTerritoriesOwned: territoryMap.size,
    brandsBuilt: brands.length,
    productsGenerated: products.length,
    contentPiecesCreated: contentPieces.length,
    estimatedMonthlyRevenuePotential: `$${(revenuePotential / 1000).toFixed(0)}K`,
    unrealizedRevenueGap: `$${(Math.max(0, unrealizedRevenue) / 1000).toFixed(0)}K`,
    activeAlertCount: 0,
    topSignal,
    territories,
    highestROIMove: "",
  };

  const { empireScore, moatScore } = computeEmpireScore(partialState);

  const dayOfYear = Math.floor((now - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const weeklyMomentumIndex = Math.min(100, empireScore / 10 + (signals.length > 0 ? 20 : 0));

  return {
    ...partialState,
    empireScore,
    moatScore,
    weeklyMomentumIndex,
  };
}

async function generateFreshBrief(state: EmpireState) {
  const [brief, nextAction, alerts] = await Promise.all([
    generateOperatorBrief(state),
    generateNextBestAction(state),
    generateStrategicAlerts(state),
  ]);
  return { brief, nextAction, alerts };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "state";

    if (action === "brief") {
      const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
      if (!rl.success) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please wait before trying again." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
      }
    }

    const state = await buildEmpireState();

    if (action === "state") {
      return NextResponse.json({ success: true, data: state });
    }

    if (action === "brief") {
      const BRIEF_TTL_MS = 15 * 60 * 1000;
      const cached = await prisma.empireConfig.findFirst();
      const isFresh = cached?.lastBriefAt && (Date.now() - cached.lastBriefAt.getTime()) < BRIEF_TTL_MS;

      type BriefData = Awaited<ReturnType<typeof generateFreshBrief>>;
      let briefData: BriefData;

      if (isFresh && cached?.lastBrief) {
        try {
          briefData = JSON.parse(cached.lastBrief) as BriefData;
        } catch {
          briefData = await generateFreshBrief(state);
        }
      } else {
        briefData = await generateFreshBrief(state);
        await prisma.empireConfig.upsert({
          where: { id: "singleton" },
          create: { id: "singleton", lastBrief: JSON.stringify(briefData), lastBriefAt: new Date() },
          update: { lastBrief: JSON.stringify(briefData), lastBriefAt: new Date() },
        });
        await prisma.strategicAlert.createMany({
          data: briefData.alerts.map((a) => ({ type: a.type, title: a.title, body: a.body, actionLabel: a.actionLabel, actionHref: a.actionHref })),
        });
      }

      return NextResponse.json({ success: true, data: { state, ...briefData } });
    }

    if (action === "priority") {
      const priority = await generateTodaysPriority();
      return NextResponse.json({ success: true, data: priority });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Empire API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
