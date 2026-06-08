import { generateJSON } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { buildAgentContext } from "./agent-context";
import { runMarketScoutAgent } from "./market-scout-agent";
import { runNicheValidatorAgent } from "./niche-validator-agent";
import { runConceptGeneratorAgent } from "./concept-generator-agent";
import { runCompetitionCheckerAgent } from "./competition-checker-agent";
import { runOpportunityScorerAgent } from "./opportunity-scorer-agent";
import { makeLogFn, estimateCost } from "./agent-logger";
import type { ScoredOpportunity, LaunchCardData, MarketOpportunity, ConfidenceLevel, CompetitionLevel, AgentContext } from "./agent-types";

const MANAGER_SYSTEM_PROMPT = `You are the Manager Agent for an autonomous digital product publishing system.

EDITORIAL REVIEW: Select the best 15 from the scored opportunities. Criteria:
- No two concepts should be too similar (pick the best from near-duplicates)
- At least 3 different product formats
- At least 2 time-sensitive/seasonal opportunities if they exist
- At least 1 "safe bet" (score >80, low competition, high confidence)
- At least 1 fresh niche

Return: { selected: number[] (0-based indices of chosen 15), managerNote: string (2 sentences) }`;

const COST_LIMIT = parseFloat(process.env.AGENT_DAILY_COST_LIMIT_USD ?? "2.00");

interface ManagerResult {
  queueId: string;
  cards: LaunchCardData[];
  managerNote: string;
  totalAgentCost: number;
  runDurationMs: number;
}

export async function runManagerAgent(date: string): Promise<ManagerResult> {
  const runStart = Date.now();
  let totalCost = 0;

  const queue = await prisma.dailyQueue.upsert({
    where: { date },
    create: { date, status: "pending" },
    update: { status: "pending", generatedAt: new Date() },
  });

  const log = makeLogFn(queue.id);
  const ctx = await buildAgentContext(queue.id, date);

  // Stage 1: Market Scout
  let opportunities: MarketOpportunity[];
  try {
    opportunities = await runMarketScoutAgent(ctx, log);
    totalCost += estimateCost(600);
  } catch {
    // Fallback: synthetic opportunities from performance patterns
    opportunities = ctx.performancePatterns.slice(0, 10).map((p, i) => ({
      keyword: `${p.value} ${ctx.catalogSnapshot.topFormats[0] ?? "journal"}`,
      category: p.dimension === "emotion" ? p.value : "general",
      etsyListingCount: 200 + i * 50,
      etsyAvgPrice: 12 + i,
      trendingScore: 60 - i * 2,
      competitionLevel: "medium" as const,
      topRelatedKeywords: [],
      priceGap: false,
      source: "performance_adjacency" as const,
    }));
  }

  if (totalCost > COST_LIMIT * 0.3) {
    opportunities = opportunities.slice(0, 15);
  }

  // Stage 2: Niche Validator
  const niches = await runNicheValidatorAgent(opportunities, ctx, log).catch(() => opportunities.map((o) => ({ ...o, catalogFit: 50, catalogConflict: false, conflictingProduct: null, validationNotes: "Fallback" })));
  totalCost += estimateCost(4000);

  if (totalCost > COST_LIMIT * 0.5) {
    await prisma.dailyQueue.update({ where: { id: queue.id }, data: { status: "failed", agentRunLog: { reason: "Cost cap reached at niche validator" } as Prisma.InputJsonValue } });
    throw new Error("Daily agent cost cap reached");
  }

  // Stage 3: Concept Generator
  const concepts = await runConceptGeneratorAgent(niches, ctx, log).catch(() => []);
  totalCost += estimateCost(8000);

  // Stage 4: Competition Checker
  const checks = await runCompetitionCheckerAgent(concepts, log).catch(() => []);
  totalCost += estimateCost(4000);

  // Stage 5: Opportunity Scorer
  const scored = await runOpportunityScorerAgent(concepts, checks, niches, ctx, log).catch(() => []);
  totalCost += estimateCost(5000);

  // Stage 6: Manager Editorial Review
  const { selected15, managerNote } = await runManagerEditorialReview(scored, ctx);
  totalCost += estimateCost(6000);

  // Write LaunchCards
  if (selected15.length > 0) {
    await prisma.$transaction(
      selected15.map((card, i) =>
        prisma.launchCard.create({
          data: {
            queueId: queue.id,
            position: i + 1,
            productTitle: card.productTitle,
            productFormat: card.productFormat,
            targetAudience: card.targetAudience,
            emotionalHook: card.emotionalHook,
            primaryKeyword: card.primaryKeyword,
            suggestedPrice: card.suggestedPrice,
            etsyListingCount: card.etsyListingCount,
            etsyAvgPrice: card.etsyAvgPrice,
            competitionLevel: card.competitionLevel,
            trendingScore: card.trendingScore,
            opportunityScore: card.opportunityScore,
            confidenceLevel: card.confidenceLevel,
            whyNow: card.whyNow,
            whyYou: card.whyYou,
            expectedRevenue: card.expectedRevenue,
            agentReasoning: card.agentReasoning as Prisma.InputJsonValue,
          },
        })
      )
    );
  }

  await prisma.dailyQueue.update({
    where: { id: queue.id },
    data: {
      status: selected15.length >= 10 ? "ready" : "partial",
      agentRunLog: { managerNote, isColdStart: ctx.isColdStart, totalCost, runDurationMs: Date.now() - runStart } as Prisma.InputJsonValue,
    },
  });

  // Update empire config with cost
  void prisma.empireConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastAgentRunAt: new Date(), lastAgentRunCost: totalCost, totalAgentRunCost: totalCost },
    update: { lastAgentRunAt: new Date(), lastAgentRunCost: totalCost, totalAgentRunCost: { increment: totalCost } },
  }).catch(() => {});

  return { queueId: queue.id, cards: selected15, managerNote, totalAgentCost: totalCost, runDurationMs: Date.now() - runStart };
}

