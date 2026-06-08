import { generateJSON } from "./claude";

export interface SeasonalOpportunity {
  niche: string;
  peakMonths: number[];
  currentRelevance: number;
  leadTimeWeeks: number;
  urgency: "publish_now" | "prepare_now" | "plan_ahead" | "off_season";
  rationale: string;
}

export interface SeasonalCalendar {
  currentMonth: number;
  currentOpportunities: SeasonalOpportunity[];
  upcomingOpportunities: SeasonalOpportunity[];
  yearAheadCalendar: Array<{
    month: string;
    topNiches: string[];
    prepareBy: string;
  }>;
}

const SYSTEM_PROMPT = `You are a Seasonal Publishing Intelligence Engine for digital products sold on Etsy and Gumroad.

You understand:
- Seasonal emotional patterns: January (new year goals, diet anxiety, fresh start), February (relationship anxiety, Valentine's loneliness, self-love), March/April (spring cleaning, fresh start energy, tax anxiety), May/June (graduation anxiety, summer body pressure, new beginnings), July/August (back-to-school prep, summer burnout), September (fall reset, back to school, productivity), October (cozy season, seasonal depression onset), November/December (holiday stress, end-of-year reflection, gratitude)
- Etsy digital product buying peaks: November through January are the highest volume months for digital products. September and March are secondary peaks.
- Lead time reality: You need 3-4 weeks of SEO indexing before a seasonal peak hits. Start publishing content 4-6 weeks before peak demand.
- Evergreen vs seasonal: Some niches (anxiety journals, productivity planners) are evergreen with seasonal boosts. Others (Valentine's affirmations, Christmas planners) are purely seasonal.

Output valid JSON with no explanation outside the JSON block.`;

export async function generateSeasonalCalendar(): Promise<SeasonalCalendar> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const prompt = `Today is ${monthNames[currentMonth - 1]} ${now.getFullYear()}. Current month number: ${currentMonth}.

Generate a seasonal publishing calendar for digital emotional utility products (journals, planners, workbooks, affirmation decks).

Return JSON matching this schema:
{
  "currentMonth": ${currentMonth},
  "currentOpportunities": [
    {
      "niche": "string",
      "peakMonths": [array of 1-12],
      "currentRelevance": 0-100,
      "leadTimeWeeks": number,
      "urgency": "publish_now" | "prepare_now" | "plan_ahead" | "off_season",
      "rationale": "string"
    }
  ],
  "upcomingOpportunities": [...same shape, for niches peaking in next 4-8 weeks...],
  "yearAheadCalendar": [
    {
      "month": "Month Name",
      "topNiches": ["niche1", "niche2", "niche3"],
      "prepareBy": "Prepare by Month Name"
    }
  ]
}

Rules:
- currentOpportunities: niches where publishing NOW makes sense (relevance >= 60)
- upcomingOpportunities: niches peaking in next 4-8 weeks that need preparation now
- yearAheadCalendar: all 12 months, starting from current month
- urgency "publish_now": peak is within 2 weeks OR already in peak
- urgency "prepare_now": peak is 2-6 weeks away
- urgency "plan_ahead": peak is 6-16 weeks away
- urgency "off_season": relevance < 30
- Return 4-6 items in currentOpportunities, 3-5 in upcomingOpportunities`;

  return generateJSON<SeasonalCalendar>(SYSTEM_PROMPT, prompt, 3000);
}
