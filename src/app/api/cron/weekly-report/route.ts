import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTodayInTimezone, calculateCurrentStreak } from "@/lib/accountability/checker";
import { sendSms, buildWeeklySms } from "@/lib/notifications/sms";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.accountabilitySettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.smsEnabled) {
    return NextResponse.json({ skipped: "SMS disabled" });
  }

  const timezone = settings.timezone ?? "America/Los_Angeles";
  const today = getTodayInTimezone(timezone);
  const sevenDaysAgo = new Date(new Date(today).getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const weekRecords = await prisma.dailyStreak.findMany({
    where: { date: { gte: sevenDaysAgo } },
  });

  const daysHitTarget = weekRecords.filter((r: { targetMet: boolean }) => r.targetMet).length;
  const productsThisWeek = weekRecords.reduce((sum: number, r: { productsPosted: number }) => sum + r.productsPosted, 0);

  const weekRevenue = await prisma.revenueRecord.aggregate({
    _sum: { revenue: true },
    where: { date: { gte: new Date(sevenDaysAgo) } },
  });

  const streak = await calculateCurrentStreak(today);

  const message = buildWeeklySms({
    weekRevenue: weekRevenue._sum.revenue ?? 0,
    productsThisWeek,
    daysHitTarget,
    streak,
  });

  await sendSms(message);

  return NextResponse.json({ ok: true, daysHitTarget, productsThisWeek, streak });
}
