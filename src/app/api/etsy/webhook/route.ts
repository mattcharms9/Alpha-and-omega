import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createHmac } from "crypto";
import { sendSaleAlert } from "@/lib/notifications/email";

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

// POST — receives Etsy webhook events
export async function POST(req: NextRequest) {
  const secret = process.env.ETSY_WEBHOOK_SECRET;

  if (secret) {
    const signature = req.headers.get("x-etsy-signature") ?? "";
    const body = await req.text();
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    // Re-parse body as JSON after reading as text
    try {
      await handleEvent(JSON.parse(body) as EtsyReceiptEvent);
    } catch {
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  } else {
    // No secret configured — process without verification (dev mode)
    const event = await req.json() as EtsyReceiptEvent;
    await handleEvent(event).catch(() => {});
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: EtsyReceiptEvent): Promise<void> {
  if (!Array.isArray(event.transactions)) return;

  for (const tx of event.transactions) {
    const listingId = String(tx.listing_id);
    const listing = await prisma.etsyListing.findUnique({ where: { etsyListingId: listingId } });
    if (!listing) continue;

    const amount = (tx.price.amount / tx.price.divisor) * tx.quantity;

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
    ]);

    void sendSaleAlert({
      productTitle: listing.title,
      platform: "Etsy",
      revenue: amount,
      buyerEmail: event.buyer_email,
      totalRevenue: listing.revenue + amount,
    }).catch(() => {});
  }
}
