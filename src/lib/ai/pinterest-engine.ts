import { generateJSON } from "./claude";
import type { ProductBlueprint } from "./product-engine";

export interface PinterestPinContent {
  title: string;
  description: string;
  altText: string;
  boardSuggestion: string;
  keywords: string[];
  bestPostTime: string;
  ctaText: string;
}

export interface PinterestPinPlan {
  primaryPin: PinterestPinContent;
  variant: PinterestPinContent;
  niche: string;
  audienceNote: string;
  viralPotential: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an elite Pinterest content strategist specializing in digital self-improvement products.

Key Pinterest facts that govern every decision:
- Pinterest is a visual search engine, not a social network — SEO and keyword density matter more than virality
- Users are in planning and aspiration mode — they save things they intend to buy later, often months out
- Best-performing digital product pins: clean lifestyle imagery, legible title text overlay, warm or moody tones
- Optimal format: 2:3 ratio (1000x1500px), vertical — never landscape
- Emotional self-improvement content (journals, planners, workbooks) is a top-performing category
- Descriptions with a clear benefit + soft CTA outperform description-only by ~30%
- Boards matter: a keyword-rich board title dramatically boosts distribution
- Long-tail keywords in pin descriptions are indexed by Pinterest's search algorithm
- Pinterest users who save a product have a 7× higher purchase intent than social media users

Title rules (max 100 chars): Front-load the primary keyword. Use emotional language. Create curiosity without clickbait.
Description rules (max 500 chars): Lead with the transformation. Include 3-5 natural keywords. End with a soft CTA.
Alt text rules (max 500 chars): Describe the image for accessibility AND Pinterest search — include primary emotion and product type.`;

export async function generatePinterestPinPlan(
  blueprint: ProductBlueprint,
  etsyUrl?: string,
  gumroadUrl?: string
): Promise<PinterestPinPlan> {
  const destinationUrl = etsyUrl ?? gumroadUrl ?? "";
  const platforms = [etsyUrl && "Etsy", gumroadUrl && "Gumroad"].filter(Boolean).join(" and ");

  const prompt = `Generate a Pinterest pin content plan for this digital self-improvement product.

PRODUCT:
- Title: "${blueprint.title}"
- Subtitle: "${blueprint.subtitle}"
- Type: ${blueprint.type}
- Target Emotion: ${blueprint.targetEmotion}
- Audience Archetype: ${blueprint.audienceArchetype}
- Transformation Promise: "${blueprint.transformationPromise}"
- Competitive Advantage: "${blueprint.competitiveAdvantage}"
- Description: "${blueprint.descriptionShort}"
${platforms ? `- Available on: ${platforms}` : ""}
${destinationUrl ? `- Destination URL: ${destinationUrl}` : ""}

Generate two pin content variations:
- Primary: benefit-forward angle (what the buyer gains)
- Variant: problem-forward angle (the pain they escape)

Return JSON:
{
  "primaryPin": {
    "title": "string (max 100 chars — keyword-rich, curiosity-driving, front-loaded keyword)",
    "description": "string (max 500 chars — transformation-led, 3-5 natural keywords, ends with soft CTA)",
    "altText": "string (max 500 chars — accessible description that also serves Pinterest SEO)",
    "boardSuggestion": "string (ideal board name this should be pinned to)",
    "keywords": ["string (10-15 Pinterest search keywords)"],
    "bestPostTime": "string (e.g. 'Tuesday–Thursday, 8–11pm EST')",
    "ctaText": "string (short CTA phrase, e.g. 'Save for later →')"
  },
  "variant": {
    "title": "string",
    "description": "string",
    "altText": "string",
    "boardSuggestion": "string",
    "keywords": ["string"],
    "bestPostTime": "string",
    "ctaText": "string"
  },
  "niche": "string (the Pinterest niche category this product sits in)",
  "audienceNote": "string (who on Pinterest will resonate — specific demographics and behaviors)",
  "viralPotential": number (0-100),
  "reasoning": "string (why this approach works specifically on Pinterest for this emotional category)"
}`;

  return generateJSON<PinterestPinPlan>(SYSTEM_PROMPT, prompt, 2000, "pinterest-engine");
}
