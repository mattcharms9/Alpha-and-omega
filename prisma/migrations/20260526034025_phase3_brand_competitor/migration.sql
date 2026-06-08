-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "emotionalCategory" TEXT NOT NULL,
    "targetEmotion" TEXT NOT NULL,
    "audienceArchetype" TEXT NOT NULL,
    "jungianArchetype" TEXT NOT NULL,
    "categoryFrame" TEXT NOT NULL,
    "uniqueValueProposition" TEXT NOT NULL,
    "emotionalPromise" TEXT NOT NULL,
    "brandPersonality" TEXT NOT NULL,
    "brandVoice" TEXT NOT NULL,
    "brandScore" INTEGER NOT NULL DEFAULT 0,
    "defensibilityScore" INTEGER NOT NULL DEFAULT 0,
    "estimatedMonthlyRevenue" TEXT NOT NULL,
    "competitiveMoat" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "audiencePsychology" TEXT NOT NULL,
    "offerStack" TEXT NOT NULL,
    "productLadder" TEXT NOT NULL,
    "messagingFramework" TEXT NOT NULL,
    "funnelMap" TEXT NOT NULL,
    "contentStrategy" TEXT NOT NULL,
    "visualIdentity" TEXT NOT NULL,
    "launchRoadmap" TEXT NOT NULL,
    "revenueProjection" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "emotionalTerritory" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "primaryPlatform" TEXT NOT NULL,
    "contentPillars" TEXT NOT NULL,
    "messagingFramework" TEXT NOT NULL,
    "kpis" TEXT NOT NULL,
    "budget" REAL NOT NULL DEFAULT 0,
    "actualSpend" REAL NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmotionalSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sentiment" REAL NOT NULL,
    "intensity" REAL NOT NULL,
    "urgencyScore" REAL NOT NULL,
    "monetizationScore" REAL NOT NULL,
    "audienceSize" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "engagementRate" REAL NOT NULL DEFAULT 0,
    "viralPotential" REAL NOT NULL DEFAULT 0,
    "actionableInsight" TEXT NOT NULL,
    "relatedKeywords" TEXT NOT NULL,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CompetitorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandName" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "emotionalTerritory" TEXT NOT NULL,
    "jungianArchetype" TEXT NOT NULL,
    "primaryPlatforms" TEXT NOT NULL,
    "estimatedMonthlyRevenue" TEXT NOT NULL,
    "estimatedMonthlySessions" TEXT NOT NULL,
    "pricingStrategy" TEXT NOT NULL,
    "averageOrderValue" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "offerAnalysis" TEXT NOT NULL,
    "contentStrategy" TEXT NOT NULL,
    "psychologyAnalysis" TEXT NOT NULL,
    "weaknesses" TEXT NOT NULL,
    "threats" TEXT NOT NULL,
    "opportunityScore" INTEGER NOT NULL DEFAULT 0,
    "threatLevel" TEXT NOT NULL DEFAULT 'medium',
    "keyTakeaways" TEXT NOT NULL,
    "lastAnalyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PerformanceMetric_entityType_entityId_idx" ON "PerformanceMetric"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "PerformanceMetric_metricName_periodStart_idx" ON "PerformanceMetric"("metricName", "periodStart");
