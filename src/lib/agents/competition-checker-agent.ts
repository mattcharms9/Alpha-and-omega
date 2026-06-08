import { generateJSON } from "@/lib/ai/claude";
import { fetchEtsySearchIntelligence } from "@/lib/ai/etsy-market-engine";
import type { ProductConcept, CompetitionCheck } from "./agent-types";
import type { LogFn } from "./agent-logger";
import { estimateCost } from "./agent-logger";

const SYSTEM_PROMPT = `You are the Competition Checker Agent for a digital product publisher.
Determine whether each concept has a genuine competitive gap on Etsy.
Gaps can be: price gap (underprice the market), audience gap (underserved segment),
format gap (different product type), or quality gap (weak existing listings).
No real gap = "too_saturated". Be honest. Return JSON array of CompetitionCheck objects.`;

interface ConceptWithData {
  concept: ProductConcept;
  realListingCount: number;
  realAvgPrice: number;
  realCompetition: string;
}

export async function runCompetitionCheckerAgent(
  concepts: ProductConcept[],
  log: LogFn
): Promise<CompetitionCheck[]> {
  const start = Date.now();

  // Fetch real Etsy data for each concept
  const conceptsWithData: ConceptWithData[] = await Promise.all(
    concepts.map(async (concept) => {
      const keywords = [concept.keyword, ...(concept.etsySearchTerms?.slice(0, 2) ?? [])];
      const intel = await fetchEtsySearchIntelligence(keywords).catch(() => null);
      return {
        concept,
        realListingCount: intel?.totalListingsEstimate ?? 0,
        realAvgPrice: intel?.avgPrice ?? 0,
        realCompetition: intel?.competitionLevel ?? "medium",
      };
    })
  );

  const prompt = `Check these ${conceptsWithData.length} product concepts for competitive gaps on Etsy.

${conceptsWithData.map((d, i) =>
  `${i + 1}. "${d.concept.title}" (${d.concept.format}, $${d.concept.suggestedPrice})
   Real Etsy data: ${d.realListingCount} listings, avg $${d.realAvgPrice.toFixed(2)}, ${d.realCompetition} competition`
).join("\n\n")}

For each concept, identify the competitive gap (or lack thereof). Return JSON array:
{ keyword, listingCount, avgPrice, topListingReviews: 0, gapExists: boolean, gapType: "price_gap"|"audience_gap"|"format_gap"|"quality_gap"|null, gapDescription: "1 sentence", verdict: "green_light"|"proceed_with_caution"|"too_saturated" }`;

  const checks = await generateJSON<CompetitionCheck[]>(SYSTEM_PROMPT, prompt, 3000).catch((): CompetitionCheck[] => {
    // Fallback: assume green light for all with medium competition
    return conceptsWithData.map((d) => ({
      keyword: d.concept.keyword,
      listingCount: d.realListingCount,
      avgPrice: d.realAvgPrice,
      topListingReviews: 0,
      gapExists: d.realCompetition !== "saturated",
      gapType: "audience_gap" as const,
      gapDescription: "Audience gap analysis unavailable — proceeding with caution",
      verdict: d.realCompetition === "saturated" ? "too_saturated" as const : "proceed_with_caution" as const,
    }));
  });

  const filtered = (Array.isArray(checks) ? checks : []).filter((c) => c.verdict !== "too_saturated");

  const durationMs = Date.now() - start;
  await log("competition-checker", { conceptCount: concepts.length }, filtered, {
    tokens: 4000, cost: estimateCost(4000), durationMs,
  });

  return filtered;
}
