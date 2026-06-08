import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { sendSaleAlert, addBuyerToAudience } from "@/lib/notifications/email";
import { parseUtmFromUrl } from "@/lib/tracking/utm";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const secret = process.env.GUMROAD_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers.get("x-gumroad-signature");
      const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
      if (!signature || signature !== computed) {
        console.error("[Gumroad Webhook] Invalid signature — request rejected");
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    }
    const body = new URLSearchParams(rawBody);

    const productId = body.get("product_id") as string | null;
    const productName = body.get("product_name") as string | null;
    const price = Number(body.get("price") ?? 0);
    const quantity = Number(body.get("quantity") ?? 1);
    const resourceName = body.get("resource_name") as string | null;
    const referrerUrl = body.get("referrer_url") as string | null;
    const buyerEmail = body.get("email") as string | null;
    const buyerName = body.get("full_name") as string | null;
    const utmParams = parseUtmFromUrl(referrerUrl);

    if (resourceName !== "sale") {
      return NextResponse.json({ success: true, skipped: true });
    }

    const localProduct = productId
      ? await prisma.product.findFirst({ where: { gumroadProductId: productId } })
      : null;

    await prisma.revenueRecord.create({
      data: {
        date: new Date(),
        platform: "gumroad",
        productId: localProduct?.id ?? null,
        revenue: price / 100,
        sales: quantity,
        source: "gumroad_webhook",
        utmSource: utmParams.source ?? null,
        utmMedium: utmParams.medium ?? null,
        utmCampaign: utmParams.campaign ?? null,
        utmContent: utmParams.content ?? null,
      },
    });

    if (buyerEmail) {
      void addBuyerToAudience({
        email: buyerEmail,
        firstName: buyerName?.split(" ")[0],
        productTitle: productName ?? "Unknown product",
        platform: "gumroad",
      }).catch((err: unknown) => console.error("[buyer-list] Failed to add to audience:", err));
    }

    if (localProduct) {
      const updated = await prisma.product.update({
        where: { id: localProduct.id },
        data: {
          totalRevenue: { increment: price / 100 },
          totalSales: { increment: quantity },
        },
      });

      await prisma.strategicAlert.create({
        data: {
          type: "sale",
          title: `Sale: ${productName ?? localProduct.title}`,
          body: `$${(price / 100).toFixed(2)} on Gumroad`,
          actionLabel: "View Product",
          actionHref: `/products`,
        },
      });

      await sendSaleAlert({
        productTitle: productName ?? localProduct.title,
        revenue: price / 100,
        platform: "gumroad",
        totalRevenue: updated.totalRevenue,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
