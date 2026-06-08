import { generateJSON } from "@/lib/ai/claude";
import type { AgentContext, ValidatedNiche, ProductConcept } from "./agent-types";
import type { LogFn } from "./agent-logger";
import { estimateCost } from "./agent-logger";

const SYSTEM_PROMPT = `You are the Concept Generator Agent for a digital product publisher.
Generate highly specific, emotionally resonant product concepts. Vague concepts don't sell.
"Anxiety Journal for Divorced Women Re-entering the Workforce at 40" sells. "Anxiety Journal" does not.
Every concept must name a specific target person, specific emotional situation, and clear transformation.
Your titles should read like they belong on the front page of Etsy.
Return a JSON array of ProductConcept objects.`;

export async function runConceptGeneratorAgent(
  niches: ValidatedNiche[],
  ctx: AgentContext,
  log: LogFn
): Promise<ProductConcept[]> {
  const start = Date.now();

  const topFormat = ctx.performancePatterns.find((p) => p.dimension === "format")?.value ?? "knowledge_guide";
  const topPrice = ctx.performancePatterns.find((p) => p.dimension === "pricePoint")?.value ?? "$14.99";

  const batches: ValidatedNiche[][] = [];
  for (let i = 0; i < niches.length; i += 5) batches.push(niches.slice(i, i + 5));

  const allConcepts: ProductConcept[] = [];
  let totalTokens = 0;

  for (const batch of batches) {
    const prompt = `Generate one specific product concept for each of these ${batch.length} validated niches.

SELLER CONTEXT:
- Best-performing format: ${topFormat} (bias toward this unless data strongly suggests otherwise)
- Best price point: ${topPrice}
- Target audience style: ${ctx.catalogSnapshot.topEmotions.slice(0, 2).join(", ")} focus

NICHES:
${batch.map((n, i) => `${i + 1}. keyword="${n.keyword}", competitionLevel=${n.competitionLevel}, catalogFit=${n.catalogFit}, etsyAvgPrice=$${n.etsyAvgPrice}`).join("\n")}

Return JSON array of ${batch.length} objects:
{ keyword, title (specific, not generic), format, targetAudience (specific person), emotionalHook (core desire/pain), suggestedPrice (number), keyDifferentiator (what gaps this fills), etsySearchTerms (5 keyword phrases) }`;

    const concepts = await generateJSON<ProductConcept[]>(SYSTEM_PROMPT, prompt, 1500).catch(() => []);
    allConcepts.push(...(Array.isArray(concepts) ? concepts : []));
    totalTokens += 1500 + batch.length * 150;
  }

  const durationMs = Date.now() - start;
  await log("concept-generator", { nicheCount: niches.length, batchCount: batches.length }, allConcepts, {
    tokens: totalTokens, cost: estimateCost(totalTokens), durationMs,
  });

  return allConcepts.slice(0, 20);
}
