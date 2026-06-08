export interface AudienceArchetype {
  name: string;
  ageRange: string;
  lifeStage: string;
  coreStruggle: string;
  whatTheyveAlreadyTried: string[];
  languageTheyUse: string[];
  whereLive: string[];
  incomeSensitivity: "low" | "medium" | "high";
  buyingTrigger: string;
}

export interface ProductRecommendation {
  format: "journal" | "planner" | "workbook" | "mini_guide" | "bundle";
  title: string;
  pricePoint: number;
  pageCount: number;
  coreTransformation: string;
  whyThisFormat: string;
  bundleOpportunity: string;
}

export interface EtsySearchIntel {
  primaryKeywords: string[];
  longTailKeywords: string[];
  titleFormula: string;
  tagSuggestions: string[];
  priceRange: string;
  competitionLevel: "low" | "medium" | "high";
  estimatedMonthlySearches: "low" | "medium" | "high" | "very_high";
  gaps: string[];
}

export interface ContentAngles {
  pinterestHook: string;
  pinterestDescription: string;
  instagramHook: string;
  tiktokAngle: string;
  emailSubjectLine: string;
}

export interface SubNiche {
  id: string;
  parentEmotion: string;
  nicheName: string;
  nicheSlug: string;
  oneLiner: string;
  opportunityScore: number;
  marketSize: "niche" | "medium" | "large" | "massive";
  competitionLevel: "low" | "medium" | "high";
  evergreenScore: number;
  trendingScore: number;
  monetizationScore: number;
  peakMonths: number[];
  currentSeasonalRelevance: number;
  urgency: "publish_now" | "prepare_soon" | "plan_ahead" | "off_season";
  audience: AudienceArchetype;
  topProductRecommendation: ProductRecommendation;
  allProductFormats: ProductRecommendation[];
  etsyIntel: EtsySearchIntel;
  contentAngles: ContentAngles;
  relatedNiches: string[];
  competitorGaps: string[];
  whyNowRationale: string;
}

export interface NicheExpansionReport {
  parentEmotion: string;
  totalNichesFound: number;
  subNiches: SubNiche[];
  topPick: SubNiche;
  quickWins: SubNiche[];
  seasonalPicks: SubNiche[];
  expansionMap: string[];
  researchSummary: string;
}

export interface SavedNiche extends SubNiche {
  savedAt: string;
  productsGenerated: number;
  totalRevenue: number;
  notes: string;
  status: "researched" | "in_progress" | "producing" | "saturated";
}
