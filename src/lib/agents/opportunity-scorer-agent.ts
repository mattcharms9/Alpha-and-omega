import { generateJSON } from "@/lib/ai/claude";
import type { AgentContext, ProductConcept, CompetitionCheck, ValidatedNiche, ScoredOpportunity, ConfidenceLevel } from "./agent-types";
import type { LogFn } from "./agent-logger";
import { estimateCost } from "./agent-logger";

const SYSTEM_PROMPT = `You are the Opportunity Scorer Agent — the final quality gate before a product concept reaches the seller.
You receive concepts with full market data, competition analysis, and catalog fit scores.
Produce a final composite score (0–100) and write compelling but honest "whyNow" and "whyYou" copy.
If confidence is low, say so. The seller trusts you — don't oversell weak opportunities.
Return a JSON array of ScoredOpportunity objects.`;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export async function runOpportunityScorerAgent(
  concepts: ProductConcept[],
  checks: CompetitionCheck[],
  niches: ValidatedNiche[],
  ctx: AgentContext,
  log: LogFn
): Promise<ScoredOpportunity[]> {
  const start = Date.now();

  // Case-insensitive maps to tolerate keyword normalization drift between pipeline stages
  const normalise = (s: string) => s.toLowerCase().replace(/[_-]/g, " ").trim();
  const checkMap = new Map(checks.map((c) => [normalise(c.keyword), c]));
  const nicheMap = new Map(niches.map((n) => [normalise(n.keyword), n]));

  // Compute preliminary scores
  const scored = concepts.map((concept) => {
    const key = normalise(concept.keyword);
    const check = checkMap.get(key);
    const niche = nicheMap.get(key);
    if (!check || !niche) return null;

    const marketScore = clamp(niche.trendingScore, 0, 100);
    const competitionScore = clamp(100 - (check.listingCount / 50), 0, 100);
    const catalogFitScore = clamp(niche.catalogFit, 0, 100);
    const seasonal = ctx.seasonalSignals.find((s) => concept.etsySearchTerms?.some((t) => t.includes(s.event.toLowerCase())));
    const timingScore = seasonal
      ? seasonal.daysUntilPeak < 14 ? 100
        : seasonal.daysUntilPeak < 30 ? 70
        : 30
      : 20;

    const preliminary = (marketScore * 0.3) + (competitionScore * 0.25) + (catalogFitScore * 0.3) + (timingScore * 0.15);
    return { concept, check, niche, preliminary, breakdown: { marketScore, competitionScore, catalogFitScore, timingScore } };
  }).filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.preliminary - a.preliminary)
    .slice(0, 18);

  if (scored.length === 0) return [];

  const prompt = `Review these ${scored.length} product opportunities. For each, assign final scores and write copy.

SELLER PERFORMANCE CONTEXT:
${ctx.performancePatterns.slice(0, 4).map((p) => `- ${p.dimension}: ${p.value} ($${p.avgRevenue.toFixed(0)} avg)`).join("\n")}

OPPORTUNITIES:
${scored.map((s, i) => `${i + 1}. "${s.concept.title}" | prelim=${s.preliminary.toFixed(0)} | market=${s.breakdown.marketScore.toFixed(0)}, competition=${s.breakdown.competitionScore.toFixed(0)}, fit=${s.breakdown.catalogFitScore.toFixed(0)}, timing=${s.breakdown.timingScore.toFixed(0)}`).join("\n")}

Return JSON array (same order):
{ opportunityScore: 0-100, confidenceLevel: "high"|"medium"|"low", whyNow: "2 sentences", whyYou: "2 sentences", expectedRevenue: "$X-$Y first 30 days" }`;

  type ScoringResult = { opportunityScore: number; confidenceLevel: ConfidenceLevel; whyNow: string; whyYou: string; expectedRevenue: string };
  const results = await generateJSON<ScoringResult[]>(SYSTEM_PROMPT, prompt, 4000).catch((): ScoringResult[] =>
    scored.map((s) => ({
      opportunityScore: Math.round(s.preliminary),
      confidenceLevel: s.preliminary > 70 ? "high" : s.preliminary > 50 ? "medium" : "low" as ConfidenceLevel,
      whyNow: "Strong market opportunity with manageable competition.",
      whyYou: "Aligns with your catalog's proven patterns.",
      expectedRevenue: "$80–$150 first 30 days",
    }))
  );

  const final: ScoredOpportunity[] = scored.map((s, i) => {
    const r = (Array.isArray(results) ? results[i] : null) ?? {
      opportunityScore: Math.round(s.preliminary), confidenceLevel: "medium" as ConfidenceLevel,
      whyNow: "Market opportunity identified.", whyYou: "Fits your catalog.", expectedRevenue: "$80–$150 first 30 days",
    };
    return {
      concept: s.concept,
      competition: s.check,
      niche: s.niche,
      opportunityScore: r.opportunityScore,
      confidenceLevel: r.confidenceLevel,
      whyNow: r.whyNow,
      whyYou: r.whyYou,
      expectedRevenue: r.expectedRevenue,
      breakdown: s.breakdown,
    };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);

  const durationMs = Date.now() - start;
  await log("opportunity-scorer", { conceptCount: concepts.length, scoredCount: scored.length }, final, {
    tokens: 5000, cost: estimateCost(5000), durationMs,
  });

  return final;
}
