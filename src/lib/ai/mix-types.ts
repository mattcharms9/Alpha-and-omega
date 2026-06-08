export type ProductFormat =
  | "journal"
  | "planner"
  | "workbook"
  | "mini_guide"
  | "bundle"
  // Knowledge formats
  | "knowledge_guide"
  | "knowledge_workbook"
  | "checklist"
  | "template_pack"
  // Game formats
  | "game_sheet"
  | "game_pack"
  | "party_kit";

export type GameType =
  | "bingo"
  | "squares"
  | "bracket"
  | "pick_sheet"
  | "prop_bets"
  | "trivia"
  | "how_well_do_you_know"
  | "prediction_sheet"
  | "scavenger_hunt"
  | "word_search";

export type KnowledgeCategory =
  | "money_basics"
  | "taxes"
  | "home_skills"
  | "career"
  | "health_insurance"
  | "legal_basics"
  | "investing"
  | "adulting"
  | "tech_basics"
  | "relationships";

export type EventCategory =
  | "super_bowl"
  | "march_madness"
  | "kentucky_derby"
  | "masters_golf"
  | "world_cup"
  | "nfl_season"
  | "nba_playoffs"
  | "fantasy_sports"
  | "wedding"
  | "bridal_shower"
  | "bachelorette"
  | "baby_shower"
  | "birthday"
  | "retirement"
  | "graduation"
  | "super_bowl_party"
  | "christmas_party"
  | "new_years_eve"
  | "thanksgiving"
  | "halloween_party"
  | "fourth_of_july"
  | "office_party";

export interface PricingTier {
  format: ProductFormat;
  minPrice: number;
  maxPrice: number;
  recommendedPrice: number;
  rationale: string;
}

export interface BatchSlot {
  format: ProductFormat;
  pricing: PricingTier;
  audienceFocus: string;
  transformationAngle: string;
  urgencyLevel: "evergreen" | "seasonal" | "trending";
  positioningNote: string;
}

export interface BatchPlan {
  emotionalTheme: string;
  batchSize: number;
  slots: BatchSlot[];
  bundleStrategy: string;
  totalBatchRevenuePotential: number;
  collectionName: string;
  etsyCollectionNote: string;
}

export interface NextBatchSuggestion {
  suggestedTheme: string;
  suggestedAudience: string;
  rationale: string;
  expectedConversionBoost: string;
  urgency: "do_today" | "this_week" | "when_ready";
}

export const PRICING_TIERS: Record<ProductFormat, PricingTier> = {
  journal: { format: "journal", minPrice: 12, maxPrice: 16, recommendedPrice: 14, rationale: "Daily-use journals justify mid-range pricing. Perceived value is high." },
  planner: { format: "planner", minPrice: 14, maxPrice: 19, recommendedPrice: 16, rationale: "Planners require more structure — buyers pay more for organization systems." },
  workbook: { format: "workbook", minPrice: 17, maxPrice: 24, recommendedPrice: 19, rationale: "Workbooks are perceived as courses/programs. Highest single-product price." },
  mini_guide: { format: "mini_guide", minPrice: 5, maxPrice: 9, recommendedPrice: 7, rationale: "Low barrier to entry. High volume, impulse purchase, entry to your catalog." },
  bundle: { format: "bundle", minPrice: 24, maxPrice: 39, recommendedPrice: 29, rationale: "Bundle price should be ~60% of individual prices combined. Feels like a deal." },
  knowledge_guide: { format: "knowledge_guide", minPrice: 7, maxPrice: 9, recommendedPrice: 8, rationale: "Short practical how-to guides. Impulse buy — low barrier to feeling less embarrassed." },
  knowledge_workbook: { format: "knowledge_workbook", minPrice: 14, maxPrice: 19, recommendedPrice: 16, rationale: "Deeper skill-building with exercises. Positioned as a course replacement." },
  checklist: { format: "checklist", minPrice: 4, maxPrice: 6, recommendedPrice: 5, rationale: "Quick reference printable. Highest volume, lowest barrier. Entry to your catalog." },
  template_pack: { format: "template_pack", minPrice: 9, maxPrice: 12, recommendedPrice: 10, rationale: "Fillable worksheets buyers keep coming back to. Perceived as tools, not content." },
  game_sheet: { format: "game_sheet", minPrice: 3, maxPrice: 5, recommendedPrice: 4, rationale: "Single printable game sheet. Pure impulse purchase — party is tomorrow." },
  game_pack: { format: "game_pack", minPrice: 7, maxPrice: 12, recommendedPrice: 9, rationale: "Value pack of related games. Better margins than single sheets, still impulse price." },
  party_kit: { format: "party_kit", minPrice: 14, maxPrice: 22, recommendedPrice: 17, rationale: "Complete event package. Hosts pay more to have everything covered." },
};

export const DEFAULT_BATCH_MIX: ProductFormat[] = ["journal", "planner", "workbook", "mini_guide", "bundle"];
