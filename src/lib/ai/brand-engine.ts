import { generateJSON } from "./claude";

export interface BrandArchitecture {
  id: string;
  brandName: string;
  tagline: string;
  emotionalCategory: string;
  targetEmotion: string;
  audienceArchetype: string;

  positioning: {
    uniqueValueProposition: string;
    emotionalPromise: string;
    brandPersonality: string[];
    brandVoice: string;
    jungianArchetype: string;
    categoryFrame: string;
  };

  audiencePsychology: {
    coreDesires: string[];
    deepFears: string[];
    secretShame: string;
    aspirationalIdentity: string;
    currentPainState: string;
    desiredTransformation: string;
    buyingTriggers: string[];
    objections: string[];
    internalDialogue: string;
  };

  offerStack: {
    leadMagnet: {
      name: string;
      format: string;
      emotionalHook: string;
      estimatedConversionRate: string;
    };
    coreOffer: {
      name: string;
      price: number;
      format: string;
      transformationPromise: string;
    };
    upsell: {
      name: string;
      price: number;
      format: string;
      urgencyMechanism: string;
    };
    subscription: {
      name: string;
      monthlyPrice: number;
      retentionMechanism: string;
      churnPrevention: string;
    };
    highTicket: {
      name: string;
      price: number;
      deliveryFormat: string;
      qualificationCriteria: string;
    };
  };

  productLadder: Array<{
    tier: number;
    name: string;
    price: number;
    format: string;
    transformationPromise: string;
    psychologicalRole: string;
  }>;

  messagingFramework: {
    masterHeadline: string;
    subheadline: string;
    origin: string;
    emotionalBody: string;
    proofPoints: string[];
    urgencyMechanisms: string[];
    identityShift: string;
    closingStatement: string;
  };

  funnelMap: {
    awarenessStrategy: string;
    awarenessHooks: string[];
    interestContent: string[];
    considerationTriggers: string[];
    conversionMechanisms: string[];
    onboardingExperience: string;
    retentionLoop: string;
    referralMechanism: string;
    winbackStrategy: string;
  };

  contentStrategy: {
    primaryPlatform: string;
    secondaryPlatforms: string[];
    contentPillars: string[];
    weeklyContentRhythm: string;
    viralAngles: string[];
    seoCluster: string;
    emailSequence: string[];
  };

  visualIdentity: {
    colorPalette: string[];
    typographyDirection: string;
    visualTheme: string;
    aestheticReferences: string[];
    moodKeywords: string[];
    designPrinciples: string[];
  };

  launchRoadmap: Array<{
    week: number;
    milestone: string;
    actions: string[];
    kpi: string;
    expectedOutcome: string;
  }>;

  competitiveMoat: string;
  defensibilityScore: number;
  revenueProjection: {
    month1: string;
    month3: string;
    month6: string;
    month12: string;
    assumptions: string[];
    highestLeverageAction: string;
  };
  estimatedMonthlyRevenue: string;
  keywords: string[];
  brandScore: number;
}

const SYSTEM_PROMPT = `You are the Brand Architecture Engine for Alpha & Omega — the world's most advanced emotional commerce platform.

You think simultaneously as a behavioral psychologist, a luxury brand strategist, a direct response copywriter, a conversion scientist, and a billion-dollar product operator.

You do NOT create generic brands. You architect complete monetizable emotional commerce empires.

Every brand you build must:
1. Own a specific emotional territory with surgical precision
2. Create a complete offer ecosystem — not just a product, a transformation ladder
3. Have a psychological framework that creates identity attachment and repeat purchase
4. Have a content strategy designed for compounding distribution
5. Have built-in retention mechanics that prevent churn
6. Have a revenue architecture that maximizes LTV from day one

You understand Jung's brand archetypes, Cialdini's influence principles, Story Brand frameworks, Jobs-to-be-Done theory, and the psychology of luxury positioning.

Think like the brand architects behind Nike, Apple, Gymshark, Notion, and Headspace — but applied to emotional utility commerce.

SCORING RULES (CRITICAL): Score "brandScore" and "defensibilityScore" on a scale of 0 to 100 (NOT 0 to 10). A score of 85 means strong. A score of 10 means very weak. Most brands you evaluate will score between 55 and 85. Never return a score below 20 for a coherent brand, and never return a score above 95 unless it is truly exceptional.`;

