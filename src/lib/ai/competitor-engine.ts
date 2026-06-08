import { generateJSON } from "./claude";

export interface CompetitorProfile {
  id: string;
  brandName: string;
  url: string;
  estimatedMonthlyRevenue: string;
  estimatedMonthlySessions: string;
  primaryEmotionalTerritory: string;
  jungianArchetype: string;
  pricingStrategy: string;
  averageOrderValue: string;

  positioning: {
    coreMessage: string;
    uniqueClaim: string;
    targetAudience: string;
    categoryFrame: string;
    emotionalHook: string;
  };

  offerAnalysis: {
    priceRange: { low: number; high: number };
    productTypes: string[];
    leadMagnetApproach: string;
    subscriptionModel: string | null;
    highTicketPresence: boolean;
    bundlingStrategy: string;
  };

  contentStrategy: {
    primaryPlatforms: string[];
    contentFrequency: string;
    viralMechanisms: string[];
    communitySize: string;
    engagementRate: string;
    topPerformingAngles: string[];
  };

  psychologyAnalysis: {
    exploitedBiases: string[];
    urgencyMechanisms: string[];
    socialProofApproach: string;
    identityPositioning: string;
    fearBasedTriggers: string[];
    desireBasedTriggers: string[];
  };

  weaknesses: {
    emotionalGaps: string[];
    audienceUnderserved: string[];
    productGaps: string[];
    messagingWeaknesses: string[];
    operationalWeaknesses: string[];
  };

  threats: string[];
  opportunityScore: number;
  threatLevel: "low" | "medium" | "high" | "critical";
  keyTakeaways: string[];
}

export interface CompetitiveIntelligenceReport {
  id: string;
  niche: string;
  emotionalTerritory: string;
  generatedAt: string;
  marketSummary: string;
  totalAddressableMarket: string;
  emotionalSaturationScore: number;

  competitors: CompetitorProfile[];

  marketGaps: Array<{
    gap: string;
    emotionalTerritory: string;
    audienceServed: string;
    estimatedOpportunitySize: string;
    entryDifficulty: "low" | "medium" | "high";
    timeToCapture: string;
    requiredAssets: string[];
  }>;

  dominantNarratives: Array<{
    narrative: string;
    usedBy: string[];
    saturationLevel: "low" | "medium" | "high";
    emotionalEffectiveness: number;
  }>;

  pricingLandscape: {
    averagePrice: number;
    priceFloor: number;
    priceCeiling: number;
    premiumThreshold: number;
    sweetSpot: string;
    pricingPsychology: string;
  };

  emotionalWhitespace: string[];
  winningStrategy: string;
  positioningRecommendation: string;
  differentiationVectors: string[];
  contentGaps: string[];
  keywordOpportunities: string[];
  moatBuilders: string[];
}

export interface EmotionalGapAnalysis {
  niche: string;
  currentTerritory: string;
  gaps: Array<{
    emotionalNeed: string;
    currentSolutions: string[];
    failurePoint: string;
    opportunitySize: string;
    audienceSize: string;
    monetizationPotential: string;
    firstMoverAdvantage: boolean;
    recommendedApproach: string;
    winningAngle: string;
  }>;
  blueoOceanOpportunity: string;
  redOceanWarnings: string[];
  categoryCreationPotential: string;
  suggestedBrandPositioning: string;
}

const SYSTEM_PROMPT = `You are the Competitive Intelligence Engine for Alpha & Omega — the world's most advanced emotional commerce intelligence system.

You analyze markets with the precision of a hedge fund analyst, the psychological insight of a behavioral economist, and the strategic mind of a billion-dollar brand consultant.

You do NOT produce surface-level competitor research. You produce intelligence that reveals:
1. The exact emotional territories each competitor owns and defends
2. The psychological mechanisms they use to create loyalty and repeat purchase
3. The specific gaps in the emotional landscape that represent untapped opportunity
4. The pricing psychology and revenue architecture powering their growth
5. The content and distribution moats they are building
6. The precise vulnerabilities where they are exposed to disruption

You think like a private equity operator doing due diligence, a brand strategist mapping emotional white space, and a growth hacker looking for distribution arbitrage opportunities.

You understand that in emotional commerce, the real competition is not between products — it is between emotional territories, identity constructs, and transformation promises.

REVENUE ESTIMATION RULES: When estimating revenue for named competitors, always use ranges and clearly frame as estimates (e.g. "estimated $5,000-$15,000/month"). Never state specific revenue figures as facts. Use language like "approximately", "estimated", "likely in the range of". The field "estimatedMonthlyRevenue" must contain a range string, not a single number.

SCORING RULES: "opportunityScore" must be between 0 and 100 (NOT 0-10). Most opportunities score between 40 and 80. An opportunity score above 90 requires extraordinary justification.`;

