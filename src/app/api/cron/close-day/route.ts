import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getTodayInTimezone, calculateCurrentStreak } from "@/lib/accountability/checker";
import { sendSms, buildMilestoneSms, buildTargetHitSms } from "@/lib/notifications/sms";
import { sendPushToAll, buildMilestonePush } from "@/lib/notifications/push";

const MILESTONE_DAYS = new Set([7, 14, 30, 60, 100]);

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.accountabilitySettings.findUnique({ where: { id: "singleton" } });
  const timezone = settings?.timezone ?? "America/Los_Angeles";
  const today = getTodayInTimezone(timezone);

  const record = await prisma.dailyStreak.findUnique({ where: { date: today } });
  const target = settings?.dailyTarget ?? 20;
  const posted = record?.productsPosted ?? 0;
  const targetMet = posted >= target;

  // Finalize today's record
  await prisma.dailyStreak.upsert({
    where: { date: today },
    update: { targetMet, productsPosted: posted },
    create: { date: today, productsPosted: posted, targetMet },
  });

  if (!targetMet) {
    return NextResponse.json({ ok: true, targetMet: false, posted, target });
  }

  const streak = await calculateCurrentStreak(today);

  // Milestone check
  if (MILESTONE_DAYS.has(streak)) {
    if (settings?.smsEnabled) {
      void sendSms(buildMilestoneSms(streak)).catch((e) => console.error("[close-day] milestone SMS failed:", e));
    }
    if (settings?.pushEnabled) {
      void sendPushToAll(buildMilestonePush(streak)).catch((e) => console.error("[close-day] milestone push failed:", e));
    }
    await prisma.strategicAlert.create({
      data: {
        type: "milestone",
        title: `${streak}-Day Streak!`,
        body: buildMilestoneSms(streak),
        actionLabel: "View Products",
        actionHref: "/products",
      },
    });
  } else {
    // Target hit — send congratulatory SMS on target-met days (non-milestone)
    if (settings?.smsEnabled) {
      void sendSms(buildTargetHitSms({ posted, streak })).catch((e) =>
        console.error("[close-day] target SMS failed:", e)
      );
    }
  }

  return NextResponse.json({ ok: true, targetMet: true, posted, target, streak });
}
