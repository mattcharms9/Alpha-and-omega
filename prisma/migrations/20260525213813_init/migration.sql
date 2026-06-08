-- CreateTable
CREATE TABLE "EmotionalTrend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emotion" TEXT NOT NULL,
    "painPoint" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "intensity" REAL NOT NULL,
    "monetizationScore" REAL NOT NULL,
    "evergreenScore" REAL NOT NULL,
    "audienceLoyalty" REAL NOT NULL,
    "urgency" REAL NOT NULL,
    "platforms" TEXT NOT NULL,
    "audienceArchetypes" TEXT NOT NULL,
    "productOpportunities" TEXT NOT NULL,
    "searchVolumeTrend" TEXT NOT NULL,
    "competitionLevel" TEXT NOT NULL,
    "estimatedAnnualRevenue" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetEmotion" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "audienceArchetype" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "sections" TEXT NOT NULL,
    "psychologicalFramework" TEXT NOT NULL,
    "transformationPromise" TEXT NOT NULL,
    "emotionalHooks" TEXT NOT NULL,
    "coverConcept" TEXT NOT NULL,
    "marketingAngles" TEXT NOT NULL,
    "pricingStrategy" TEXT NOT NULL,
    "platforms" TEXT NOT NULL,
    "estimatedMonthlyRevenue" TEXT NOT NULL,
    "competitiveAdvantage" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "descriptionShort" TEXT NOT NULL,
    "descriptionLong" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedPlatforms" TEXT NOT NULL DEFAULT '[]',
    "totalRevenue" REAL NOT NULL DEFAULT 0,
    "monthlyRevenue" REAL NOT NULL DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "emotionalTrigger" TEXT NOT NULL,
    "estimatedViews" TEXT NOT NULL,
    "virality" REAL NOT NULL,
    "conversionPotential" REAL NOT NULL,
    "tone" TEXT NOT NULL,
    "visualDirection" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "actualViews" INTEGER NOT NULL DEFAULT 0,
    "actualEngagement" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentPiece_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RevenueRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "productId" TEXT,
    "revenue" REAL NOT NULL,
    "sales" INTEGER NOT NULL,
    "refunds" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emotionalCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalRevenue" REAL NOT NULL DEFAULT 0,
    "monthlyRevenue" REAL NOT NULL DEFAULT 0,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "audienceSize" INTEGER NOT NULL DEFAULT 0,
    "growthRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
