import { generateJSON } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { searchTopListings, searchRisingListings, getPriceDistribution, getListingCount } from "./etsy-client";
import { analyzeNicheMarket, saveMarketReport } from "./analyzer";
import { analyzeVisualStyle } from "./visual-analyzer";
import { TRACKED_NICHES } from "./types";

const CHUNK_SIZE = 5;
const NICHE_TIMEOUT_MS = 25_000;
const CLAUDE_TIMEOUT_MS = 20_000;

const SUMMARY_PROMPT = `You are a market intelligence analyst. Summarize today's Etsy market findings in 2-3 sentences. Focus on actionable insights: which niches are hottest, any price shifts, and the single best opportunity right now.`;

const toJson = <T>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function race<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)),
  ]);
}

export async function runNicheScan(niche: string, reportDate: string) {
  const [topSellers, risingListings, priceDistribution, totalListings] = await Promise.all([
    searchTopListings(niche, 20).catch((err) => { console.error(`[run-scan] Etsy topSellers failed for "${niche}":`, err instanceof Error ? err.message : err); return [] as Awaited<ReturnType<typeof searchTopListings>>; }),
    searchRisingListings(niche, 12).catch((err) => { console.error(`[run-scan] Etsy risingListings failed for "${niche}":`, err instanceof Error ? err.message : err); return [] as Awaited<ReturnType<typeof searchRisingListings>>; }),
    getPriceDistribution(niche).catch((err) => { console.error(`[run-scan] Etsy priceDistribution failed for "${niche}":`, err instanceof Error ? err.message : err); return [] as Awaited<ReturnType<typeof getPriceDistribution>>; }),
    getListingCount(niche).catch((err) => { console.error(`[run-scan] Etsy listingCount failed for "${niche}":`, err instanceof Error ? err.message : err); return 0; }),
  ]);

  if (topSellers.length === 0 && totalListings === 0) {
    console.warn(`[run-scan] Skipping "${niche}" — all Etsy calls returned empty.`);
    return { report: null, totalListings: 0 };
  }

  const imageUrls = topSellers.slice(0, 5).map((s) => s.imageUrl).filter(Boolean);

  const [analysis, visualStyle] = await Promise.all([
    race(
      analyzeNicheMarket(niche, topSellers, risingListings, priceDistribution, totalListings),
      CLAUDE_TIMEOUT_MS,
      `analyzeNicheMarket(${niche})`
    ),
    race(
      analyzeVisualStyle(niche, imageUrls),
      CLAUDE_TIMEOUT_MS,
      `analyzeVisualStyle(${niche})`
    ),
  ]);

  const report = await saveMarketReport(niche, reportDate, topSellers, risingListings, priceDistribution, totalListings, analysis, visualStyle);

  // Auto-save high-opportunity niches to Signal Bank
  if (report && report.opportunityScore >= 90) {
    const priceRange = report.winningPriceRange as { sweet?: number } | null;
    const opportunities = report.productOpportunities as Array<{ title?: string; description?: string }> | null;
    const topOpportunity = opportunities?.[0]?.title ?? opportunities?.[0]?.description ?? niche;
    await prisma.signal.upsert({
      where: { niche_reportDate: { niche, reportDate } },
      update: { opportunityScore: report.opportunityScore },
      create: {
        niche,
        reportDate,
        opportunityScore: report.opportunityScore,
        competitionLevel: report.competitionLevel,
        totalListings,
        sweetSpotPrice: priceRange?.sweet ?? null,
        topOpportunity,
        autoSaved: true,
        sourceReportId: report.id,
      },
    }).catch((err) => {
      console.error(`[run-scan] Failed to auto-save signal for "${niche}":`, err instanceof Error ? err.message : err);
    });
    console.log(`[run-scan] 🔥 Auto-saved signal for "${niche}" (score: ${report.opportunityScore})`);
  }

  return { report, totalListings };
}

export interface ChunkResult {
  completed: number;
  total: number;
  nextStart: number;
  isComplete: boolean;
  nichesAnalyzed: number;
  topOpportunities: Array<{ niche: string; opportunityScore: number; competitionLevel: string }>;
}

