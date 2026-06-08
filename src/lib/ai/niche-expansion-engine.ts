import { generateJSON } from "./claude";
import type { NicheExpansionReport, SubNiche } from "./niche-types";

const SYSTEM_PROMPT = `You are a world-class market research analyst specializing
in the self-improvement digital products market on Etsy and similar platforms.

Your expertise:
- Identifying specific emotional sub-niches with real buyer intent
- Understanding exactly what language buyers use when searching for solutions
- Knowing which product formats convert best for which audiences
- Spotting underserved gaps in existing Etsy product catalogs
- Predicting seasonal demand patterns for emotional content products

Your research philosophy:
- Specificity beats breadth. "Anxiety for new homeowners" beats "anxiety"
  because it maps to real Etsy search behavior and real buying intent.
- The best niches have: a specific life stage OR life event that creates the
  emotion, a clear before/after transformation, and an audience with disposable
  income and history of buying self-help products.
- Competition levels on Etsy: Low = under 500 results for the primary keyword,
  Medium = 500-2000 results, High = 2000+ results.
- Price sensitivity: audiences in crisis (divorce, job loss, health scare) pay
  more. Audiences in aspiration mode (new goal, new year) are more price sensitive.
- The best product titles on Etsy front-load the primary keyword, include the
  specific audience, and promise a specific transformation.

When scoring niches:
- opportunityScore = weighted average of: monetizationScore (40%) +
  (100 - competitionScore) (30%) + evergreenScore (20%) + trendingScore (10%)
- Score EVERYTHING on a 0-100 scale. Not 0-10. Not percentages. 0-100.
- currentSeasonalRelevance should reflect TODAY's month and buying season.

When generating audience language (languageTheyUse):
- These should be real phrases — things the person says to their partner,
  types into Google, or posts in Facebook groups at 2am.
- NOT marketing copy. Real human language.
- Example for new homeowner anxiety: "I can't stop thinking about what if
  something breaks", "Did we buy too much house?", "I feel like a fraud
  pretending I know what I'm doing"

When generating Etsy keywords:
- Think like a BUYER, not a marketer.
- Long-tail beats short. "anxiety journal for new homeowners" beats "anxiety journal"
- Include both the emotion AND the life situation AND the product type
- All 13 tags should be different angles, not variations of the same phrase

When identifying competitor gaps:
- Be specific. Not "there's no good workbook for this" but "there's no
  90-day structured program specifically for the financial anxiety that hits
  6 months after buying a first home, when the honeymoon period ends and
  the real costs appear"

Always return valid JSON matching the NicheExpansionReport interface exactly.
Generate exactly 15-20 sub-niches per expansion. Sort by opportunityScore descending.`;

