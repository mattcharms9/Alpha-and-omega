import type { ProductFormat, KnowledgeCategory } from "./mix-types";

export interface CapabilityGap {
  id: string;
  title: string;
  category: KnowledgeCategory;
  audience: string;
  shameLevel: number;
  urgencyTrigger: string;
  whatTheyveSearched: string[];
  authenticLanguage: string[];
  opportunityScore: number;
  competitionLevel: "low" | "medium" | "high";
  etsySearchTerms: string[];
  recommendedFormat: ProductFormat;
  recommendedPrice: number;
  productTitleFormula: string;
  sampleTitles: string[];
  contentOutline: string[];
  shameReframe: string;
  evergreen: boolean;
  peakMonths: number[];
}

export interface CapabilityGapReport {
  targetAudience: string;
  category: KnowledgeCategory;
  totalGapsFound: number;
  gaps: CapabilityGap[];
  topPick: CapabilityGap;
  quickWins: CapabilityGap[];
  audienceSummary: string;
  marketContext: string;
  titleStrategy: string;
  bundleOpportunity: string;
}

export interface AudienceGap {
  gap: string;
  painPoint: string;
  desiredTransformation: string;
  blockers: string[];
  searchIntent: string[];
  idealProductType: string;
  priceWillingness: string;
  opportunityScore: number;
}

export interface AudienceGapReport {
  targetAudience: string;
  audienceProfile: string;
  coreIdentityTension: string;
  gaps: AudienceGap[];
  topOpportunity: AudienceGap;
  bundleIdea: string;
  audienceLanguage: string[];
  totalGapsFound: number;
}

export interface KnowledgeSection {
  title: string;
  type: "explainer" | "steps" | "checklist" | "worksheet" | "key_terms" | "examples";
  content: string[];
  hasWorksheet: boolean;
  estimatedPages: number;
}

export interface KnowledgeProductBlueprint {
  title: string;
  subtitle: string;
  targetGap: CapabilityGap;
  format: ProductFormat;
  price: number;
  pageCount: number;
  sections: KnowledgeSection[];
  learningOutcomes: string[];
  prerequisiteKnowledge: string;
  toneGuidance: string;
  designNotes: string;
  etsyDescription: string;
  tags: string[];
  coverConceptDescription: string;
}
