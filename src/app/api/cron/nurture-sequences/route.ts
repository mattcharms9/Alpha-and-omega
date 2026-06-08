import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendDay3Email, sendDay7Email } from "@/lib/notifications/nurture";

// Schedule: 0 10 * * * (10am UTC daily)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const day3Cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const day7Cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day3Min = new Date(day3Cutoff.getTime() - 24 * 60 * 60 * 1000);
  const day7Min = new Date(day7Cutoff.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Find records needing day-3 email (purchased 3 days ago, day3 not sent)
    const day3Records = await prisma.nurtureRecord.findMany({
      where: { day3SentAt: null, createdAt: { gte: day3Min, lte: day3Cutoff } },
      take: 20,
    });

    const day7Records = await prisma.nurtureRecord.findMany({
      where: { day7SentAt: null, day3SentAt: { not: null }, createdAt: { gte: day7Min, lte: day7Cutoff } },
      take: 20,
    });

    let sent3 = 0, sent7 = 0;

    for (const record of day3Records) {
      const product = await prisma.product.findUnique({ where: { id: record.productId }, select: { title: true } });
      if (!product) continue;
      await sendDay3Email(record.email, product.title).catch(() => {});
      await prisma.nurtureRecord.update({ where: { id: record.id }, data: { day3SentAt: new Date() } });
      sent3++;
    }

    for (const record of day7Records) {
      const product = await prisma.product.findUnique({ where: { id: record.productId }, select: { title: true } });
      if (!product) continue;
      await sendDay7Email(record.email, product.title).catch(() => {});
      await prisma.nurtureRecord.update({ where: { id: record.id }, data: { day7SentAt: new Date() } });
      sent7++;
    }

    return NextResponse.json({ success: true, data: { sent3, sent7 } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    console.error("[cron/nurture-sequences]", msg);
    return NextResponse.json({ success: false, error: "Nurture cron failed" }, { status: 500 });
  }
}
