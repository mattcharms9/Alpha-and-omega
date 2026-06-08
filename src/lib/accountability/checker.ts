import { prisma } from "@/lib/db/prisma";

export interface DailyStatus {
  date: string;
  posted: number;
  target: number;
  remaining: number;
  targetMet: boolean;
  currentStreak: number;
  longestStreak: number;
}

export function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

export function getCurrentHourInTimezone(timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()),
    10
  );
}

export async function getDailyStatus(): Promise<DailyStatus> {
  const settings = await prisma.accountabilitySettings.findUnique({
    where: { id: "singleton" },
  });
  const target = settings?.dailyTarget ?? 20;
  const timezone = settings?.timezone ?? "America/Los_Angeles";
  const today = getTodayInTimezone(timezone);

  const todayRecord = await prisma.dailyStreak.findUnique({ where: { date: today } });
  const posted = todayRecord?.productsPosted ?? 0;
  const targetMet = posted >= target;

  const { currentStreak, longestStreak } = await calculateStreaks(today);

  return {
    date: today,
    posted,
    target,
    remaining: Math.max(0, target - posted),
    targetMet,
    currentStreak,
    longestStreak,
  };
}

export async function calculateCurrentStreak(asOfDate?: string): Promise<number> {
  const { currentStreak } = await calculateStreaks(asOfDate);
  return currentStreak;
}

export async function calculateLongestStreak(asOfDate?: string): Promise<number> {
  const { longestStreak } = await calculateStreaks(asOfDate);
  return longestStreak;
}

async function calculateStreaks(asOfDate?: string): Promise<{ currentStreak: number; longestStreak: number }> {
  const records = await prisma.dailyStreak.findMany({
    where: { targetMet: true },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (records.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const dates = records.map((r: { date: string }) => r.date).sort().reverse();
  const today = asOfDate ?? new Date().toISOString().slice(0, 10);

  let currentStreak = 0;
  let longestStreak = 0;
  let runStreak = 0;
  let prevDate: string | null = null;

  for (const d of dates) {
    if (!prevDate) {
      const diffFromToday = daysBetween(d, today);
      if (diffFromToday > 1) break; // gap from today means streak is 0
      runStreak = 1;
    } else {
      const diff = daysBetween(d, prevDate);
      if (diff === 1) {
        runStreak++;
      } else {
        break; // gap breaks current streak
      }
    }
    prevDate = d;
    currentStreak = runStreak;
    if (runStreak > longestStreak) longestStreak = runStreak;
  }

  // Calculate longest streak separately (scan all records)
  let maxRun = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...dates].reverse()) {
    if (!prev) {
      run = 1;
    } else {
      run = daysBetween(prev, d) === 1 ? run + 1 : 1;
    }
    if (run > maxRun) maxRun = run;
    prev = d;
  }

  return { currentStreak, longestStreak: maxRun };
}

function daysBetween(earlier: string, later: string): number {
  const e = new Date(earlier).getTime();
  const l = new Date(later).getTime();
  return Math.round(Math.abs(l - e) / 86400000);
}

export async function incrementTodayCount(timezone: string): Promise<number> {
  const today = getTodayInTimezone(timezone);
  const settings = await prisma.accountabilitySettings.findUnique({ where: { id: "singleton" } });
  const target = settings?.dailyTarget ?? 20;

  const record = await prisma.dailyStreak.upsert({
    where: { date: today },
    update: { productsPosted: { increment: 1 }, targetMet: false },
    create: { date: today, productsPosted: 1 },
  });

  const newCount = record.productsPosted;
  if (newCount >= target && !record.targetMet) {
    await prisma.dailyStreak.update({ where: { date: today }, data: { targetMet: true } });
  }

  return newCount;
}
