import { generateJSON } from "./claude";

export interface QuickIdea {
  title: string;
  format: string;
  price: string;
  score: number;
  tagline: string;
}

const SYSTEM_PROMPT = `You are a rapid-fire Etsy digital product ideation engine. Given a topic or keyword, you generate 10 high-potential product ideas in 5 seconds. Each idea is specific, marketable, and optimized for Etsy search.

Rules:
- Format must be one of: journal, planner, workbook, checklist, guide, template_pack, bingo_card, trivia_sheet
- Price range: $3–19 depending on format complexity
- Score 0-100: search volume × monetization potential × low competition (higher = better opportunity)
- Tagline: one punchy sentence describing the transformation
- Be specific — not "anxiety journal" but "The Anxious Mom's Daily Reset Workbook"

Return a JSON object with a "ideas" array of 10 objects, each with: title, format, price (e.g. "$9.99"), score (number), tagline.`;

export async function generateQuickIdeas(query: string): Promise<QuickIdea[]> {
  if (!query.trim()) return [];

  const result = await generateJSON<{ ideas: QuickIdea[] }>(
    SYSTEM_PROMPT,
    `Generate 10 quick Etsy product ideas for: "${query}"\n\nReturn a JSON object with an "ideas" array.`,
    2000
  );
  return result.ideas ?? [];
}
