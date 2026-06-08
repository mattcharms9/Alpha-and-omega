import { generateJSON } from "./claude";
import type { GameProductBlueprint, GameCalendarEvent, GameNiche } from "./games-types";
import type { EventCategory, GameType, ProductFormat } from "./mix-types";

const SYSTEM_PROMPT = `You are an expert in the printable party games and sports event sheets market on Etsy.

THE TWO SEGMENTS:

1. LIFE EVENT GAMES (Evergreen — sell all year):
Wedding, bridal shower, baby shower, birthday, retirement, graduation party games.
These are EVERGREEN — someone is getting married or having a baby every single day.
Top performers: "How well do you know the couple", shower bingo, prediction sheets, reception games.

2. SPORTS EVENT GAMES (Seasonal — massive volume, short windows):
Super Bowl squares are searched 500,000+ times in January.
March Madness brackets = one of highest Etsy volume events.
The key is publishing 4 weeks before the event.
Top performers: Squares grids, bracket sheets, prop bet sheets, bingo cards.

WHAT SELLS:
Highest converting Etsy titles include:
- The specific event name
- The game type
- The occasion
- How many people ("for 20+ guests")
- Instant download signal

Example: "Super Bowl Squares Pool Game Printable | 100 Squares Grid | Football Party Game | Instant Download PDF"

CONTENT QUALITY RULES:
- Bingo squares must be SPECIFIC and themed — not generic
  Bad: "Something happens" | Good: "Bride cries happy tears"
- Prop bets: mix of serious and funny, all clearly worded
- How Well Do You Know: mix of heartfelt and playful
- All game content must be immediately usable without editing

SEASONAL TIMING (CRITICAL):
- Super Bowl squares: buyers search 4 WEEKS before the game
- March Madness: searches start 3 WEEKS before Selection Sunday
- Wedding games: peak April-September but sell year-round
- Baby shower games: completely evergreen

PRICING:
- Single game sheet ($3-5): impulse, "party is tomorrow"
- Game pack 5-10 sheets ($7-12): "might as well get them all"
- Party kit 15-20 items ($14-22): "complete package, one purchase"

Score EVERYTHING on 0-100. Always return valid JSON matching the requested interface exactly.`;

export async function generateGameProduct(
  eventCategory: EventCategory,
  gameType: GameType,
  format: ProductFormat,
  customization?: { names?: string[]; theme?: string; guestCount?: number }
): Promise<GameProductBlueprint> {
  const currentMonth = new Date().getMonth() + 1;
  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  const prompt = `Generate a complete game product for:

Event: ${eventCategory}
Game type: ${gameType}
Format: ${format}
Current month: ${monthName} (${currentMonth})
${customization?.names ? `Names/teams: ${customization.names.join(", ")}` : "Use generic/template names"}
${customization?.theme ? `Theme: ${customization.theme}` : ""}
${customization?.guestCount ? `Guest count: ${customization.guestCount}` : ""}

Generate the complete GameProductBlueprint including:
- Full game content in gameContent (all squares, questions, prop bets — actual usable content, not placeholders)
- For bingo: exactly 24 specific themed squares (no generic ones)
- For prop bets: mix of serious and funny
- publishUrgency and daysUntilPeak calculated from current month ${currentMonth}
- etsyTitle optimized for Etsy search with event name + game type
- exactly 13 etsyTags
- coverConceptDescription: flat lay with game sheet, themed decorations, clean background, no people

Return JSON matching this interface exactly:
{
  "title": string,
  "subtitle": string,
  "eventCategory": "${eventCategory}",
  "gameType": "${gameType}",
  "format": "${format}",
  "price": number,
  "itemCount": number,
  "isEvergreen": boolean,
  "peakMonths": [number],
  "currentSeasonalRelevance": number (0-100),
  "publishUrgency": "now"|"this_week"|"next_month"|"plan_ahead",
  "daysUntilPeak": number,
  "etsyTags": [string] (exactly 13),
  "etsyTitle": string,
  "etsyDescription": string,
  "coverConceptDescription": string,
  "gameContent": {
    [relevant fields for the game type]
  }
}`;

  return generateJSON<GameProductBlueprint>(SYSTEM_PROMPT, prompt, 8000, "games-engine");
}

export async function generateGameCalendar(): Promise<GameCalendarEvent[]> {
  const currentMonth = new Date().getMonth() + 1;

  const prompt = `Generate a complete annual games calendar for an Etsy printable games seller.

Current month: ${currentMonth}

Include ALL major events with accurate timing:
Sports: Super Bowl, March Madness, Kentucky Derby, The Masters, NFL Season Start, NBA Playoffs, World Series, NHL Playoffs, Fantasy Football Draft Season, College Football Bowl Season
Life Events (evergreen): Wedding season, Bridal shower, Baby shower, Milestone birthdays, Retirement, Graduation
Holiday Parties: Christmas office party, New Year's Eve, Halloween, Fourth of July, Thanksgiving, Super Bowl party, St. Patrick's Day, Cinco de Mayo

For each event:
- Accurate typical date/window
- When to publish (weeks before peak)
- Estimated Etsy search volume
- Top game types for this event
- Top Etsy search terms

Sort by: events coming soonest first (based on current month ${currentMonth}), then complete the year, then wrap around.

Return JSON array matching:
[{
  "eventCategory": string,
  "eventName": string,
  "eventDate": string,
  "publishBy": string,
  "peakBuyingWindow": string,
  "estimatedVolume": "low"|"medium"|"high"|"massive",
  "isEvergreen": boolean,
  "dateIsApproximate": boolean (true for sports events with variable dates like Super Bowl, March Madness; false for fixed-date holidays),
  "topGameTypes": [string],
  "topEtsyTerms": [string],
  "revenueOpportunity": string
}]`;

  return generateJSON<GameCalendarEvent[]>(SYSTEM_PROMPT, prompt, 6000, "games-engine");
}

export async function generateGameNiches(
  eventCategory: EventCategory
): Promise<GameNiche[]> {
  const prompt = `Expand the event "${eventCategory}" into 10-15 specific game product niches with high Etsy opportunity.

For each niche include: specific game type, why that game type works, specific Etsy search terms.

Return JSON array matching:
[{
  "nicheName": string,
  "gameType": string,
  "opportunityScore": number (0-100),
  "competitionLevel": string,
  "etsySearchVolume": string,
  "topTitle": string,
  "whyItSells": string
}]`;

  return generateJSON<GameNiche[]>(SYSTEM_PROMPT, prompt, 5000, "games-engine");
}
