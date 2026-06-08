-- CreateTable
CREATE TABLE "BankedSignal" (
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
    "freshnessScore" REAL NOT NULL DEFAULT 100,
    "rarityScore" REAL NOT NULL DEFAULT 50,
    "opportunityScore" REAL NOT NULL DEFAULT 0,
    "territory" TEXT NOT NULL DEFAULT '',
    "activatedAt" DATETIME,
    "connectedBrandId" TEXT,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankedSignal_connectedBrandId_fkey" FOREIGN KEY ("connectedBrandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrategicAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionLabel" TEXT NOT NULL DEFAULT '',
    "actionHref" TEXT NOT NULL DEFAULT '',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BankedSignal_emotion_idx" ON "BankedSignal"("emotion");

-- CreateIndex
CREATE INDEX "BankedSignal_opportunityScore_idx" ON "BankedSignal"("opportunityScore");

-- CreateIndex
CREATE INDEX "StrategicAlert_read_createdAt_idx" ON "StrategicAlert"("read", "createdAt");
