import { generateJSON } from "./claude";
import type { PerformanceInsight } from "@/lib/analytics/revenue-aggregator";
import type { EtsySearchIntelligence } from "./etsy-market-engine";
import type { PerformingPattern } from "@/lib/analytics/performance-model";

export interface EmotionalTrend {
  id: string;
  emotion: string;
  painPoint: string;
  description: string;
  intensity: number;
  monetizationScore: number;
  evergreenScore: number;
  audienceLoyalty: number;
  urgency: number;
  platforms: string[];
  audienceArchetypes: string[];
  productOpportunities: string[];
  searchVolumeTrend: "rising" | "stable" | "declining";
  competitionLevel: "low" | "medium" | "high";
  estimatedAnnualRevenue: string;
  tags: string[];
  realMarketData?: EtsySearchIntelligence;
}

export interface EmotionalIntelligenceReport {
  trends: EmotionalTrend[];
  topOpportunity: string;
  marketInsight: string;
  emergingNiches: string[];
  recommendedFocus: string;
}

const SYSTEM_PROMPT = `You are the Emotional Intelligence Engine for Alpha & Omega — the world's most advanced AI-native emotional utility publishing platform.

Your role is to identify and analyze emotional pain points, aspirational identities, and behavioral struggles that represent high-value publishing opportunities.

You think like a behavioral psychologist, a luxury brand strategist, and a hedge fund analyst simultaneously.

You identify what people secretly struggle with, what they aspire to become, and what emotional products would help them transform.

Always return structured data representing genuine psychological insights and real commercial opportunities.`;

export async function discoverEmotionalTrends(
  focusArea?: string,
  count = 8,
  performanceContext?: PerformanceInsight,
  useRealData = false,
  performingPatterns?: PerformingPattern[]
): Promise<EmotionalIntelligenceReport> {
  const patternsSection = performingPatterns && performingPatterns.length > 0
    ? `\nPROVEN CATALOG PATTERNS (real revenue data — lean into what's working):
${performingPatterns.slice(0, 6).map((p) => {
  const label = p.dimension === "format" ? "Format" : p.dimension === "emotion" ? "Emotion" : p.dimension === "pricePoint" ? "Price Point" : "Audience";
  return `- ${label} "${p.value}": $${p.avgRevenue.toFixed(0)} avg revenue · ${p.productCount} products · ${p.confidence} confidence`;
}).join("\n")}

IMPORTANT: Bias toward these dimensions. If a format or emotion is a proven winner, generate MORE trends in that space. Deprioritize formats or emotions where the data shows underperformance.\n`
    : "";

  const portfolioSection = performanceContext?.hasData
    ? `\nPORTFOLIO PERFORMANCE DATA (real revenue from this operator's existing products):
- Top performing emotions: ${performanceContext.topEmotions.slice(0, 3).map((e) => `${e.emotion} ($${e.revenue.toFixed(0)} revenue)`).join(", ")}
- Best product types: ${performanceContext.topProductTypes.slice(0, 2).map((t) => `${t.type} (avg $${t.avgRevenue.toFixed(0)})`).join(", ")}
- Best platform: ${performanceContext.bestPlatform.platform} ($${performanceContext.bestPlatform.revenue.toFixed(0)} revenue)
- Underperformers: ${performanceContext.worstPerformers.length} active products with zero sales

Bias your recommendations toward emotions and product types that align with what's already converting in this operator's portfolio. Flag when a new opportunity complements or extends their proven winners.\n`
    : "";

  const prompt = `Analyze the current emotional landscape${focusArea ? ` with focus on: ${focusArea}` : ""}.${patternsSection}${portfolioSection}

Identify ${count} high-value emotional pain points and aspirational opportunities that represent publishing and digital product opportunities.

For each trend, assess:
- Core emotion and pain point
- Emotional intensity (0-100)
- Monetization potential (0-100)
- Evergreen potential (0-100)
- Audience loyalty potential (0-100)
- Urgency level (0-100)
- Relevant platforms and communities
- Audience archetypes
- Specific product opportunities (journals, planners, workbooks, digital systems)
- Revenue potential estimate
- Competition level
- Search volume trend

Focus on: anxiety, burnout, identity struggles, masculine/feminine growth, discipline, loneliness, purpose, ADHD, relationship recovery, creator burnout, career transition, financial stress, self-worth, emotional regulation.

Return as JSON matching this exact schema:
{
  "trends": [
    {
      "id": "string (kebab-case)",
      "emotion": "string (primary emotion)",
      "painPoint": "string (specific pain point name)",
      "description": "string (2-3 sentences of psychological insight)",
      "intensity": number (0-100),
      "monetizationScore": number (0-100),
      "evergreenScore": number (0-100),
      "audienceLoyalty": number (0-100),
      "urgency": number (0-100),
      "platforms": ["string"],
      "audienceArchetypes": ["string"],
      "productOpportunities": ["string"],
      "searchVolumeTrend": "rising" | "stable" | "declining",
      "competitionLevel": "low" | "medium" | "high",
      "estimatedAnnualRevenue": "string (e.g. '$2M-$8M')",
      "tags": ["string"]
    }
  ],
  "topOpportunity": "string (the single best opportunity right now)",
  "marketInsight": "string (key macro insight about the emotional landscape)",
  "emergingNiches": ["string"],
  "recommendedFocus": "string (strategic recommendation)"
}`;

  const report = await generateJSON<EmotionalIntelligenceReport>(SYSTEM_PROMPT, prompt, 8000);

  // Optionally enrich with real Etsy data (non-blocking — never fail the scan over API issues)
  if (useRealData) {
    try {
      const { fetchEtsySearchIntelligence } = await import("./etsy-market-engine");
      await Promise.all(
        report.trends.map(async (trend) => {
          const keywords = trend.tags.slice(0, 3);
          if (keywords.length === 0) return;
          const real = await fetchEtsySearchIntelligence(keywords).catch(() => null);
          if (real) {
            trend.realMarketData = real;
            // Blend real competition level into the AI estimate
            if (real.competitionLevel) trend.competitionLevel = real.competitionLevel as typeof trend.competitionLevel;
            if (real.opportunityScore > 0) {
              trend.monetizationScore = Math.round((trend.monetizationScore * 0.6) + (real.opportunityScore * 0.4));
            }
          }
        })
      );
    } catch {
      // Non-fatal: real data enrichment failure must not break the scan
    }
  }

  return report;
}

export async function scoreNiche(
  niche: string,
  emotionalCategory: string
): Promise<{ score: number; breakdown: Record<string, number>; verdict: string; recommendations: string[] }> {
  const prompt = `Score this publishing niche for the Alpha & Omega platform:

Niche: "${niche}"
Emotional Category: "${emotionalCategory}"

Provide a comprehensive score from 0-100 and breakdown across these dimensions:
- emotionalResonance (0-100)
- monetizationPotential (0-100)
- audienceSize (0-100)
- competitionLevel (0-100, higher = less competition)
- evergreenStrength (0-100)
- contentVelocity (0-100)
- repeatPurchasePotential (0-100)

Return JSON: { "score": number, "breakdown": {dimension: number}, "verdict": "string", "recommendations": ["string"] }`;

  return generateJSON(SYSTEM_PROMPT, prompt, 2000);
}