async function runManagerEditorialReview(
  scored: ScoredOpportunity[],
  ctx: AgentContext
): Promise<{ selected15: LaunchCardData[]; managerNote: string }> {
  if (scored.length === 0) {
    return { selected15: [], managerNote: "No opportunities available today." };
  }

  const coldStartPrefix = ctx.coldStartNote ? `\n${ctx.coldStartNote}\n` : "";
  const prompt = `Review ${scored.length} scored opportunities for this digital product seller.${coldStartPrefix}
Select the best 15 ensuring: variety in formats, 2+ seasonal picks, 1 safe bet, 1 fresh niche.
Return: { selected: number[] (0-based indices, max 15), managerNote: "2 sentences" }

Opportunities:
${scored.map((s, i) => `${i}: "${s.concept.title}" | score=${s.opportunityScore} | conf=${s.confidenceLevel} | format=${s.concept.format} | competition=${s.competition.verdict}`).join("\n")}`;

  const result = await generateJSON<{ selected: number[]; managerNote: string }>(
    MANAGER_SYSTEM_PROMPT, prompt, 1000
  ).catch(() => ({ selected: scored.slice(0, 15).map((_, i) => i), managerNote: "Today's batch is ready for review." }));

  const indices = (result.selected ?? []).slice(0, 15).filter((i) => i >= 0 && i < scored.length);
  const selected = indices.length >= 10 ? indices : scored.slice(0, 15).map((_, i) => i);

  const cards: LaunchCardData[] = selected.map((idx, pos) => {
    const s = scored[idx]!;
    return {
      position: pos + 1,
      productTitle: s.concept.title,
      productFormat: s.concept.format,
      targetAudience: s.concept.targetAudience,
      emotionalHook: s.concept.emotionalHook,
      primaryKeyword: s.concept.keyword,
      suggestedPrice: s.concept.suggestedPrice,
      etsyListingCount: s.niche.etsyListingCount,
      etsyAvgPrice: s.niche.etsyAvgPrice,
      competitionLevel: s.niche.competitionLevel as CompetitionLevel,
      trendingScore: s.niche.trendingScore,
      opportunityScore: s.opportunityScore,
      confidenceLevel: s.confidenceLevel as ConfidenceLevel,
      whyNow: s.whyNow,
      whyYou: s.whyYou,
      expectedRevenue: s.expectedRevenue,
      agentReasoning: {
        scout: `Found keyword "${s.concept.keyword}" with ${s.niche.etsyListingCount} listings at avg $${s.niche.etsyAvgPrice.toFixed(2)}.`,
        validator: s.niche.validationNotes,
        generator: `Concept: "${s.concept.title}" targeting ${s.concept.targetAudience}.`,
        competition: s.competition.gapDescription,
        scorer: `Score: ${s.opportunityScore}/100 — ${s.breakdown.marketScore.toFixed(0)} market, ${s.breakdown.competitionScore.toFixed(0)} competition, ${s.breakdown.catalogFitScore.toFixed(0)} fit, ${s.breakdown.timingScore.toFixed(0)} timing.`,
        manager: `Selected at position #${pos + 1}. ${result.managerNote}`,
      },
    };
  });

  return { selected15: cards, managerNote: result.managerNote };
}