export async function expandEmotion(
  emotion: string,
  existingNicheNames?: string[],
  currentMonth?: number
): Promise<NicheExpansionReport> {
  const month = currentMonth ?? new Date().getMonth() + 1;
  const monthName = new Date(2024, month - 1, 1).toLocaleString("en-US", { month: "long" });

  const existingContext = existingNicheNames?.length
    ? `\n\nAVOID these niches — already researched:\n${existingNicheNames.join("\n")}`
    : "";

  const prompt = `Expand the emotion "${emotion}" into 15-20 highly specific,
targetable sub-niches for Etsy digital product creation.

Current month: ${monthName} (month ${month})
Use this to calculate currentSeasonalRelevance accurately.
${existingContext}

Requirements:
- Each sub-niche must combine the emotion with a specific life stage, life event,
  identity, or situation that creates a unique buyer persona
- Avoid generic combinations. "Anxiety for busy moms" is too broad.
  "Anxiety for moms returning to work after maternity leave" is specific enough.
- Include at least 3 niches that are currently in peak season (currentSeasonalRelevance > 70)
- Include at least 3 niches with competitionLevel: "low"
- The quickWins array should contain the 3 niches with the best combination of
  low competition AND high opportunityScore
- allProductFormats for each niche should include ALL 5 formats
  (journal, planner, workbook, mini_guide, bundle) with format-specific titles
  and prices drawn from PRICING_TIERS:
    journal: $14, planner: $16, workbook: $19, mini_guide: $7, bundle: $29
- competitorGaps should be SPECIFIC product ideas that don't currently exist
  on Etsy — not general observations
- languageTheyUse must be authentic human phrases, not marketing copy
- All 13 etsyIntel.tagSuggestions must be unique angles

Return the complete NicheExpansionReport JSON with this exact structure:
{
  "parentEmotion": string,
  "totalNichesFound": number,
  "subNiches": SubNiche[],
  "topPick": SubNiche,
  "quickWins": SubNiche[],
  "seasonalPicks": SubNiche[],
  "expansionMap": string[],
  "researchSummary": string
}

Each SubNiche must include all fields: id, parentEmotion, nicheName, nicheSlug,
oneLiner, opportunityScore, marketSize, competitionLevel, evergreenScore,
trendingScore, monetizationScore, peakMonths, currentSeasonalRelevance,
urgency, audience (all fields), topProductRecommendation (all fields),
allProductFormats (all 5 formats), etsyIntel (all fields including 13 tagSuggestions),
contentAngles (all 5 fields), relatedNiches, competitorGaps, whyNowRationale.`;

  return generateJSON<NicheExpansionReport>(SYSTEM_PROMPT, prompt, 12000, "niche-expansion");
}

export async function drillDeeper(
  parentNiche: SubNiche,
  currentMonth?: number
): Promise<NicheExpansionReport> {
  const month = currentMonth ?? new Date().getMonth() + 1;
  const monthName = new Date(2024, month - 1, 1).toLocaleString("en-US", { month: "long" });

  const prompt = `Drill deeper into this specific niche and find 15-20 even
more targeted sub-niches within it.

Parent niche: "${parentNiche.nicheName}"
Parent emotion: "${parentNiche.parentEmotion}"
Current month: ${monthName} (month ${month})

This is a second-level expansion. The sub-niches you return should be MORE
specific than "${parentNiche.nicheName}" — not just variations of it.

Example of correct drilling:
- Parent: "Anxiety for new homeowners"
- Correct sub-niches: "Anxiety about HOA fees for first-time condo owners",
  "Financial anxiety 6 months after closing when real costs appear",
  "Anxiety about making the wrong renovation decisions"
- Incorrect: "New homeowner stress", "First home anxiety" (too similar to parent)

Use the parent niche's audience archetype as the baseline buyer.
All sub-niches should still be reachable by that core audience.

Return the complete NicheExpansionReport JSON with parentEmotion set to
"${parentNiche.nicheName}" to indicate this is a second-level expansion.
Use the same full JSON structure with all SubNiche fields populated.`;

  return generateJSON<NicheExpansionReport>(SYSTEM_PROMPT, prompt, 12000, "niche-expansion");
}

export async function compareNiches(niches: SubNiche[]): Promise<{
  winner: SubNiche;
  ranking: Array<{ niche: SubNiche; rationale: string }>;
  recommendation: string;
}> {
  const prompt = `Compare these ${niches.length} niches and rank them by
overall opportunity for an Etsy digital products seller.

Niches to compare:
${niches.map((n, i) => `${i + 1}. ${n.nicheName} (Score: ${n.opportunityScore})`).join("\n")}

Consider: competition level, monetization potential, seasonal timing,
audience specificity, and product-market fit.

Return JSON with:
{
  "winner": [the top SubNiche object],
  "ranking": [array of {niche: SubNiche, rationale: string} sorted best to worst],
  "recommendation": "2-3 sentence executive recommendation"
}`;

  return generateJSON<{
    winner: SubNiche;
    ranking: Array<{ niche: SubNiche; rationale: string }>;
    recommendation: string;
  }>(SYSTEM_PROMPT, prompt, 4000, "niche-expansion");
}
