import { generateJSON } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { searchTopListings, searchRisingListings, getPriceDistribution, getListingCount } from "./etsy-client";
import { analyzeNicheMarket, saveMarketReport } from "./analyzer";
import { analyzeVisualStyle } from "./visual-analyzer";
import { TRACKED_NICHES } from "./types";

const SUMMARY_PROMPT = `You are a market intelligence analyst. Summarize today's Etsy market findings in 2-3 sentences. Focus on actionable insights: which niches are hottest, any price shifts, and the single best opportunity right now.`;

const toJson = <T>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runNicheScan(niche: string, reportDate: string) {
  const [topSellers, risingListings, priceDistribution, totalListings] = await Promise.all([
    searchTopListings(niche, 20).catch(() => []),
    searchRisingListings(niche, 12).catch(() => []),
    getPriceDistribution(niche).catch(() => []),
    getListingCount(niche).catch(() => 0),
  ]);

  const analysis = await analyzeNicheMarket(niche, topSellers, risingListings, priceDistribution, totalListings);

  const imageUrls = topSellers.slice(0, 5).map((s) => s.imageUrl).filter(Boolean);
  const visualStyle = await analyzeVisualStyle(niche, imageUrls);

  const report = await saveMarketReport(niche, reportDate, topSellers, risingListings, priceDistribution, totalListings, analysis, visualStyle);

  return { report, totalListings };
}

export async function runFullScan(): Promise<{
  nichesAnalyzed: number;
  totalListingsPulled: number;
  topOpportunities: Array<{ niche: string; opportunityScore: number; competitionLevel: string }>;
  marketSummary: string;
}> {
  const reportDate = new Date().toISOString().slice(0, 10);
  let totalListingsPulled = 0;
  const results: Array<{ niche: string; opportunityScore: number; competitionLevel: string }> = [];

  for (const niche of TRACKED_NICHES) {
    try {
      const { report, totalListings } = await runNicheScan(niche, reportDate);
      totalListingsPulled += totalListings;
      results.push({
        niche,
        opportunityScore: report.opportunityScore,
        competitionLevel: report.competitionLevel,
      });
      console.log(`[market-intelligence] ✓ ${niche} — score: ${report.opportunityScore}, competition: ${report.competitionLevel}`);
    } catch (err) {
      console.error(`[market-intelligence] ✗ ${niche}:`, err instanceof Error ? err.message : err);
    }
    await delay(100);
  }

  const sorted = [...results].sort((a, b) => b.opportunityScore - a.opportunityScore);
  const top5 = sorted.slice(0, 5);

  const marketSummary = await generateJSON<{ summary: string }>(
    SUMMARY_PROMPT,
    `Today's market data:
Top opportunities: ${top5.map((t) => `${t.niche} (score: ${t.opportunityScore}, ${t.competitionLevel} competition)`).join("; ")}
Total niches analyzed: ${results.length}
Total listings pulled: ${totalListingsPulled}

Write a 2-3 sentence market summary as JSON: { "summary": "..." }`,
    300
  )
    .then((r) => r.summary)
    .catch(() => `Analyzed ${results.length} niches today. Top opportunity: ${top5[0]?.niche ?? "N/A"}.`);

  await prisma.etsyMarketSnapshot.create({
    data: {
      snapshotDate: reportDate,
      nichesAnalyzed: results.length,
      totalListingsPulled,
      topOpportunities: toJson(top5),
      marketSummary,
    },
  });

  return {
    nichesAnalyzed: results.length,
    totalListingsPulled,
    topOpportunities: top5,
    marketSummary,
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