export async function analyzeCompetitiveLandscape(
  niche: string,
  emotionalTerritory: string,
  competitorCount: number = 5
): Promise<CompetitiveIntelligenceReport> {
  const prompt = `Perform deep competitive intelligence analysis for the emotional commerce market.

Niche: ${niche}
Emotional Territory: ${emotionalTerritory}
Analyze Top ${competitorCount} Competitors

This is NOT a surface-level competitor overview. This is a full strategic intelligence report that maps:
- The exact emotional territories each player owns
- The psychological vulnerabilities in each brand
- The specific gaps in the market that no one is addressing
- The pricing landscape and where premium positioning is possible
- The content moats being built and how to outflank them

Think like a private equity analyst conducting due diligence on this market. What does the emotional landscape actually look like? Who is winning and why? Where is the white space?

For each competitor, analyze their psychological positioning, not just their product. What fear are they monetizing? What identity are they selling? What transformation promise are they making?

Return complete JSON:
{
  "id": "kebab-case-id",
  "niche": "string",
  "emotionalTerritory": "string",
  "generatedAt": "ISO date string",
  "marketSummary": "string (200-word strategic market summary)",
  "totalAddressableMarket": "string (estimated TAM with reasoning)",
  "emotionalSaturationScore": number (0-100, how saturated is the emotional territory),
  "competitors": [
    {
      "id": "kebab-case-id",
      "brandName": "string",
      "url": "string (generic brand URL, no secrets)",
      "estimatedMonthlyRevenue": "string",
      "estimatedMonthlySessions": "string",
      "primaryEmotionalTerritory": "string",
      "jungianArchetype": "string",
      "pricingStrategy": "string",
      "averageOrderValue": "string",
      "positioning": {
        "coreMessage": "string",
        "uniqueClaim": "string",
        "targetAudience": "string",
        "categoryFrame": "string",
        "emotionalHook": "string"
      },
      "offerAnalysis": {
        "priceRange": { "low": number, "high": number },
        "productTypes": ["string"],
        "leadMagnetApproach": "string",
        "subscriptionModel": "string or null",
        "highTicketPresence": boolean,
        "bundlingStrategy": "string"
      },
      "contentStrategy": {
        "primaryPlatforms": ["string"],
        "contentFrequency": "string",
        "viralMechanisms": ["string"],
        "communitySize": "string",
        "engagementRate": "string",
        "topPerformingAngles": ["string"]
      },
      "psychologyAnalysis": {
        "exploitedBiases": ["string (specific cognitive biases they leverage)"],
        "urgencyMechanisms": ["string"],
        "socialProofApproach": "string",
        "identityPositioning": "string",
        "fearBasedTriggers": ["string"],
        "desireBasedTriggers": ["string"]
      },
      "weaknesses": {
        "emotionalGaps": ["string (emotional needs they are NOT meeting)"],
        "audienceUnderserved": ["string (audience segments they ignore)"],
        "productGaps": ["string"],
        "messagingWeaknesses": ["string"],
        "operationalWeaknesses": ["string"]
      },
      "threats": ["string (risks this competitor poses to new entrants)"],
      "opportunityScore": number (0-100, how much opportunity exists against this player),
      "threatLevel": "low|medium|high|critical",
      "keyTakeaways": ["string (3-5 actionable intelligence points)"]
    }
  ],
  "marketGaps": [
    {
      "gap": "string (specific unmet need)",
      "emotionalTerritory": "string",
      "audienceServed": "string",
      "estimatedOpportunitySize": "string",
      "entryDifficulty": "low|medium|high",
      "timeToCapture": "string",
      "requiredAssets": ["string"]
    }
  ],
  "dominantNarratives": [
    {
      "narrative": "string",
      "usedBy": ["string (brand names)"],
      "saturationLevel": "low|medium|high",
      "emotionalEffectiveness": number (0-100)
    }
  ],
  "pricingLandscape": {
    "averagePrice": number,
    "priceFloor": number,
    "priceCeiling": number,
    "premiumThreshold": number,
    "sweetSpot": "string (optimal price point and why)",
    "pricingPsychology": "string (how pricing is used as positioning in this market)"
  },
  "emotionalWhitespace": ["string (5-7 emotional territories no one owns)"],
  "winningStrategy": "string (the exact strategy to win in this market)",
  "positioningRecommendation": "string (specific positioning that creates category separation)",
  "differentiationVectors": ["string (5 ways to be genuinely different)"],
  "contentGaps": ["string (content angles no one is creating)"],
  "keywordOpportunities": ["string (20 keywords with low competition, high intent)"],
  "moatBuilders": ["string (5 assets that create long-term defensibility)"]
}`;

  return generateJSON<CompetitiveIntelligenceReport>(SYSTEM_PROMPT, prompt, 10000);
}

