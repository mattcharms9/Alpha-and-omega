import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { sendPushToAll } from "@/lib/notifications/push";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional(),
});

const UnsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function POST(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action") ?? "subscribe";

  if (action === "subscribe") {
    const body = await req.json();
    const parsed = SubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    const { endpoint, p256dh, auth, userAgent } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userAgent },
      create: { endpoint, p256dh, auth, userAgent },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "unsubscribe") {
    const body = await req.json();
    const parsed = UnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } });
    return NextResponse.json({ ok: true });
  }

  if (action === "test") {
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

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");
  if (action === "count") {
    const count = await prisma.pushSubscription.count();
    return NextResponse.json({ count });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
