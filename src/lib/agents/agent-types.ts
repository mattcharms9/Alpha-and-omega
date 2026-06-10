// ZERO server-only imports — client-safe per RI-007

export type AgentStatus = "idle" | "running" | "complete" | "failed";
export type CompetitionLevel = "low" | "medium" | "high" | "saturated";
export type ConfidenceLevel = "high" | "medium" | "low";
export type CardStatus = "pending" | "approved" | "skipped";
export type BuildStatus = "queued" | "building" | "built" | "publishing" | "published" | "failed";

export interface CatalogSnapshot {
  totalProducts: number;
  activeProducts: number;
  topFormats: string[];
  topEmotions: string[];
  existingKeywords: string[];
  recentlyPublished: string[];
}

export interface PerformingPatternAgent {
  dimension: "format" | "emotion" | "pricePoint" | "audience";
  value: string;
  avgRevenue: number;
  productCount: number;
}

export interface SeasonalSignal {
  event: string;
  daysUntilPeak: number;
  relevantFormats: string[];
  urgency: "now" | "this_week" | "next_month" | "plan_ahead";
}

export interface AgentContext {
  queueId: string;
  date: string;
  catalogSnapshot: CatalogSnapshot;
  performancePatterns: PerformingPatternAgent[];
  seasonalSignals: SeasonalSignal[];
  isColdStart: boolean;
  coldStartNote: string | null;
}

export interface MarketOpportunity {
  keyword: string;
  category: string;
  etsyListingCount: number;
  etsyAvgPrice: number;
  trendingScore: number;
  competitionLevel: CompetitionLevel;
  topRelatedKeywords: string[];
  priceGap: boolean;
  source: "etsy_trending" | "seasonal" | "performance_adjacency";
}

export interface ValidatedNiche extends MarketOpportunity {
  catalogFit: number;
  catalogConflict: boolean;
  conflictingProduct: string | null;
  validationNotes: string;
}

export interface ProductConcept {
  keyword: string;
  title: string;
  format: string;
  targetAudience: string;
  emotionalHook: string;
  suggestedPrice: number;
  keyDifferentiator: string;
  etsySearchTerms: string[];
}

export interface CompetitionCheck {
  keyword: string;
  listingCount: number;
  avgPrice: number;
  topListingReviews: number;
  gapExists: boolean;
  gapType: "price_gap" | "audience_gap" | "format_gap" | "quality_gap" | null;
  gapDescription: string;
  verdict: "green_light" | "proceed_with_caution" | "too_saturated";
}

export interface ScoredOpportunity {
  concept: ProductConcept;
  competition: CompetitionCheck;
  niche: ValidatedNiche;
  opportunityScore: number;
  confidenceLevel: ConfidenceLevel;
  whyNow: string;
  whyYou: string;
  expectedRevenue: string;
  breakdown: {
    marketScore: number;
    competitionScore: number;
    catalogFitScore: number;
    timingScore: number;
  };
}

export interface LaunchCardData {
  position: number;
  productTitle: string;
  productFormat: string;
  targetAudience: string;
  emotionalHook: string;
  primaryKeyword: string;
  suggestedPrice: number;
  etsyListingCount: number;
  etsyAvgPrice: number;
  competitionLevel: CompetitionLevel;
  trendingScore: number;
  opportunityScore: number;
  confidenceLevel: ConfidenceLevel;
  whyNow: string;
  whyYou: string;
  expectedRevenue: string;
  agentReasoning: {
    scout: string;
    validator: string;
    generator: string;
    competition: string;
    scorer: string;
    manager: string;
  };
  dataSource: "live_etsy_data" | "ai_estimate";
  marketEvidence?: string;
}

export interface BuildUpdate {
  cardId: string;
  stage: "blueprint" | "pdf" | "cover_image" | "seo_optimize" | "etsy_draft" | "mockups" | "publish" | "pinterest";
  status: "started" | "complete" | "failed";
  message: string;
  data?: Record<string, unknown>;
}
