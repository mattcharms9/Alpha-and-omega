import { NextRequest, NextResponse } from "next/server";
import { discoverEmotionalTrends, scoreNiche } from "@/lib/ai/intelligence-engine";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { generateSeasonalCalendar } from "@/lib/ai/seasonal-engine";
import { generateQuickIdeas } from "@/lib/ai/quick-ideas-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import type { SeasonalCalendar } from "@/lib/ai/seasonal-engine";

const SEASONAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CacheSaveSchema = z.object({
  scanType: z.string().default("full"),
  result: z.record(z.string(), z.unknown()),
});

const ScanSchema = z.object({
  focusArea: z.string().optional(),
  count: z.number().min(1).max(20).optional().default(8),
  performanceContext: z.any().optional(),
});

const ScoreSchema = z.object({
  niche: z.string().min(1),
  emotionalCategory: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const action = new URL(req.url).searchParams.get("action");

  if (action === "insight-history") {
    try {
      const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "50", 10);
      const { getInsightHistory } = await import("@/lib/analytics/intelligence-memory");
      const insights = await getInsightHistory(limit);
      return NextResponse.json({ success: true, data: insights });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  if (action === "quick-ideas") {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    try {
      const ideas = await generateQuickIdeas(q);
      return NextResponse.json({ success: true, data: ideas });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  if (action === "cache-get") {
    const scanType = new URL(req.url).searchParams.get("scanType") ?? "full";
    try {
      const entry = await prisma.scanCache.findFirst({
        where: { scanType, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (!entry) return new NextResponse(null, { status: 204 });
      return NextResponse.json({
        success: true,
        data: { result: entry.resultJson, createdAt: entry.createdAt },
      });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  if (action !== "seasonal") {
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }

  try {
    const cached = await prisma.empireConfig.findFirst();
    const isFresh =
      cached?.lastSeasonalAt &&
      Date.now() - cached.lastSeasonalAt.getTime() < SEASONAL_TTL_MS;

    let calendar: SeasonalCalendar;
    if (isFresh && cached?.lastSeasonalCalendar) {
      try {
        calendar = JSON.parse(cached.lastSeasonalCalendar) as SeasonalCalendar;
      } catch {
        calendar = await generateSeasonalCalendar();
      }
    } else {
      calendar = await generateSeasonalCalendar();
      await prisma.empireConfig.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", lastSeasonalCalendar: JSON.stringify(calendar), lastSeasonalAt: new Date() },
        update: { lastSeasonalCalendar: JSON.stringify(calendar), lastSeasonalAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, data: calendar });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "scan";

    if (action === "score") {
      const { niche, emotionalCategory } = ScoreSchema.parse(body);
      const result = await scoreNiche(niche, emotionalCategory);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "cache-save") {
      const { scanType, result } = CacheSaveSchema.parse(body);
      await prisma.scanCache.create({
        data: {
          scanType,
          resultJson: result as object,
          expiresAt: new Date(Date.now() + SCAN_CACHE_TTL_MS),
        },
      });
      // Keep only the 5 most recent per scanType
      const old = await prisma.scanCache.findMany({
        where: { scanType },
        orderBy: { createdAt: "desc" },
        skip: 5,
        select: { id: true },
      });
      if (old.length > 0) {
        await prisma.scanCache.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
      }
      return NextResponse.json({ success: true });
    }

    const { focusArea, count, performanceContext } = ScanSchema.parse(body);

    // Inject performance patterns if available
    let performingPatterns;
    try {
      const { getTopPerformingPatterns } = await import("@/lib/analytics/performance-model");
      performingPatterns = await getTopPerformingPatterns().catch(() => undefined);
    } catch {}

    const report = await discoverEmotionalTrends(focusArea, count, performanceContext, false, performingPatterns);

    // Fire-and-forget: extract insights from this scan
    void (async () => {
      try {
        const { extractInsightsFromScan } = await import("@/lib/analytics/intelligence-memory");
        await extractInsightsFromScan(report.trends);
      } catch {}
    })();

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    console.error("Intelligence API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
