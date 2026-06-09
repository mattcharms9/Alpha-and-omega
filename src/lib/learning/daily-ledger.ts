import { generateJSON } from "@/lib/ai/claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface DailyLesson {
  date: string;
  winningNiches: string[];
  winningFormats: string[];
  winningPricePoints: number[];
  winningTitlePatterns: string[];
  winningTags: string[];
  deadNiches: string[];
  deadFormats: string[];
  deadPricePoints: number[];
  topViewedListings: string[];
  topConvertingListings: string[];
  zeroViewListings: string[];
  bundlesSold: string[];
  bundleRevenue: number;
  recommendedNiches: string[];
  recommendedFormats: string[];
  avoidNiches: string[];
  confidenceScore: number;
}

const SYSTEM_PROMPT = `You are a data analyst for a digital product business on Etsy and Gumroad.
Your job is to extract actionable lessons from daily sales and listing performance data.
Be specific and data-driven. If there is no data yet, return low-confidence defaults with empty arrays.
Return a JSON object matching the DailyLesson interface exactly.`;

export async function recordDailyLessons(date: string): Promise<DailyLesson> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const [revenues, listings, products] = await Promise.all([
    prisma.revenueRecord.findMany({ where: { date: { gte: dayStart, lte: dayEnd } } }),
    prisma.etsyListing.findMany({
      where: { updatedAt: { gte: dayStart, lte: dayEnd } },
      include: { product: { select: { type: true, targetEmotion: true, keywords: true, title: true } } },
    }),
    prisma.product.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      select: { title: true, type: true, targetEmotion: true, totalRevenue: true },
    }),
  ]);

  const totalRevenue = revenues.reduce((sum, r) => sum + r.revenue, 0);
  const totalSales = revenues.reduce((sum, r) => sum + r.sales, 0);

  const dataContext = `
Date: ${date}
Revenue: $${totalRevenue.toFixed(2)} from ${totalSales} sales
Listing performance today: ${listings.map((l) => `"${l.title}" views=${l.views} favorites=${l.favorites} sales=${l.sales} revenue=$${l.revenue}`).join("; ") || "No listings synced"}
Products launched today: ${products.map((p) => `"${p.title}" type=${p.type} emotion=${p.targetEmotion}`).join("; ") || "None"}
`;

  const lesson = await generateJSON<DailyLesson>(
    SYSTEM_PROMPT,
    `Analyze this day's data and extract lessons:\n${dataContext}\n\nReturn a DailyLesson JSON with confidence_score 0-100 (based on how much data we have).`,
    2000
  ).catch((): DailyLesson => ({
    date,
    winningNiches: [],
    winningFormats: [],
    winningPricePoints: [],
    winningTitlePatterns: [],
    winningTags: [],
    deadNiches: [],
    deadFormats: [],
    deadPricePoints: [],
    topViewedListings: [],
    topConvertingListings: [],
    zeroViewListings: listings.filter((l) => l.views === 0).map((l) => l.title),
    bundlesSold: [],
    bundleRevenue: 0,
    recommendedNiches: [],
    recommendedFormats: [],
    avoidNiches: [],
    confidenceScore: 0,
  }));

  lesson.date = date;

  await prisma.learningLedger.upsert({
    where: { date },
    create: { date, lessons: lesson as unknown as Prisma.InputJsonValue, revenueTotal: totalRevenue, salesCount: totalSales },
    update: { lessons: lesson as unknown as Prisma.InputJsonValue, revenueTotal: totalRevenue, salesCount: totalSales },
  });

  // Update cumulative learning
  await updateCumulativeLearning(lesson, totalRevenue, totalSales);

  return lesson;
}

async function updateCumulativeLearning(lesson: DailyLesson, revenue: number, sales: number): Promise<void> {
  const existing = await prisma.cumulativeLearning.findFirst();

  const mergeArrays = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  const mergeFormats = (existing: Record<string, number>, winners: string[]): Record<string, number> => {
    const result = { ...existing };
    winners.forEach((f) => { result[f] = (result[f] ?? 0) + 1; });
    return result;
  };

  if (!existing) {
    await prisma.cumulativeLearning.create({
      data: {
        winningNiches: lesson.winningNiches as Prisma.InputJsonValue,
        winningFormats: mergeFormats({}, lesson.winningFormats) as Prisma.InputJsonValue,
        winningPricePoints: lesson.winningPricePoints as Prisma.InputJsonValue,
        deadNiches: lesson.deadNiches as Prisma.InputJsonValue,
        totalRevenue: revenue,
        totalSales: sales,
        daysOfData: 1,
        lastUpdated: new Date(),
      },
    });
  } else {
    const exWinNiches = (existing.winningNiches as string[]) ?? [];
    const exDeadNiches = (existing.deadNiches as string[]) ?? [];
    const exFormats = (existing.winningFormats as Record<string, number>) ?? {};
    await prisma.cumulativeLearning.update({
      where: { id: "singleton" },
      data: {
        winningNiches: mergeArrays(exWinNiches, lesson.winningNiches) as Prisma.InputJsonValue,
        winningFormats: mergeFormats(exFormats, lesson.winningFormats) as Prisma.InputJsonValue,
        winningPricePoints: lesson.winningPricePoints as Prisma.InputJsonValue,
        deadNiches: mergeArrays(exDeadNiches, lesson.deadNiches) as Prisma.InputJsonValue,
        totalRevenue: { increment: revenue },
        totalSales: { increment: sales },
        daysOfData: { increment: 1 },
        lastUpdated: new Date(),
      },
    });
  }
}

export async function getLearningContext(): Promise<string> {
  const [cumulative, recentLedger] = await Promise.all([
    prisma.cumulativeLearning.findFirst(),
    prisma.learningLedger.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  if (!cumulative || cumulative.daysOfData === 0) {
    return "No sales data yet. Day 1 operation — diversify equally across all formats: journals, workbooks, knowledge guides, party games, and bundles. Use proven Etsy categories.";
  }

  const winNiches = (cumulative.winningNiches as string[]).slice(0, 5);
  const deadNiches = (cumulative.deadNiches as string[]).slice(0, 5);
  const formats = cumulative.winningFormats as Record<string, number>;
  const topFormats = Object.entries(formats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const recentRevenue = recentLedger.reduce((s, l) => s + l.revenueTotal, 0);

  const lines: string[] = [
    `Based on ${cumulative.daysOfData} day${cumulative.daysOfData !== 1 ? "s" : ""} of data:`,
    `Total revenue: $${cumulative.totalRevenue.toFixed(2)} from ${cumulative.totalSales} sales.`,
    `Last 30 days revenue: $${recentRevenue.toFixed(2)}.`,
  ];
  if (winNiches.length > 0) lines.push(`Winning niches: ${winNiches.join(", ")}.`);
  if (topFormats.length > 0) lines.push(`Best performing formats: ${topFormats.join(", ")}.`);
  if (deadNiches.length > 0) lines.push(`Avoid these niches (zero sales): ${deadNiches.join(", ")}.`);

  const recentLessons = recentLedger.slice(0, 7).flatMap((l) => {
    const lesson = l.lessons as unknown as DailyLesson;
    return lesson.winningTitlePatterns?.slice(0, 2) ?? [];
  });
  if (recentLessons.length > 0) lines.push(`Recent winning title patterns: ${[...new Set(recentLessons)].slice(0, 3).join("; ")}.`);

  return lines.join(" ");
}
