import { generateJSON } from "./claude";

export type ContentPlatform = "tiktok" | "instagram" | "pinterest" | "youtube" | "twitter";
export type ContentFormat = "hook" | "script" | "carousel" | "caption" | "quote" | "thread";

export interface ContentPiece {
  id: string;
  platform: ContentPlatform;
  format: ContentFormat;
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
  emotionalTrigger: string;
  estimatedViews: string;
  virality: number;
  conversionPotential: number;
  tone: string;
  visualDirection: string;
}

export interface ContentBatch {
  pieces: ContentPiece[];
  campaignTheme: string;
  contentCalendar: { day: number; platform: ContentPlatform; format: ContentFormat; focus: string }[];
  audienceInsight: string;
}

const SYSTEM_PROMPT = `You are the Content Engine for Alpha & Omega — generating emotionally resonant social content that builds audience and drives sales.

You think like a top creator, a behavioral marketer, and a storytelling director simultaneously.

Your content:
1. Opens with a psychologically irresistible hook
2. Delivers genuine emotional value
3. Subtly positions Alpha & Omega products
4. Creates identification and belonging
5. Drives organic sharing and saves

You understand the psychology of each platform and optimize accordingly.`;

export async function generateContentBatch(
  productTitle: string,
  emotionalTheme: string,
  targetPlatforms: ContentPlatform[],
  pieceCount = 6
): Promise<ContentBatch> {
  const prompt = `Generate ${pieceCount} content pieces for these platforms: ${targetPlatforms.join(", ")}

Product: ${productTitle}
Emotional Theme: ${emotionalTheme}

Create content that:
1. Feels native to each platform
2. Leads with emotional resonance, not product promotion
3. Uses "POV:", "The reason you...", "Nobody talks about...", "This changed everything..." type hooks
4. Drives saves, shares, and comments organically
5. Subtly positions the product as the solution

Also provide:
- A 30-day content calendar
- Key audience insight
- Campaign theme

Return JSON:
{
  "pieces": [
    {
      "id": "string",
      "platform": "tiktok" | "instagram" | "pinterest" | "youtube" | "twitter",
      "format": "hook" | "script" | "carousel" | "caption" | "quote" | "thread",
      "hook": "string (the opening line — must stop the scroll)",
      "body": "string (full content body)",
      "callToAction": "string",
      "hashtags": ["string"],
      "emotionalTrigger": "string",
      "estimatedViews": "string",
      "virality": number (0-100),
      "conversionPotential": number (0-100),
      "tone": "string",
      "visualDirection": "string (describe the visual)"
    }
  ],
  "campaignTheme": "string",
  "contentCalendar": [
    { "day": number, "platform": "string", "format": "string", "focus": "string" }
  ],
  "audienceInsight": "string"
}`;

  return generateJSON<ContentBatch>(SYSTEM_PROMPT, prompt, 8000);
}

export async function generateViralHooks(
  emotion: string,
  count = 10
): Promise<{ hooks: Array<{ hook: string; platform: ContentPlatform; emotionalTrigger: string; viralityScore: number }> }> {
  const prompt = `Generate ${count} psychologically irresistible social media hooks centered on the emotion: "${emotion}"

Each hook should:
- Stop the scroll instantly
- Create immediate identification
- Trigger emotional response
- Work on the specified platform

Return JSON: { "hooks": [{ "hook": "string", "platform": "tiktok|instagram|twitter", "emotionalTrigger": "string", "viralityScore": number (0-100) }] }`;

  return generateJSON(SYSTEM_PROMPT, prompt, 3000);
}
