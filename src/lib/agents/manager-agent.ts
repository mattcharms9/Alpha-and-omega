import { generateWithClaude } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { makeLogFn } from "./agent-logger";
import { getLearningContext } from "@/lib/learning/daily-ledger";
import type { LaunchCardData, CompetitionLevel, ConfidenceLevel } from "./agent-types";

interface ManagerResult {
  queueId: string;
  cards: LaunchCardData[];
  managerNote: string;
  totalAgentCost: number;
  runDurationMs: number;
}

// Shape Claude is asked to return (validated before casting)
interface RawCard {
  productTitle?: string;
  productFormat?: string;
  targetAudience?: string;
  emotionalHook?: string;
  primaryKeyword?: string;
  suggestedPrice?: number;
  etsyListingCount?: number;
  etsyAvgPrice?: number;
  competitionLevel?: string;
  trendingScore?: number;
  opportunityScore?: number;
  whyNow?: string;
  whyYou?: string;
  expectedRevenue?: string;
  confidenceLevel?: string;
}

const VALID_FORMATS = ["journal", "planner", "workbook", "knowledge_guide", "checklist", "game_sheet", "bingo_card", "bundle", "template_pack"];
const VALID_COMPETITION = ["low", "medium", "high", "saturated"];
const VALID_CONFIDENCE = ["high", "medium", "low"];

function coerceCard(c: RawCard, i: number, fromLiveData: boolean): LaunchCardData {
  const opp = typeof c.opportunityScore === "number" ? Math.min(100, Math.max(0, c.opportunityScore)) : 70;
  const comp = (VALID_COMPETITION.includes(c.competitionLevel ?? "") ? c.competitionLevel : "medium") as CompetitionLevel;
  const conf = (VALID_CONFIDENCE.includes(c.confidenceLevel ?? "") ? c.confidenceLevel : "medium") as ConfidenceLevel;
  return {
    position: i + 1,
    productTitle: c.productTitle ?? `Product ${i + 1}`,
    productFormat: VALID_FORMATS.includes(c.productFormat ?? "") ? (c.productFormat as string) : "knowledge_guide",
    targetAudience: c.targetAudience ?? "general audience",
    emotionalHook: c.emotionalHook ?? "",
    primaryKeyword: c.primaryKeyword ?? "",
    suggestedPrice: typeof c.suggestedPrice === "number" ? c.suggestedPrice : 12,
    etsyListingCount: typeof c.etsyListingCount === "number" ? c.etsyListingCount : 0,
    etsyAvgPrice: typeof c.etsyAvgPrice === "number" ? c.etsyAvgPrice : 12,
    competitionLevel: comp,
    trendingScore: typeof c.trendingScore === "number" ? c.trendingScore : opp,
    opportunityScore: opp,
    confidenceLevel: conf,
    whyNow: c.whyNow ?? "",
    whyYou: c.whyYou ?? "",
    expectedRevenue: c.expectedRevenue ?? "$100–$300/month",
    dataSource: fromLiveData ? "live_etsy_data" : "ai_estimate",
    marketEvidence: fromLiveData
      ? `Real Etsy data: ${c.etsyListingCount ?? 0} listings, avg $${c.etsyAvgPrice ?? "?"}, score ${opp}/100.`
      : undefined,
    agentReasoning: {
      scout: fromLiveData
        ? `Live DB: niche "${c.primaryKeyword}" — ${c.etsyListingCount ?? 0} listings at avg $${c.etsyAvgPrice ?? "?"}.`
        : `AI estimate for "${c.primaryKeyword}" — no recent Etsy scan data.`,
      validator: `${comp} competition; score ${opp}/100.`,
      generator: `Concept: "${c.productTitle ?? ""}" targeting ${c.targetAudience ?? "general audience"}.`,
      competition: `${comp} competition level. ${opp >= 75 ? "Strong opportunity." : "Proceed carefully."}`,
      scorer: `Score ${opp}/100 from ${fromLiveData ? "live Etsy market data" : "AI knowledge"}.`,
      manager: `Selected at position #${i + 1}.`,
    },
  };
}

async function callClaudeForCards(systemPrompt: string, userPrompt: string): Promise<RawCard[]> {
  const raw = await generateWithClaude(systemPrompt, userPrompt, 8192, "manager-agent");
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(stripped) as unknown;
    if (Array.isArray(parsed)) return parsed as RawCard[];
    // Sometimes Claude wraps in { "cards": [...] }
    const asObj = parsed as Record<string, unknown>;
    if (asObj.cards && Array.isArray(asObj.cards)) return asObj.cards as RawCard[];
    return [];
  } catch (err) {
    console.error("[manager-agent] JSON parse failed. Raw response:\n", raw);
    console.error("[manager-agent] Parse error:", err instanceof Error ? err.message : err);
    return [];
  }
}

