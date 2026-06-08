import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getDailyStatus, getCurrentHourInTimezone, getTodayInTimezone } from "@/lib/accountability/checker";
import { sendSms, buildReminderSms } from "@/lib/notifications/sms";
import { sendPushToAll, buildReminderPush } from "@/lib/notifications/push";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.accountabilitySettings.findUnique({ where: { id: "singleton" } });
  if (!settings || !settings.reminderEnabled) {
    return NextResponse.json({ skipped: "reminders disabled" });
  }

  const timezone = settings.timezone;
  const currentHour = getCurrentHourInTimezone(timezone);
  const today = getTodayInTimezone(timezone);

  if (currentHour !== settings.reminderHour) {
    return NextResponse.json({ skipped: `hour ${currentHour} !== ${settings.reminderHour}` });
  }

  const todayRecord = await prisma.dailyStreak.findUnique({ where: { date: today } });
  if (todayRecord?.targetMet) {
    return NextResponse.json({ skipped: "target already met" });
  }
  if (todayRecord?.reminderSent) {
    return NextResponse.json({ skipped: "reminder already sent today" });
  }

  const status = await getDailyStatus();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphaandomega.app";

  if (settings.smsEnabled) {
    await sendSms(buildReminderSms({
      posted: status.posted,
      target: status.target,
      remaining: status.remaining,
      streak: status.currentStreak,
      appUrl,
    }));
  }

  if (settings.pushEnabled) {
    await sendPushToAll(buildReminderPush({
      posted: status.posted,
      target: status.target,
      remaining: status.remaining,
      streak: status.currentStreak,
    }));
  }

  await prisma.dailyStreak.upsert({
    where: { date: today },
    update: { reminderSent: true, reminderSentAt: new Date() },
    create: { date: today, reminderSent: true, reminderSentAt: new Date() },
  });

  return NextResponse.json({ ok: true, sent: { sms: settings.smsEnabled, push: settings.pushEnabled } });
}