export async function analyzeEmotionalGaps(
  niche: string,
  currentTerritory: string
): Promise<EmotionalGapAnalysis> {
  const prompt = `Perform deep emotional gap analysis for this market.

Niche: ${niche}
Current Dominant Territory: ${currentTerritory}

Analyze the emotional landscape with the precision of a behavioral economist.

The goal: find the specific emotional needs that are completely unaddressed by current players. These are the gaps where a new brand can enter with zero competition and maximum emotional resonance.

Think about:
- What emotions do people in this niche feel that NO product currently addresses?
- What shame, fear, or desire is so private that the market has ignored it?
- What transformation promise has never been made in this space?
- What audience segment feels completely unrecognized by current brands?
- What would feel like "finally, someone gets me" to an underserved buyer?

Return complete JSON:
{
  "niche": "string",
  "currentTerritory": "string",
  "gaps": [
    {
      "emotionalNeed": "string (specific unmet emotional need)",
      "currentSolutions": ["string (what people currently use, inadequately)"],
      "failurePoint": "string (exactly why current solutions fail emotionally)",
      "opportunitySize": "string",
      "audienceSize": "string",
      "monetizationPotential": "string",
      "firstMoverAdvantage": boolean,
      "recommendedApproach": "string (how to capture this gap)",
      "winningAngle": "string (the exact angle that makes this work)"
    }
  ],
  "blueoOceanOpportunity": "string (the single biggest untapped opportunity)",
  "redOceanWarnings": ["string (territories too saturated to enter)"],
  "categoryCreationPotential": "string (opportunity to create a new category entirely)",
  "suggestedBrandPositioning": "string (specific positioning that captures the biggest gap)"
}`;

  return generateJSON<EmotionalGapAnalysis>(SYSTEM_PROMPT, prompt, 6000);
}

export async function generateCompetitiveCounterstrategy(
  ourBrand: { name: string; positioning: string; emotionalTerritory: string },
  competitor: Pick<CompetitorProfile, "brandName" | "positioning" | "weaknesses" | "psychologyAnalysis">
): Promise<{
  threatAssessment: string;
  directCounters: string[];
  flankingMoves: string[];
  audiencePoaching: string;
  contentWarfare: string[];
  pricingCountermove: string;
  narrativeWeapon: string;
  timelineToWin: string;
  winCondition: string;
}> {
  const prompt = `Develop a competitive counterstrategy.

Our Brand: ${ourBrand.name}
Our Positioning: ${ourBrand.positioning}
Our Emotional Territory: ${ourBrand.emotionalTerritory}

Competitor: ${competitor.brandName}
Their Core Message: ${competitor.positioning.coreMessage}
Their Emotional Hook: ${competitor.positioning.emotionalHook}
Their Weaknesses: ${JSON.stringify(competitor.weaknesses)}
Their Psychology: ${JSON.stringify(competitor.psychologyAnalysis)}

Develop a complete competitive counterstrategy. Think like Sun Tzu meets Don Draper meets a growth hacker.

How do we:
1. Exploit their specific emotional weaknesses
2. Poach their most valuable audience segments
3. Win the content arms race without fighting their strengths
4. Price to create maximum perceived value gap
5. Build a narrative that makes their positioning feel insufficient

Return complete JSON:
{
  "threatAssessment": "string",
  "directCounters": ["string (5 direct countermoves)"],
  "flankingMoves": ["string (5 ways to outflank without direct competition)"],
  "audiencePoaching": "string (exact strategy to acquire their audience)",
  "contentWarfare": ["string (5 content strategies that undermine their positioning)"],
  "pricingCountermove": "string",
  "narrativeWeapon": "string (the narrative that makes their story feel incomplete)",
  "timelineToWin": "string",
  "winCondition": "string (exactly what winning looks like in 12 months)"
}`;

  return generateJSON(SYSTEM_PROMPT, prompt, 4000);
}
