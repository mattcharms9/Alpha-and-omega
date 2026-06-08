import { generateJSON } from "./claude";
import type { ProductBlueprint } from "./product-engine";

export interface RepositionTarget {
  audienceArchetype: string;
  targetEmotion: string;
  newTitle: string;
  newSubtitle: string;
  newDescription: string;
  newTags: string[];
  newCoverConcept: string;
  pricingAdjustment: number;
  differentiationNote: string;
  opportunityScore: number;
}

export interface RepositionReport {
  originalProduct: { title: string; emotion: string; audience: string };
  repositionTargets: RepositionTarget[];
  bestOpportunity: RepositionTarget;
}

const SYSTEM_PROMPT = `You are an expert Etsy digital product market strategist specializing in product repositioning.

You understand that the same workbook, journal, or planner content can serve many different audiences — the transformation is identical, only the language, title, tags, and cover concept change.

Your job is to find the most promising new audience segments for an existing product, scoring each by Etsy opportunity (search volume × low competition).

Rules:
- Keep the core content/structure 100% identical — only change positioning
- Find genuinely different audiences who share the same underlying need
- Title max 70 characters (Etsy limit)
- Include exactly 13 tags
- Opportunity score 0-100: search volume weighted × (100 - competition penalty)`;

export async function repositionProduct(
  blueprint: ProductBlueprint,
  count = 8
): Promise<RepositionReport> {
  const result = await generateJSON<RepositionReport>(
    SYSTEM_PROMPT,
    `Reposition this product for ${count} new audience segments.

ORIGINAL PRODUCT:
Title: ${blueprint.title}
Type: ${blueprint.type}
Target emotion: ${blueprint.targetEmotion}
Current audience: ${blueprint.targetAudience}
Transformation promise: ${blueprint.transformationPromise}
Psychological framework: ${blueprint.psychologicalFramework}

Find ${count} different audiences who need the same transformation. Think across:
- Life stages (new parents, retirees, students, newlyweds)
- Professional contexts (entrepreneurs, teachers, nurses, remote workers)
- Cultural identities (military spouses, expats, first-gen college students)
- Specific pain contexts (grief, burnout, ADHD, divorce recovery)

For each target, create positioning that speaks directly to their identity and uses their language.

Return JSON:
{
  "originalProduct": { "title": "${blueprint.title}", "emotion": "${blueprint.targetEmotion}", "audience": "${blueprint.targetAudience}" },
  "repositionTargets": [
    {
      "audienceArchetype": "...",
      "targetEmotion": "...",
      "newTitle": "...",
      "newSubtitle": "...",
      "newDescription": "...(500 chars max)",
      "newTags": ["tag1",...,"tag13"],
      "newCoverConcept": "...",
      "pricingAdjustment": 0,
      "differentiationNote": "...",
      "opportunityScore": 85
    }
  ],
  "bestOpportunity": <same shape as one of the targets>
}`,
    4096,
    "reposition-engine"
  );

  return result;
}