const CARD_SCHEMA = `Each card object needs ALL these fields:
- productTitle: string (compelling Etsy listing title, under 140 chars)
- productFormat: string (one of: journal, planner, workbook, knowledge_guide, checklist, game_sheet, bingo_card, bundle, template_pack)
- targetAudience: string (specific audience, e.g. "new moms dealing with postpartum anxiety")
- emotionalHook: string (the core emotional pain or desire being addressed)
- primaryKeyword: string (the exact niche keyword)
- suggestedPrice: number (USD, e.g. 12.99)
- etsyListingCount: number (total competing listings)
- etsyAvgPrice: number (average price on Etsy)
- competitionLevel: string (low | medium | high | saturated)
- trendingScore: number (0-100)
- opportunityScore: number (0-100)
- whyNow: string (1 sentence — timing or seasonal reason to launch now)
- whyYou: string (1 sentence — why a solo creator can win this niche)
- expectedRevenue: string (e.g. "$180–$420/month at 3–7 sales/day")
- confidenceLevel: string (high | medium | low)`;

const DIVERSITY_REQUIREMENT = `DIVERSITY REQUIREMENT across the 15 cards:
- Maximum 3 cards per product format type
- Include at least 2 bundles, 2 game_sheet or bingo_card, 2 knowledge_guide or checklist
- At least 1 seasonal or time-sensitive opportunity
- At least 1 safe bet (opportunityScore > 80, competitionLevel low or medium)`;