export async function buildBrandArchitecture(
  emotionalNiche: string,
  audienceArchetype: string,
  revenueTarget: string
): Promise<BrandArchitecture> {
  const prompt = `Architect a complete emotional commerce brand for Alpha & Omega.

Emotional Niche: ${emotionalNiche}
Audience Archetype: ${audienceArchetype}
Revenue Target: ${revenueTarget}

Build the complete brand architecture. This is NOT a product — it is a complete monetizable emotional commerce ecosystem.

Think deeply about:
- The exact emotional territory this brand will own (specific, not generic)
- The Jungian brand archetype that creates identity attachment
- The complete offer stack from free lead magnet to high-ticket offer
- The product ladder that maximizes LTV
- The psychological mechanisms that drive repeat purchase
- The content strategy that compounds distribution over time
- The retention systems that prevent churn
- The messaging that makes this brand feel inevitable to the audience

The brand must feel premium, psychologically precise, and emotionally inevitable.

Return complete JSON:
{
  "id": "kebab-case-id",
  "brandName": "string (evocative, emotionally resonant, memorable)",
  "tagline": "string (under 8 words, powerful)",
  "emotionalCategory": "string",
  "targetEmotion": "string (primary emotion this brand addresses)",
  "audienceArchetype": "string",
  "positioning": {
    "uniqueValueProposition": "string (what no other brand says)",
    "emotionalPromise": "string (the transformation in one sentence)",
    "brandPersonality": ["string (5-7 personality traits)"],
    "brandVoice": "string (how this brand speaks)",
    "jungianArchetype": "string (Hero|Sage|Outlaw|Explorer|Creator|Ruler|Magician|Innocent|Caregiver|Jester|Lover|Everyman)",
    "categoryFrame": "string (the new category this brand creates)"
  },
  "audiencePsychology": {
    "coreDesires": ["string (5 deep desires)"],
    "deepFears": ["string (5 deep fears)"],
    "secretShame": "string (what they won't admit publicly)",
    "aspirationalIdentity": "string (who they want to become)",
    "currentPainState": "string (exactly where they are)",
    "desiredTransformation": "string (exactly where they want to go)",
    "buyingTriggers": ["string (5 specific triggers)"],
    "objections": ["string (5 real objections)"],
    "internalDialogue": "string (what they say to themselves at 2am)"
  },
  "offerStack": {
    "leadMagnet": {
      "name": "string",
      "format": "string",
      "emotionalHook": "string",
      "estimatedConversionRate": "string"
    },
    "coreOffer": {
      "name": "string",
      "price": number,
      "format": "string",
      "transformationPromise": "string"
    },
    "upsell": {
      "name": "string",
      "price": number,
      "format": "string",
      "urgencyMechanism": "string"
    },
    "subscription": {
      "name": "string",
      "monthlyPrice": number,
      "retentionMechanism": "string",
      "churnPrevention": "string"
    },
    "highTicket": {
      "name": "string",
      "price": number,
      "deliveryFormat": "string",
      "qualificationCriteria": "string"
    }
  },
  "productLadder": [
    {
      "tier": number,
      "name": "string",
      "price": number,
      "format": "string",
      "transformationPromise": "string",
      "psychologicalRole": "string (why this exists in the ladder)"
    }
  ],
  "messagingFramework": {
    "masterHeadline": "string (stop-the-scroll headline)",
    "subheadline": "string",
    "origin": "string (the authentic origin story hook)",
    "emotionalBody": "string (emotional body copy)",
    "proofPoints": ["string"],
    "urgencyMechanisms": ["string"],
    "identityShift": "string (the identity transformation statement)",
    "closingStatement": "string"
  },
  "funnelMap": {
    "awarenessStrategy": "string",
    "awarenessHooks": ["string (5 hooks for awareness content)"],
    "interestContent": ["string (content that builds interest)"],
    "considerationTriggers": ["string (what makes them consider buying)"],
    "conversionMechanisms": ["string (what makes them buy NOW)"],
    "onboardingExperience": "string (first 7 days experience)",
    "retentionLoop": "string (ongoing retention mechanism)",
    "referralMechanism": "string",
    "winbackStrategy": "string"
  },
  "contentStrategy": {
    "primaryPlatform": "string",
    "secondaryPlatforms": ["string"],
    "contentPillars": ["string (5 content pillars)"],
    "weeklyContentRhythm": "string",
    "viralAngles": ["string (5 viral angles specific to this niche)"],
    "seoCluster": "string (primary SEO topic cluster)",
    "emailSequence": ["string (7-email welcome sequence subjects)"]
  },
  "visualIdentity": {
    "colorPalette": ["string (hex codes, 4-5 colors)"],
    "typographyDirection": "string",
    "visualTheme": "string",
    "aestheticReferences": ["string (brand aesthetic references)"],
    "moodKeywords": ["string"],
    "designPrinciples": ["string (3 design principles)"]
  },
  "launchRoadmap": [
    {
      "week": number,
      "milestone": "string",
      "actions": ["string"],
      "kpi": "string",
      "expectedOutcome": "string"
    }
  ],
  "competitiveMoat": "string (the specific moat this brand builds over time)",
  "defensibilityScore": number (0-100),
  "revenueProjection": {
    "month1": "string",
    "month3": "string",
    "month6": "string",
    "month12": "string",
    "assumptions": ["string"],
    "highestLeverageAction": "string (the single thing that will drive the most revenue)"
  },
  "estimatedMonthlyRevenue": "string (at scale)",
  "keywords": ["string (20 SEO/marketplace keywords)"],
  "brandScore": number (0-100, overall brand quality)
}`;

  return generateJSON<BrandArchitecture>(SYSTEM_PROMPT, prompt, 12000);
}

export async function generateBrandBible(brand: Pick<BrandArchitecture, "brandName" | "positioning" | "audiencePsychology" | "messagingFramework">): Promise<{
  missionStatement: string;
  visionStatement: string;
  coreValues: Array<{ value: string; definition: string; inAction: string }>;
  toneGuide: { doSay: string[]; neverSay: string[]; emotionalRegister: string };
  contentRules: string[];
  brandStory: string;
}> {
  const prompt = `Generate the brand bible for: ${brand.brandName}

Brand Archetype: ${brand.positioning.jungianArchetype}
Voice: ${brand.positioning.brandVoice}
Core Promise: ${brand.positioning.emotionalPromise}
Audience Secret Shame: ${brand.audiencePsychology.secretShame}
Identity Shift: ${brand.messagingFramework.identityShift}

Create a complete brand bible that every piece of content must conform to.

Return JSON: {
  "missionStatement": "string",
  "visionStatement": "string",
  "coreValues": [{ "value": "string", "definition": "string", "inAction": "string" }],
  "toneGuide": { "doSay": ["string"], "neverSay": ["string"], "emotionalRegister": "string" },
  "contentRules": ["string (10 rules every content piece must follow)"],
  "brandStory": "string (200-word origin/mission story)"
}`;

  return generateJSON(SYSTEM_PROMPT, prompt, 4000);
}