export async function runFullScan(startFrom = 0): Promise<ChunkResult> {
  const reportDate = new Date().toISOString().slice(0, 10);
  const chunk = TRACKED_NICHES.slice(startFrom, startFrom + CHUNK_SIZE);
  const results: Array<{ niche: string; opportunityScore: number; competitionLevel: string }> = [];

  for (const niche of chunk) {
    try {
      const { report, totalListings } = await race(
        runNicheScan(niche, reportDate),
        NICHE_TIMEOUT_MS,
        `runNicheScan(${niche})`
      );
      if (report) {
        results.push({ niche, opportunityScore: report.opportunityScore, competitionLevel: report.competitionLevel });
        console.log(`[market-intelligence] ✓ ${niche} — score: ${report.opportunityScore}, listings: ${totalListings}`);
      } else {
        console.warn(`[market-intelligence] ⚠ ${niche} — skipped (no Etsy data)`);
      }
    } catch (err) {
      console.error(`[market-intelligence] ✗ ${niche}:`, err instanceof Error ? err.message : err);
    }
    await delay(300);
  }

  const nextStart = startFrom + CHUNK_SIZE;
  const isComplete = nextStart >= TRACKED_NICHES.length;

  // On final chunk, write market snapshot
  if (isComplete) {
    const allReports = await prisma.marketIntelligenceReport.findMany({
      where: { reportDate },
      orderBy: { opportunityScore: "desc" },
      take: 5,
      select: { niche: true, opportunityScore: true, competitionLevel: true },
    });

    const marketSummary = await generateJSON<{ summary: string }>(
      SUMMARY_PROMPT,
      `Today's market data:\nTop opportunities: ${allReports.map((r) => `${r.niche} (score: ${r.opportunityScore}, ${r.competitionLevel} competition)`).join("; ")}\nTotal niches analyzed: ${allReports.length}\n\nWrite a 2-3 sentence market summary as JSON: { "summary": "..." }`,
      300
    )
      .then((r) => r.summary)
      .catch(() => `Analyzed ${allReports.length} niches today. Top opportunity: ${allReports[0]?.niche ?? "N/A"}.`);

    const totalListingsPulled = await prisma.marketIntelligenceReport.aggregate({
      where: { reportDate },
      _sum: { totalListings: true },
    }).then((r) => r._sum.totalListings ?? 0);

    await prisma.etsyMarketSnapshot.upsert({
      where: { snapshotDate: reportDate },
      update: { nichesAnalyzed: allReports.length, totalListingsPulled, topOpportunities: toJson(allReports), marketSummary },
      create: { snapshotDate: reportDate, nichesAnalyzed: allReports.length, totalListingsPulled, topOpportunities: toJson(allReports), marketSummary },
    }).catch((err) => {
      console.error("[run-scan] Failed to upsert market snapshot:", err instanceof Error ? err.message : err);
    });
  }

  return {
    completed: Math.min(nextStart, TRACKED_NICHES.length),
    total: TRACKED_NICHES.length,
    nextStart,
    isComplete,
    nichesAnalyzed: results.length,
    topOpportunities: results,
  };
}

export async function getLatestSnapshot() {
  return prisma.etsyMarketSnapshot.findFirst({
    orderBy: { createdAt: "desc" },
  });
}

export async function getAllNicheReports(reportDate?: string) {
  const date = reportDate ?? new Date().toISOString().slice(0, 10);
  return prisma.marketIntelligenceReport.findMany({
    where: { reportDate: date },
    orderBy: { opportunityScore: "desc" },
    select: {
      id: true,
      niche: true,
      reportDate: true,
      competitionLevel: true,
      opportunityScore: true,
      winningPriceRange: true,
      winningTitleStructures: true,
      winningTags: true,
      winningFormats: true,
      productOpportunities: true,
      avoidPatterns: true,
      topSellers: true,
      risingListings: true,
      priceDistribution: true,
      visualStyle: true,
      totalListings: true,
      createdAt: true,
    },
  });
}
