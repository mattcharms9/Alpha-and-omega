import { prisma } from "@/lib/db/prisma";

export interface IntelligenceScoreBreakdown {
  score: number;
  daysOfData: number;
  totalSales: number;
  totalListings: number;
  unlocks: { day: number; label: string; unlocked: boolean }[];
}

export async function computeAndSaveIntelligenceScore(): Promise<number> {
  const [cumulative, listingCount, agentRuns] = await Promise.all([
    prisma.cumulativeLearning.findFirst(),
    prisma.product.count({ where: { deletedAt: null, status: { not: "draft" } } }),
    prisma.dailyQueue.count({ where: { status: { in: ["ready", "partial"] } } }),
  ]);

  const daysOfData = cumulative?.daysOfData ?? 0;
  const totalSales = cumulative?.totalSales ?? 0;
  const totalRevenue = cumulative?.totalRevenue ?? 0;

  let score = 0;
  score += Math.min(daysOfData * 1, 30);           // +1/day up to 30
  score += Math.min(totalSales * 2, 30);            // +2/sale up to 30
  score += Math.min(listingCount * 1, 10);          // +1/listing up to 10
  score += Math.min(agentRuns * 3, 15);             // +3/week-equivalent up to 15
  if (totalRevenue > 0) score += 5;                 // first sale bonus
  if (daysOfData >= 7 && totalSales > 0) score += 10; // week of data with sales

  score = Math.min(Math.round(score), 100);

  await prisma.empireConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", intelligenceScore: score, intelligenceScoreAt: new Date() },
    update: { intelligenceScore: score, intelligenceScoreAt: new Date() },
  });

  if (cumulative) {
    await prisma.cumulativeLearning.update({
      where: { id: "singleton" },
      data: { intelligenceScore: score },
    });
  }

  return score;
}

export async function getIntelligenceScoreBreakdown(): Promise<IntelligenceScoreBreakdown> {
  const [config, cumulative, listingCount] = await Promise.all([
    prisma.empireConfig.findFirst(),
    prisma.cumulativeLearning.findFirst(),
    prisma.product.count({ where: { deletedAt: null, status: { not: "draft" } } }),
  ]);

  const score = config?.intelligenceScore ?? 0;
  const daysOfData = cumulative?.daysOfData ?? 0;
  const totalSales = cumulative?.totalSales ?? 0;

  return {
    score,
    daysOfData,
    totalSales,
    totalListings: listingCount,
    unlocks: [
      { day: 7, label: "Niche performance ranking", unlocked: daysOfData >= 7 },
      { day: 30, label: "Format conversion data", unlocked: daysOfData >= 30 },
      { day: 90, label: "Predictive pricing", unlocked: daysOfData >= 90 },
      { day: 180, label: "Full autonomous optimization", unlocked: daysOfData >= 180 },
    ],
  };
}
