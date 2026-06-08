import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pinterest } from "@/lib/integrations/pinterest";
import { toSafeErrorMessage } from "@/lib/errors";
import type { PinterestPinContent } from "@/lib/ai/pinterest-engine";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conn = await prisma.pinterestConnection.findFirst();
    if (!conn) {
      return NextResponse.json({ success: true, data: { processed: 0, skipped: "Pinterest not connected" } });
    }

    const now = new Date();
    const due = await prisma.pinQueue.findMany({
      where: { status: "queued", scheduledFor: { lte: now } },
      include: { product: true },
      orderBy: { scheduledFor: "asc" },
      take: 10,
    });

    if (due.length === 0) {
      return NextResponse.json({ success: true, data: { processed: 0 } });
    }

    const results = await Promise.allSettled(
      due.map(async (item) => {
        const pinContent = item.pinContent as unknown as PinterestPinContent;
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3090";
        const imageUrl = `${baseUrl}/product-images/${item.productId}.png`;
        const destinationUrl = item.product.etsyListingUrl ?? item.product.gumroadUrl ?? baseUrl;

        try {
          const pinResponse = await pinterest.createPin(
            {
              boardId: conn.boardId,
              title: pinContent.title,
              description: pinContent.description,
              altText: pinContent.altText,
              destinationUrl,
              imageUrl,
            },
            conn.accessToken
          );

          await prisma.pinterestPin.create({
            data: {
              productId: item.productId,
              pinId: pinResponse.id,
              pinUrl: pinResponse.link,
              boardId: conn.boardId,
              title: pinContent.title,
              description: pinContent.description,
              destinationUrl,
              imageUrl,
            },
          });

          await prisma.pinQueue.update({
            where: { id: item.id },
            data: { status: "published", pinId: pinResponse.id },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await prisma.pinQueue.update({
            where: { id: item.id },
            data: { status: "failed", error: msg },
          });
          throw err;
        }
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Sync analytics for pins that are 1–30 days old (max 20 per run to respect rate limits)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pinsToSync = await prisma.pinterestPin.findMany({
      where: { createdAt: { gte: thirtyDaysAgo, lte: oneDayAgo } },
      take: 20,
      orderBy: { updatedAt: "asc" },
    });

    if (pinsToSync.length > 0) {
      await Promise.allSettled(
        pinsToSync.map(async (pin) => {
          try {
            const analytics = await pinterest.getPinAnalytics(pin.pinId, conn.accessToken);
            await prisma.pinterestPin.update({
              where: { id: pin.id },
              data: {
                impressions: analytics.metrics.IMPRESSION ?? pin.impressions,
                saves: analytics.metrics.SAVE ?? pin.saves,
                clicks: analytics.metrics.PIN_CLICK ?? pin.clicks,
              },
            });
          } catch {
            // Analytics failures are non-fatal — don't break the queue processor
          }
        })
      );
    }

    return NextResponse.json({ success: true, data: { processed: succeeded, failed, analyticsUpdated: pinsToSync.length } });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
