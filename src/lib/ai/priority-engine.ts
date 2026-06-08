import { generateJSON } from "./claude";
import { getTopPerformingPatterns } from "@/lib/analytics/performance-model";
import { prisma } from "@/lib/db/prisma";

export interface TodaysPriority {
  productConcept: string;
  format: string;
  suggestedPrice: number;
  targetAudience: string;
  primaryKeyword: string;
  reasoning: string;
  expectedRevenueRange: { min: number; max: number };
  confidenceLevel: "high" | "medium" | "low";
  basedOn: {
    performancePatterns: boolean;
    realEtsyData: boolean;
    seasonalOpportunity: boolean;
  };
}

const SYSTEM_PROMPT = `You are a strategic product advisor for a digital product seller on Etsy.

Your job: given data about what's working in this seller's catalog, seasonal opportunities, and market trends, recommend the single BEST product to build today. Be concrete and specific — not "an anxiety journal" but "The Night Shift Nurse's Anxiety Reset Journal."

Your recommendation must:
1. Match a proven format from the seller's catalog (if available)
2. Target an emotional niche with demonstrated buyer intent
3. Have a realistic price point based on format and competition
4. Be buildable in one session (journal, workbook, guide, game sheet)
5. Have a specific title concept ready to use

Return valid JSON matching the TodaysPriority interface.`;

const PRIORITY_TTL_MS = 4 * 60 * 60 * 1000;

// In-process TTL cache (resets on cold start — good enough for 4h window)
let _priorityCache: { ts: number; data: TodaysPriority } | null = null;

export async function generateTodaysPriority(): Promise<TodaysPriority> {
  if (_priorityCache && Date.now() - _priorityCache.ts < PRIORITY_TTL_MS) {
    return _priorityCache.data;
  }

  const patterns = await getTopPerformingPatterns().catch(() => []);

  const empireConfig = await prisma.empireConfig.findFirst();
  const seasonal = empireConfig?.lastSeasonalCalendar
    ? (() => {
        try {
          const cal = JSON.parse(empireConfig.lastSeasonalCalendar) as { publishNow?: Array<{ nicheName?: string; eventName?: string }> };
          return (cal.publishNow ?? []).slice(0, 3).map((e) => e.nicheName ?? e.eventName ?? "").filter(Boolean);
        } catch { return []; }
      })()
    : [];

  const hasPerformanceData = patterns.length > 0;

  const perfSection = hasPerformanceData
    ? `SELLER'S PROVEN WINNERS:
${patterns.slice(0, 5).map((p) => `- ${p.dimension.toUpperCase()}: "${p.value}" — $${p.avgRevenue.toFixed(0)} avg, ${p.productCount} products (${p.confidence} confidence)`).join("\n")}`
    : "No performance data yet — recommend a high-opportunity niche for a new seller.";

  const seasonalSection = seasonal.length > 0
    ? `SEASONAL OPPORTUNITIES RIGHT NOW:\n${seasonal.map((s) => `- ${s}`).join("\n")}`
    : "";

  const prompt = `Based on the following data, recommend the single best product to build today.

${perfSection}

${seasonalSection}

Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}

Return JSON with: productConcept (specific title idea), format (journal/planner/workbook/knowledge_guide/game_sheet), suggestedPrice (number), targetAudience (specific description), primaryKeyword (main Etsy search keyword), reasoning (2-3 sentences why this is the best play today), expectedRevenueRange ({ min: number, max: number } for first 30 days), confidenceLevel ("high"/"medium"/"low"), basedOn ({ performancePatterns: boolean, realEtsyData: boolean, seasonalOpportunity: boolean }).`;

  const priority = await generateJSON<TodaysPriority>(SYSTEM_PROMPT, prompt, 1500);
  _priorityCache = { ts: Date.now(), data: priority };
  return priority;
}
