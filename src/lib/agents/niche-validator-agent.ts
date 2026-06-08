import { generateJSON } from "@/lib/ai/claude";
import type { AgentContext, MarketOpportunity, ValidatedNiche } from "./agent-types";
import type { LogFn } from "./agent-logger";
import { estimateCost } from "./agent-logger";

const SYSTEM_PROMPT = `You are the Niche Validator Agent for a digital product publisher.
Score each market opportunity 0–100 for "catalog fit" — how well does it align with this seller's proven patterns?
Flag opportunities that conflict with existing products (very similar keyword + same format already exists).
Be brutally honest. Return a JSON array with validation scores for each opportunity.`;

interface ValidationResult {
  keyword: string;
  catalogFit: number;
  catalogConflict: boolean;
  conflictingProduct: string | null;
  validationNotes: string;
}

export async function runNicheValidatorAgent(
  opportunities: MarketOpportunity[],
  ctx: AgentContext,
  log: LogFn
): Promise<ValidatedNiche[]> {
  const start = Date.now();

  if (opportunities.length === 0) return [];

  const inputTokens = 3000;
  const prompt = `SELLER'S CATALOG PERFORMANCE (what's working):
${ctx.performancePatterns.slice(0, 8).map((p) => `- ${p.dimension}: "${p.value}" — $${p.avgRevenue.toFixed(0)} avg, ${p.productCount} products`).join("\n")}

EXISTING KEYWORDS (already have products for these):
${ctx.catalogSnapshot.existingKeywords.slice(0, 30).join(", ")}

RECENTLY PUBLISHED (last 14 days):
${ctx.catalogSnapshot.recentlyPublished.join(", ") || "none"}

OPPORTUNITIES TO VALIDATE (${opportunities.length} total):
${opportunities.map((o, i) => `${i}: keyword="${o.keyword}", competition=${o.competitionLevel}, avgPrice=$${o.etsyAvgPrice}`).join("\n")}

For each opportunity (by index), return:
{ keyword, catalogFit: 0-100, catalogConflict: boolean, conflictingProduct: string|null, validationNotes: "1-2 sentences" }

Return JSON array. Index order must match input.`;

  const validations = await generateJSON<ValidationResult[]>(SYSTEM_PROMPT, prompt, 2000).catch(() => []);

  const validationMap = new Map<string, ValidationResult>();
  for (const v of validations) {
    if (v?.keyword) validationMap.set(v.keyword, v);
  }

  const validated: ValidatedNiche[] = opportunities
    .map((opp) => {
      const v = validationMap.get(opp.keyword) ?? {
        keyword: opp.keyword, catalogFit: 50, catalogConflict: false,
        conflictingProduct: null, validationNotes: "No validation data",
      };
      return { ...opp, ...v };
    })
    .filter((n) => !n.catalogConflict)
    .sort((a, b) => (b.trendingScore * 0.4 + b.catalogFit * 0.6) - (a.trendingScore * 0.4 + a.catalogFit * 0.6))
    .slice(0, 20);

  const durationMs = Date.now() - start;
  await log("niche-validator", { opportunityCount: opportunities.length }, validated, {
    tokens: inputTokens + 1000, cost: estimateCost(inputTokens + 1000), durationMs,
  });

  return validated;
}
