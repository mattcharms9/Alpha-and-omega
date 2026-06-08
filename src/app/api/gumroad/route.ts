import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { gumroad } from "@/lib/integrations/gumroad";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { autoPromoteProduct } from "@/lib/promotions/auto-promote";

const CreateSchema = z.object({ productId: z.string().min(1) });
const ActionSchema = z.object({ productId: z.string().min(1) });

export async function GET() {
  try {
    const [local, remote] = await Promise.all([
      prisma.product.findMany({
        where: { gumroadProductId: { not: null } },
        select: { id: true, title: true, gumroadProductId: true, gumroadUrl: true, totalRevenue: true, totalSales: true, status: true },
      }),
      gumroad.getProducts().catch(() => ({ products: [] })),
    ]);

    return NextResponse.json({ success: true, data: { local, remote: remote.products } });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const body = await req.json();

    if (action === "create") {
      const { productId } = CreateSchema.parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

      const result = await gumroad.createProduct({
        name: product.title,
        description: `${product.descriptionLong}\n\n${product.tagline}`,
        price: 700,
        published: false,
        tags: Array.isArray(product.keywords) ? (product.keywords as string[]).slice(0, 10) : [],
      });

      await prisma.product.update({
        where: { id: productId },
        data: { gumroadProductId: result.product.id, gumroadUrl: result.product.short_url },
      });

      return NextResponse.json({ success: true, data: result.product });
    }

    if (action === "publish") {
      const { productId } = ActionSchema.parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      if (!product.pdfPath) {
        return NextResponse.json({ success: false, error: "Generate a PDF before publishing. Products without a file cannot be sold.", code: "NO_PDF" }, { status: 422 });
      }
      if (!product.gumroadProductId) throw new Error("Product not yet created on Gumroad");

      const result = await gumroad.enableProduct(product.gumroadProductId);
      await prisma.product.update({ where: { id: productId }, data: { status: "active" } });
      void autoPromoteProduct(productId);
      return NextResponse.json({ success: true, data: result.product });
    }

    if (action === "unpublish") {
      const { productId } = ActionSchema.parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      if (!product.gumroadProductId) throw new Error("Product not yet created on Gumroad");

      const result = await gumroad.disableProduct(product.gumroadProductId);
      await prisma.product.update({ where: { id: productId }, data: { status: "draft" } });
      return NextResponse.json({ success: true, data: result.product });
    }

    if (action === "sync") {
      const { productId } = ActionSchema.parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      if (!product.gumroadProductId) throw new Error("Product not yet created on Gumroad");

      const salesData = await gumroad.getSales(product.gumroadProductId);

      const records = await Promise.all(
        salesData.sales.map((sale) =>
          prisma.revenueRecord.create({
            data: {
              date: new Date(sale.created_at),
              platform: "gumroad",
              productId,
              revenue: sale.price / 100,
              sales: sale.quantity,
              source: "webhook_sync",
            },
          })
        )
      );

      return NextResponse.json({ success: true, data: { synced: records.length } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
