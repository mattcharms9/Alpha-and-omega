import { generateJSON } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type {
  TopSellerListing,
  RisingListing,
  PricePoint,
  ProductOpportunity,
  VisualIntelligence,
  WinningPriceRange,
} from "./types";

const SYSTEM_PROMPT = `You are an expert Etsy market analyst with deep knowledge of digital product selling.
You analyze real listing data to identify what's proven to work and where opportunities exist.
You NEVER guess — you only draw conclusions directly supported by the data provided.
When data is limited, say so explicitly (set confidenceScore low) rather than speculating.
Extract structural patterns from titles — not the exact titles themselves.`;

interface AnalysisOutput {
  winningTitleStructures: string[];
  winningTags: string[];
  winningPriceRange: WinningPriceRange;
  winningFormats: string[];
  productOpportunities: ProductOpportunity[];
  avoidPatterns: string[];
  competitionLevel: "low" | "medium" | "high" | "saturated";
  opportunityScore: number;
}

export async function analyzeNicheMarket(
  niche: string,
  topSellers: TopSellerListing[],
  risingListings: RisingListing[],
  priceDistribution: PricePoint[],
  totalListings: number
): Promise<AnalysisOutput> {
  const topSellerSummary = topSellers.slice(0, 15).map((s) => ({
    title: s.title,
    price: s.price,
    reviews: s.reviewCount,
    favorites: s.favoritesCount,
    tags: s.tags.slice(0, 8),
    daysListed: s.daysListed,
    reviewVelocity: s.reviewVelocity,
  }));

  const risingSum = risingListings.slice(0, 8).map((r) => ({
    title: r.title,
    price: r.price,
    favorites: r.favoritesCount,
    daysListed: r.daysListed,
    momentum: r.momentumScore,
  }));

  const prompt = `Analyze this Etsy niche: "${niche}"

MARKET DATA:
Total listings in niche: ${totalListings}
Top sellers (by review count):
${JSON.stringify(topSellerSummary, null, 2)}

Rising listings (high momentum, recent):
${JSON.stringify(risingSum, null, 2)}

Price distribution across top 25 listings:
${priceDistribution.map((p) => `$${p.price}: ${p.count} listings (${p.percentOfTop50}%)`).join(", ")}

Extract:
1. winningTitleStructures: the STRUCTURAL PATTERNS (not exact titles). E.g. "[Emotion] [Format] for [Audience] | [Benefit]". Find 3-5 patterns.
2. winningTags: tags appearing in 3+ top sellers. Include all of them.
3. winningPriceRange: { min, max, sweet } where sweet = most common price in top 10
4. winningFormats: product types/formats appearing in top sellers (journal, workbook, guide, checklist, etc.)
5. productOpportunities: 3-5 specific gaps. For each: opportunityType, title (a suggested product title), reasoning, suggestedPrice, suggestedTags, titleFormula, estimatedCompetition, confidenceScore
6. avoidPatterns: what's oversaturated or clearly not working
7. competitionLevel: "low" (<500 listings) | "medium" (500-2000) | "high" (2000-10000) | "saturated" (>10000)
8. opportunityScore: 0-100. Consider: competition level, rising trend signals, price gaps, underserved audiences

Return valid JSON matching the AnalysisOutput interface exactly.`;

  return generateJSON<AnalysisOutput>(SYSTEM_PROMPT, prompt, 3000).catch(
    (): AnalysisOutput => ({
      winningTitleStructures: [],
      winningTags: topSellers.flatMap((s) => s.tags).slice(0, 10),
      winningPriceRange: {
        min: priceDistribution[0]?.price ?? 8,
        max: priceDistribution[priceDistribution.length - 1]?.price ?? 20,
        sweet: priceDistribution.sort((a, b) => b.count - a.count)[0]?.price ?? 12,
      },
      winningFormats: [],
      productOpportunities: [],
      avoidPatterns: [],
      competitionLevel: totalListings > 10000 ? "saturated" : totalListings > 2000 ? "high" : totalListings > 500 ? "medium" : "low",
      opportunityScore: 30,
    })
  );
}

export async function saveMarketReport(
  niche: string,
  reportDate: string,
  topSellers: TopSellerListing[],
  risingListings: RisingListing[],
  priceDistribution: PricePoint[],
  totalListings: number,
  analysis: AnalysisOutput,
  visualStyle: VisualIntelligence
) {
  const toJson = <T>(v: T): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;

  return prisma.marketIntelligenceReport.upsert({
    where: { niche_reportDate: { niche, reportDate } },
    create: {
      niche,
      reportDate,
      totalListings,
      topSellers: toJson(topSellers),
      risingListings: toJson(risingListings),
      priceDistribution: toJson(priceDistribution),
      winningTitleStructures: toJson(analysis.winningTitleStructures),
      winningTags: toJson(analysis.winningTags),
      winningPriceRange: toJson(analysis.winningPriceRange),
      winningFormats: toJson(analysis.winningFormats),
      visualStyle: toJson(visualStyle),
      productOpportunities: toJson(analysis.productOpportunities),
      avoidPatterns: toJson(analysis.avoidPatterns),
      competitionLevel: analysis.competitionLevel,
      opportunityScore: analysis.opportunityScore,
    },
    update: {
      totalListings,
      topSellers: toJson(topSellers),
      risingListings: toJson(risingListings),
      priceDistribution: toJson(priceDistribution),
      winningTitleStructures: toJson(analysis.winningTitleStructures),
      winningTags: toJson(analysis.winningTags),
      winningPriceRange: toJson(analysis.winningPriceRange),
      winningFormats: toJson(analysis.winningFormats),
      visualStyle: toJson(visualStyle),
      productOpportunities: toJson(analysis.productOpportunities),
      avoidPatterns: toJson(analysis.avoidPatterns),
      competitionLevel: analysis.competitionLevel,
      opportunityScore: analysis.opportunityScore,
    },
  });
}

export async function getLatestReportForNiche(niche: string, maxAgeDays = 1) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return prisma.marketIntelligenceReport.findFirst({
    where: { niche, reportDate: { gte: cutoffStr } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTopOpportunitiesByScore(limit = 5) {
  return prisma.marketIntelligenceReport.findMany({
    orderBy: { opportunityScore: "desc" },
    take: limit,
    select: {
      niche: true,
      opportunityScore: true,
      competitionLevel: true,
      reportDate: true,
      winningPriceRange: true,
    },
  });
}