export async function runManagerAgent(date: string): Promise<ManagerResult> {
  const runStart = Date.now();

  const queue = await prisma.dailyQueue.upsert({
    where: { date },
    create: { date, status: "pending" },
    update: { status: "pending", generatedAt: new Date() },
  });

  makeLogFn(queue.id); // side-effect: initialises log context

  // 48-hour lookback using DateTime field — never string date comparison
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const reports = await prisma.marketIntelligenceReport.findMany({
    where: { createdAt: { gte: cutoff } },
    orderBy: { opportunityScore: "desc" },
    take: 25,
  });

  console.log(`[manager-agent] Found ${reports.length} MarketIntelligenceReport rows in last 48h`);

  const isColdStart = reports.length === 0;
  const learningContext = await getLearningContext().catch(() => "No learning data available.");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const saleValidations = await prisma.learningEntry.findMany({
    where: { lessonType: "sale_validated", createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 5,
  }).catch(() => [] as Array<{ content: string }>);
  const salesContext = saleValidations.length > 0
    ? "VALIDATED SALES (last 30 days):\n" + saleValidations.map((e) => `- ${e.content}`).join("\n")
    : "";

  let totalCost = 0;
  let cards: LaunchCardData[] = [];
  let managerNote = "Today's batch is ready for review.";

  // ── Path A: Real market data available ──────────────────────────────────────
  if (!isColdStart) {
    const marketDataContext = reports.map((r) => {
      const pr = r.winningPriceRange as { min?: number; max?: number; sweet?: number } | null;
      const titles = (r.winningTitleStructures as string[])?.slice(0, 3) ?? [];
      const opps = (r.productOpportunities as Array<{ title?: string; description?: string }>)?.slice(0, 3) ?? [];
      const avoid = (r.avoidPatterns as string[])?.slice(0, 2) ?? [];
      return [
        `NICHE: ${r.niche}`,
        `  opportunityScore: ${r.opportunityScore}/100`,
        `  competitionLevel: ${r.competitionLevel}`,
        `  totalListings: ${r.totalListings}`,
        `  sweetSpotPrice: $${pr?.sweet ?? "?"}`,
        `  winningPriceRange: $${pr?.min ?? "?"} – $${pr?.max ?? "?"}`,
        titles.length ? `  winningTitleStructures: ${titles.join(" | ")}` : null,
        opps.length ? `  productOpportunities: ${opps.map((o) => o.title ?? o.description ?? "").filter(Boolean).join(" | ")}` : null,
        avoid.length ? `  avoidPatterns: ${avoid.join(" | ")}` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    const systemPrompt = `You are the Manager Agent for an autonomous Etsy digital product publishing system. You have real live Etsy market intelligence data below. Generate exactly 15 high-opportunity LaunchCard products based ONLY on the provided niches.

${DIVERSITY_REQUIREMENT}

${CARD_SCHEMA}

Return ONLY a JSON array. Start with [ and end with ]. No markdown fences. No text before or after the array.`;

    const userPrompt = `REAL ETSY MARKET DATA (${reports.length} niches scanned in last 48h):
${marketDataContext}

SELLER LEARNING CONTEXT:
${learningContext}
${salesContext ? `\n${salesContext}` : ""}

Generate exactly 15 LaunchCard objects. Each card must use a real niche from the market data above for primaryKeyword. Use the actual etsyListingCount, etsyAvgPrice, and competitionLevel from the data.`;

    try {
      const rawCards = await callClaudeForCards(systemPrompt, userPrompt);
      if (rawCards.length > 0) {
        cards = rawCards.slice(0, 15).map((c, i) => coerceCard(c, i, true));
        managerNote = `Generated ${cards.length} opportunities from ${reports.length} live Etsy market reports. Top niche: ${reports[0]?.niche ?? "N/A"} (score ${reports[0]?.opportunityScore ?? 0}/100).`;
        totalCost += 0.08;
        console.log(`[manager-agent] Generated ${cards.length} cards from live market data`);
      } else {
        console.warn("[manager-agent] Claude returned empty array from live data — falling back to cold start");
      }
    } catch (err) {
      console.error("[manager-agent] Live-data Claude call failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── Path B: Cold start (no market data, or live-data path failed) ──────────
  if (cards.length === 0) {
    console.log(`[manager-agent] Cold start — generating from AI knowledge (isColdStart=${isColdStart})`);

    const systemPrompt = `You are the Manager Agent for an autonomous Etsy digital product publishing system. No live market scan data is available. Generate exactly 15 high-opportunity digital product ideas for Etsy based on proven evergreen niches.

${DIVERSITY_REQUIREMENT}

${CARD_SCHEMA}

Return ONLY a JSON array. Start with [ and end with ]. No markdown fences. No text before or after the array.`;

    const userPrompt = `Generate 15 high-opportunity Etsy digital product LaunchCards using your knowledge of proven Etsy niches for journals, workbooks, planners, game sheets, and knowledge guides.

Focus on: emotional wellness, self-improvement, seasonal events, party games, and productivity niches. Use realistic Etsy market data estimates.

SELLER CONTEXT:
${learningContext}
${salesContext ? `\n${salesContext}` : ""}`;

    try {
      const rawCards = await callClaudeForCards(systemPrompt, userPrompt);
      cards = rawCards.slice(0, 15).map((c, i) => coerceCard(c, i, false));
      totalCost += 0.04;
      console.log(`[manager-agent] Cold start generated ${cards.length} cards`);
    } catch (err) {
      console.error("[manager-agent] Cold start Claude call failed:", err instanceof Error ? err.message : err);
    }

    if (isColdStart) {
      managerNote = "No recent market data available — using AI knowledge for initial queue. Run market intelligence scan to get real Etsy data.";
    } else {
      managerNote = "Live market data found but card generation failed — using AI knowledge fallback. Check Vercel logs.";
    }
  }

  // ── Save LaunchCards ────────────────────────────────────────────────────────
  if (cards.length > 0) {
    await prisma.$transaction(
      cards.map((card) =>
        prisma.launchCard.create({
          data: {
            queueId: queue.id,
            position: card.position,
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
            dataSource: card.dataSource,
            marketEvidence: card.marketEvidence,
          },
        })
      )
    );
  }

  const runDurationMs = Date.now() - runStart;

  await prisma.dailyQueue.update({
    where: { id: queue.id },
    data: {
      status: cards.length >= 10 ? "ready" : cards.length > 0 ? "partial" : "failed",
      agentRunLog: {
        managerNote,
        isColdStart,
        totalCost,
        runDurationMs,
        reportCount: reports.length,
        cardsGenerated: cards.length,
      } as Prisma.InputJsonValue,
    },
  });

  void prisma.empireConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastAgentRunAt: new Date(), lastAgentRunCost: totalCost, totalAgentRunCost: totalCost },
    update: { lastAgentRunAt: new Date(), lastAgentRunCost: totalCost, totalAgentRunCost: { increment: totalCost } },
  }).catch(() => {});

  return { queueId: queue.id, cards, managerNote, totalAgentCost: totalCost, runDurationMs };
}
