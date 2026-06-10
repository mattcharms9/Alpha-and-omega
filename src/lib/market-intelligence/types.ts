// ZERO server-only imports — client-safe per RI-007

export interface TopSellerListing {
  listingId: string;
  title: string;
  price: number;
  reviewCount: number;
  favoritesCount: number;
  tags: string[];
  imageUrl: string;
  shopName: string;
  daysListed: number;
  reviewVelocity: number;
}

export interface RisingListing {
  listingId: string;
  title: string;
  price: number;
  reviewCount: number;
  favoritesCount: number;
  tags: string[];
  imageUrl: string;
  daysListed: number;
  momentumScore: number;
}

export interface PricePoint {
  price: number;
  count: number;
  percentOfTop50: number;
}

export interface ProductOpportunity {
  opportunityType: "gap" | "underserved" | "rising" | "premium";
  title: string;
  reasoning: string;
  suggestedPrice: number;
  suggestedTags: string[];
  titleFormula: string;
  estimatedCompetition: "low" | "medium" | "high";
  confidenceScore: number;
}

export interface VisualIntelligence {
  dominantColors: string[];
  dominantStyle: "minimal" | "illustrated" | "photo" | "typographic" | "mixed";
  titleOnCover: boolean;
  fontStyle: "serif" | "sans-serif" | "script" | "mixed";
  commonElements: string[];
  whatToAvoid: string[];
  exampleImageUrls: string[];
}

export interface WinningPriceRange {
  min: number;
  max: number;
  sweet: number;
}

export interface MarketReport {
  id: string;
  niche: string;
  reportDate: string;
  totalListings: number;
  topSellers: TopSellerListing[];
  risingListings: RisingListing[];
  priceDistribution: PricePoint[];
  winningTitleStructures: string[];
  winningTags: string[];
  winningPriceRange: WinningPriceRange;
  winningFormats: string[];
  visualStyle: VisualIntelligence;
  productOpportunities: ProductOpportunity[];
  avoidPatterns: string[];
  competitionLevel: "low" | "medium" | "high" | "saturated";
  opportunityScore: number;
  createdAt: string;
}

export interface MarketSnapshot {
  id: string;
  snapshotDate: string;
  nichesAnalyzed: number;
  totalListingsPulled: number;
  topOpportunities: Array<{ niche: string; opportunityScore: number; competitionLevel: string }>;
  marketSummary: string;
  createdAt: string;
}

export const TRACKED_NICHES = [
  // Financial
  "financial anxiety journal",
  "money mindset workbook",
  "budget planner printable",
  "debt payoff tracker",
  "financial shame workbook",
  // Life Transitions
  "midlife purpose journal",
  "divorce recovery journal",
  "grief journal printable",
  "sobriety journal",
  "anxiety workbook printable",
  // Identity & Purpose
  "self worth journal",
  "burnout recovery workbook",
  "boundaries workbook",
  "trauma healing journal",
  "confidence journal women",
  // Games & Events
  "baby shower games printable",
  "bridal shower games printable",
  "bachelorette party games",
  "super bowl squares printable",
  "wedding trivia printable",
  // Knowledge Guides
  "adulting guide printable",
  "first apartment checklist",
  "new homeowner guide",
  "career change workbook",
  "how to budget guide printable",
] as const;

export type TrackedNiche = (typeof TRACKED_NICHES)[number];
