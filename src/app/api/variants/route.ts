import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateListingVariants } from "@/lib/ai/variant-engine";
import type { ProductBlueprint } from "@/lib/ai/product-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const CreateSchema = z.object({
  productId: z.string().min(1),
  platform: z.enum(["etsy", "gumroad"]),
  variantCount: z.number().min(2).max(4).optional().default(3),
});

const WinnerSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
});

const ImpressionsSchema = z.object({
  variantId: z.string().min(1),
  impressions: z.number().min(0),
  clicks: z.number().min(0).optional().default(0),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  try {
    const variants = await prisma.listingVariant.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: variants });
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
    const body = await req.json() as unknown;

    if (action === "create-variants") {
      const { productId, platform, variantCount } = CreateSchema.parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const blueprint = product as unknown as ProductBlueprint;

      const variants = await generateListingVariants(blueprint, variantCount);

      const saved = await Promise.all(
        variants.map((v, i) =>
          prisma.listingVariant.create({
            data: {
              productId,
              platform,
              variantLabel: v.variantLabel,
              title: v.title,
              description: v.description,
              tags: v.tags as unknown as Prisma.InputJsonValue,
              price: v.price,
              isControl: i === 0,
              isActive: true,
            },
          })
        )
      );

      return NextResponse.json({ success: true, data: saved });
    }

    if (action === "record-impression") {
      const { variantId, impressions, clicks } = ImpressionsSchema.parse(body);
      const updated = await prisma.listingVariant.update({
        where: { id: variantId },
        data: { impressions: { increment: impressions }, clicks: { increment: clicks } },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "declare-winner") {
      const { variantId, productId } = WinnerSchema.parse(body);
      await prisma.listingVariant.updateMany({
        where: { productId, isActive: true },
        data: { isActive: false },
      });
      await prisma.listingVariant.update({
        where: { id: variantId },
        data: { isControl: true, isActive: true },
      });
      return NextResponse.json({ success: true });
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
