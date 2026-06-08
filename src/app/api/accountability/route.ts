import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getDailyStatus, getTodayInTimezone } from "@/lib/accountability/checker";
import { sendSms } from "@/lib/notifications/sms";
import { sendPushToAll } from "@/lib/notifications/push";

const SettingsSchema = z.object({
  dailyTarget: z.number().int().min(1).max(100).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderHour: z.number().int().min(0).max(23).optional(),
  reminderMinute: z.number().int().min(0).max(59).optional(),
  timezone: z.string().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  streakGoal: z.number().int().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action") ?? "status";

  if (action === "status") {
    const status = await getDailyStatus();
    const settings = await prisma.accountabilitySettings.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({ status, settings });
  }

  if (action === "streak") {
    const status = await getDailyStatus();
    return NextResponse.json({
      currentStreak: status.currentStreak,
      longestStreak: status.longestStreak,
    });
  }

  if (action === "calendar") {
    const settings = await prisma.accountabilitySettings.findUnique({ where: { id: "singleton" } });
    const timezone = settings?.timezone ?? "America/Los_Angeles";
    const today = getTodayInTimezone(timezone);
    const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().slice(0, 10);

    const records = await prisma.dailyStreak.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ records });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action") ?? "save-settings";

  if (action === "save-settings") {
    const body = await req.json();
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const settings = await prisma.accountabilitySettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    return NextResponse.json({ settings });
  }

  if (action === "test-sms") {
    await sendSms("Alpha & Omega: SMS test successful. You're all set.");
    return NextResponse.json({ ok: true });
  }

  if (action === "test-push") {
    await sendPushToAll({
      title: "Alpha & Omega Test",
      body: "Push notifications are working!",
      url: "/settings",
      tag: "test",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
