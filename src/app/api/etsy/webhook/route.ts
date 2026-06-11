import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createHmac } from "crypto";
import { sendSaleAlert } from "@/lib/notifications/email";
import { sanitizeForEtsy } from "@/lib/utils/etsy-sanitizer";

export const maxDuration = 30;

interface EtsyReceiptEvent {
  shop_id: number;
  receipt_id: number;
  transactions: Array<{
    listing_id: number;
    quantity: number;
    price: { amount: number; divisor: number };
  }>;
  buyer_email: string;
}

// POST — receives Etsy webhook events; always returns 200 to prevent Etsy retries
export async function POST(req: NextRequest) {
  const secret = process.env.ETSY_WEBHOOK_SECRET;

  if (secret) {
    const signature = req.headers.get("x-etsy-signature") ?? "";
    const body = await req.text();
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    try {
      await handleEvent(JSON.parse(body) as EtsyReceiptEvent);
    } catch (err) {
      console.error("[webhook] handleEvent failed:", err instanceof Error ? err.message : err);
    }
  } else {
    const event = await req.json() as EtsyReceiptEvent;
    await handleEvent(event).catch((err) =>
      console.error("[webhook] handleEvent failed (no-secret mode):", err instanceof Error ? err.message : err)
    );
  }

  // Always 200 — Etsy will retry on non-2xx
  return NextResponse.json({ received: true });
}

async function handleEvent(event: EtsyReceiptEvent): Promise<void> {
  if (!Array.isArray(event.transactions)) return;

  for (const tx of event.transactions) {
    const listingId = String(tx.listing_id);
    const listing = await prisma.etsyListing.findUnique({ where: { etsyListingId: listingId } });
    if (!listing) continue;

    const amount = (tx.price.amount / tx.price.divisor) * tx.quantity;

    // Fetch product to get primary keyword for niche matching
    const product = await prisma.product.findUnique({
      where: { id: listing.productId },
      select: { keywords: true },
    });
    const primaryKeyword = (product?.keywords as string[])?.[0] ?? "";
    const safeTitle = sanitizeForEtsy(listing.title);

    await Promise.all([
      prisma.etsyListing.update({
        where: { etsyListingId: listingId },
        data: { sales: { increment: tx.quantity }, revenue: { increment: amount } },
      }),
      prisma.revenueRecord.create({
        data: {
          productId: listing.productId,
          platform: "etsy",
          revenue: amount,
          sales: tx.quantity,
          source: "etsy_webhook",
        },
      }),
      prisma.learningEntry.create({
        data: {
          lessonType: "sale_validated",
          content: `Sold ${tx.quantity} unit${tx.quantity > 1 ? "s" : ""} of "${safeTitle}" for $${amount.toFixed(2)} via Etsy. Niche: ${primaryKeyword}`,
          niche: primaryKeyword || null,
          productId: listing.productId,
          revenue: amount,
        },
      }),
    ]);

    // Increment salesCount on matching MarketIntelligenceReport
    if (primaryKeyword) {
      await prisma.marketIntelligenceReport.updateMany({
        where: { niche: { contains: primaryKeyword } },
        data: { salesCount: { increment: tx.quantity } },
      }).catch((err) =>
        console.warn("[webhook] salesCount increment failed:", err instanceof Error ? err.message : err)
      );
    }

    void sendSaleAlert({
      productTitle: listing.title,
      platform: "Etsy",
      revenue: amount,
      buyerEmail: event.buyer_email,
      totalRevenue: listing.revenue + amount,
    }).catch(() => {});
  }
}
