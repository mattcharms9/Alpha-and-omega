import { generateJSON } from "./claude";
import type { ProductFormat, BatchSlot, BatchPlan, NextBatchSuggestion } from "./mix-types";
import { PRICING_TIERS, DEFAULT_BATCH_MIX } from "./mix-types";

export type { ProductFormat, BatchSlot, BatchPlan, NextBatchSuggestion };
export { PRICING_TIERS, DEFAULT_BATCH_MIX };

interface AIBatchSlot {
  format: ProductFormat;
  audienceFocus: string;
  transformationAngle: string;
  urgencyLevel: "evergreen" | "seasonal" | "trending";
  positioningNote: string;
}

interface AIBatchPlan {
  collectionName: string;
  bundleStrategy: string;
  etsyCollectionNote: string;
  slots: AIBatchSlot[];
}

const SYSTEM_PROMPT = `You are the Product Mix Strategist for Alpha & Omega — designing emotionally coherent product collections for the self-improvement market.

Strategy rules:
- Each slot must target a DIFFERENT sub-audience or angle within the same emotional theme. If theme is "anxiety for moms", slot 1 = bedtime anxiety, slot 2 = future planning anxiety, slot 3 = perfectionism. Never two slots with the same angle.
- Products must cross-sell naturally. Mini guide buyer should immediately want the journal. Journal buyer should want the planner. Planner buyer should want the workbook.
- The bundle slot explicitly combines the other products — Etsy cross-sells bundle → individual products automatically.
- Positioning notes prevent cannibalization. Two products must not target the exact same buyer with the exact same solution.
- Most products should be evergreen. Only use seasonal/trending if there is a compelling current reason.`;

export async function generateBatchPlan(
  emotionalTheme: string,
  targetAudience: string,
  batchSize = 5,
  customMix?: ProductFormat[]
): Promise<BatchPlan> {
  const mix = customMix ?? DEFAULT_BATCH_MIX.slice(0, batchSize);

  const prompt = `Create a ${batchSize}-product collection plan for this emotional niche.

Emotional Theme: "${emotionalTheme}"
Target Audience: "${targetAudience}"
Product formats (in order): ${mix.join(", ")}

For each slot, provide a unique audience focus, transformation angle, urgency level, and positioning note that differentiates it from all other slots.

Return JSON:
{
  "collectionName": "string (the overarching shop collection name)",
  "bundleStrategy": "string (how the bundle combines the individual products)",
  "etsyCollectionNote": "string (how Etsy will cross-sell these naturally)",
  "slots": [
    {
      "format": "${mix[0]}",
      "audienceFocus": "string (specific sub-audience)",
      "transformationAngle": "string (unique angle — not shared with any other slot)",
      "urgencyLevel": "evergreen|seasonal|trending",
      "positioningNote": "string (how to differentiate from other slots)"
    }
  ]
}`;

  const ai = await generateJSON<AIBatchPlan>(SYSTEM_PROMPT, prompt, 2000, "mix-engine");

  const slots: BatchSlot[] = ai.slots.map((s, i) => ({
    format: mix[i] ?? s.format,
    pricing: PRICING_TIERS[mix[i] ?? s.format],
    audienceFocus: s.audienceFocus,
    transformationAngle: s.transformationAngle,
    urgencyLevel: s.urgencyLevel,
    positioningNote: s.positioningNote,
  }));

  const totalBatchRevenuePotential = slots.reduce((sum, s) => sum + s.pricing.recommendedPrice, 0);

  return { emotionalTheme, batchSize, slots, bundleStrategy: ai.bundleStrategy, totalBatchRevenuePotential, collectionName: ai.collectionName, etsyCollectionNote: ai.etsyCollectionNote };
}

interface TopPerformer {
  title: string;
  targetEmotion: string;
  totalSales: number;
  totalRevenue: number;
}

const SUGGEST_PROMPT = `You are advising what emotional niche to target next for maximum commercial impact. Suggest themes that complement recent work without duplicating it.`;

export async function suggestNextBatch(
  recentThemes: string[],
  topPerformers: TopPerformer[],
  currentHour: number
): Promise<NextBatchSuggestion[]> {
  const prompt = `Recent themes used: ${recentThemes.slice(0, 10).join(", ")}
Top performing emotions: ${topPerformers.slice(0, 5).map((p) => p.targetEmotion).join(", ")}
Current hour (0-23): ${currentHour}

Suggest 3 next emotional niches to target. Avoid exact repeats of recent themes. Prefer adjacent niches that would attract the same audience.

Return JSON: { "suggestions": [{ "suggestedTheme": "string", "suggestedAudience": "string", "rationale": "string", "expectedConversionBoost": "string", "urgency": "do_today|this_week|when_ready" }] }`;

  const result = await generateJSON<{ suggestions: NextBatchSuggestion[] }>(SUGGEST_PROMPT, prompt, 1000, "mix-engine");
  return result.suggestions;
}
