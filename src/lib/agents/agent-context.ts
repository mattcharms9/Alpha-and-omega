import { prisma } from "@/lib/db/prisma";
import { getTopPerformingPatterns } from "@/lib/analytics/performance-model";
import { isColdStart, COLD_START_PERFORMANCE_PATTERNS, COLD_START_MANAGER_NOTE } from "./cold-start-defaults";
import type { AgentContext, CatalogSnapshot, SeasonalSignal, PerformingPatternAgent } from "./agent-types";

export async function buildAgentContext(queueId: string, date: string): Promise<AgentContext> {
  const [products, empireConfig, patterns] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, lifecycleStage: "active" },
      select: { keywords: true, title: true, type: true, targetEmotion: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.empireConfig.findFirst(),
    getTopPerformingPatterns().catch(() => []),
  ]);

  const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentlyPublished = products
    .filter((p) => p.createdAt > recentCutoff)
    .map((p) => p.title);

  const existingKeywords = products.flatMap((p) =>
    Array.isArray(p.keywords) ? (p.keywords as string[]).slice(0, 3) : []
  ).slice(0, 60);

  const formatCounts: Record<string, number> = {};
  const emotionCounts: Record<string, number> = {};
  for (const p of products) {
    formatCounts[p.type] = (formatCounts[p.type] ?? 0) + 1;
    emotionCounts[p.targetEmotion] = (emotionCounts[p.targetEmotion] ?? 0) + 1;
  }

  const topFormats = Object.entries(formatCounts).sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 4);
  const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 4);

  const catalogSnapshot: CatalogSnapshot = {
    totalProducts: products.length,
    activeProducts: products.length,
    topFormats,
    topEmotions,
    existingKeywords,
    recentlyPublished,
  };

  // Extract seasonal signals from empire config
  const seasonalSignals: SeasonalSignal[] = [];
  if (empireConfig?.lastSeasonalCalendar) {
    try {
      const cal = JSON.parse(empireConfig.lastSeasonalCalendar) as {
        publishNow?: Array<{ nicheName?: string; eventName?: string; daysUntilPeak?: number; formats?: string[] }>;
      };
      for (const e of (cal.publishNow ?? []).slice(0, 5)) {
        seasonalSignals.push({
          event: e.nicheName ?? e.eventName ?? "seasonal",
          daysUntilPeak: e.daysUntilPeak ?? 14,
          relevantFormats: e.formats ?? topFormats.slice(0, 2),
          urgency: (e.daysUntilPeak ?? 14) < 7 ? "now" : (e.daysUntilPeak ?? 14) < 14 ? "this_week" : "next_month",
        });
      }
    } catch {}
  }

  const performancePatterns: PerformingPatternAgent[] = patterns.map((p) => ({
    dimension: p.dimension,
    value: p.value,
    avgRevenue: p.avgRevenue,
    productCount: p.productCount,
  }));

  const coldStart = isColdStart(products.length, performancePatterns.length);

  return {
    queueId,
    date,
    catalogSnapshot,
    performancePatterns: coldStart ? COLD_START_PERFORMANCE_PATTERNS : performancePatterns,
    seasonalSignals,
    isColdStart: coldStart,
    coldStartNote: coldStart ? COLD_START_MANAGER_NOTE : null,
  };
}
