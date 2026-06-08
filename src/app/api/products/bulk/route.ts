import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { gumroad } from "@/lib/integrations/gumroad";
import { autoPromoteProduct } from "@/lib/promotions/auto-promote";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const BulkSchema = z.object({
  action: z.enum(["publish-gumroad", "pin-pinterest"]),
  productIds: z.array(z.string().min(1)).min(1).max(20),
});

async function publishToGumroad(productId: string): Promise<{ productId: string; ok: boolean; error?: string }> {
  try {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const pricing = product.pricingStrategy as { digitalPrice?: number } | null;
    const priceInCents = Math.round((pricing?.digitalPrice ?? 7) * 100);

    if (!product.gumroadProductId) {
      const result = await gumroad.createProduct({
        name: product.title,
        description: `${product.descriptionLong}\n\n${product.tagline}`,
        price: priceInCents,
        published: false,
        tags: Array.isArray(product.keywords) ? (product.keywords as string[]).slice(0, 10) : [],
      });
      await prisma.product.update({
        where: { id: productId },
        data: { gumroadProductId: result.product.id, gumroadUrl: result.product.short_url },
      });
    }

    const fresh = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    await gumroad.enableProduct(fresh.gumroadProductId!);
    await prisma.product.update({ where: { id: productId }, data: { status: "active" } });

    return { productId, ok: true };
  } catch (err) {
    return { productId, ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function pinToPinterest(productId: string): Promise<{ productId: string; ok: boolean; error?: string }> {
  try {
    await autoPromoteProduct(productId);
    return { productId, ok: true };
  } catch (err) {
    return { productId, ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { action, productIds } = BulkSchema.parse(body);

    const results = await Promise.allSettled(
      productIds.map((id) =>
        action === "publish-gumroad" ? publishToGumroad(id) : pinToPinterest(id)
      )
    );

    const data = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { productId: "unknown", ok: false, error: "Task threw unexpectedly" }
    );

    const succeeded = data.filter((r) => r.ok).length;
    const failed = data.filter((r) => !r.ok).length;

    return NextResponse.json({ success: true, data: { results: data, succeeded, failed } });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
