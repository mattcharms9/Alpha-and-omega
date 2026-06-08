import { NextRequest, NextResponse } from "next/server";
import { generateProductBlueprint, generateProductVariants, ProductType } from "@/lib/ai/product-engine";
import { generateBatchPlan } from "@/lib/ai/mix-engine";
import { repositionProduct } from "@/lib/ai/reposition-engine";
import { generateOptimizedListing } from "@/lib/ai/listing-seo-engine";
import { generateKDPMetadata } from "@/lib/ai/kdp-engine";
import { findBundleOpportunities } from "@/lib/ai/bundle-engine";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}

const GenerateSchema = z.object({
  emotionalFocus: z.string().min(1),
  productType: z.enum(["journal", "planner", "workbook", "digital-system", "hybrid"]),
  audienceArchetype: z.string().min(1),
  activeSavedNicheId: z.string().optional(),
});

const VariantsSchema = z.object({
  blueprint: z.record(z.string(), z.unknown()),
  variantCount: z.number().min(1).max(6).optional().default(3),
});

const RepositionSchema = z.object({
  productId: z.string().min(1),
  count: z.number().min(1).max(12).optional().default(8),
});

const BatchPlanSchema = z.object({
  emotionalTheme: z.string().min(1),
  targetAudience: z.string().min(1),
  batchSize: z.number().min(1).max(10).optional().default(5),
  customMix: z.array(z.enum(["journal", "planner", "workbook", "mini_guide", "bundle"])).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "bundle-opportunities") {
      const bundles = await findBundleOpportunities();
      return NextResponse.json({ success: true, data: bundles });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const status = searchParams.get("status");
    const products = await prisma.product.findMany({
      where: status ? { status } : { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "generate";

    if (action === "reposition") {
      const { productId, count } = RepositionSchema.parse(body);
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      const { buildBlueprintFromProduct } = await import("@/lib/pdf/build-blueprint");
      const blueprint = buildBlueprintFromProduct(product);
      const report = await repositionProduct(blueprint, count);
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "variants") {
      const { blueprint, variantCount } = VariantsSchema.parse(body);
      const result = await generateProductVariants(blueprint as unknown as Parameters<typeof generateProductVariants>[0], variantCount);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "batch-plan") {
      const { emotionalTheme, targetAudience, batchSize, customMix } = BatchPlanSchema.parse(body);
      const plan = await generateBatchPlan(emotionalTheme, targetAudience, batchSize, customMix);
      return NextResponse.json({ success: true, data: plan });
    }

    if (action === "optimize-listing") {
      const { productId } = z.object({ productId: z.string().min(1) }).parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const { buildBlueprintFromProduct } = await import("@/lib/pdf/build-blueprint");
      const blueprint = buildBlueprintFromProduct(product);
      const optimized = await generateOptimizedListing(blueprint, (product.keywords as string[]).slice(0, 5));
      await prisma.product.update({ where: { id: productId }, data: { optimizedListing: optimized as unknown as Prisma.InputJsonValue } });
      return NextResponse.json({ success: true, data: optimized });
    }

    if (action === "optimize-price") {
      const { productId } = z.object({ productId: z.string().min(1) }).parse(body);
      const { optimizeProductPrice } = await import("@/lib/ai/price-optimizer");
      const report = await optimizeProductPrice(productId);
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "kdp-prep") {
      const { productId } = z.object({ productId: z.string().min(1) }).parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const { buildBlueprintFromProduct } = await import("@/lib/pdf/build-blueprint");
      const blueprint = buildBlueprintFromProduct(product);
      const kdpMeta = await generateKDPMetadata(blueprint);
      return NextResponse.json({ success: true, data: kdpMeta });
    }

    const { emotionalFocus, productType, audienceArchetype, activeSavedNicheId } = GenerateSchema.parse(body);
    const blueprint = await generateProductBlueprint(emotionalFocus, productType as ProductType, audienceArchetype);

    const saved = await prisma.product.create({
      data: {
        title: blueprint.title,
        subtitle: blueprint.subtitle,
        tagline: blueprint.tagline,
        type: blueprint.type,
        targetEmotion: blueprint.targetEmotion,
        targetAudience: blueprint.targetAudience,
        audienceArchetype: blueprint.audienceArchetype,
        pageCount: blueprint.pageCount,
        sections: toJson(blueprint.sections),
        psychologicalFramework: blueprint.psychologicalFramework,
        transformationPromise: blueprint.transformationPromise,
        emotionalHooks: blueprint.emotionalHooks,
        coverConcept: toJson(blueprint.coverConcept),
        marketingAngles: blueprint.marketingAngles,
        pricingStrategy: toJson(blueprint.pricingStrategy),
        platforms: blueprint.platforms,
        estimatedMonthlyRevenue: blueprint.estimatedMonthlyRevenue,
        competitiveAdvantage: blueprint.competitiveAdvantage,
        keywords: blueprint.keywords,
        descriptionShort: blueprint.descriptionShort,
        descriptionLong: blueprint.descriptionLong,
        status: "draft",
        ...(activeSavedNicheId ? { nicheId: activeSavedNicheId } : {}),
      },
    });

    if (activeSavedNicheId) {
      await prisma.nicheResearch.update({
        where: { id: activeSavedNicheId },
        data: { productsGenerated: { increment: 1 }, lastUsedAt: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: { ...blueprint, savedId: saved.id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    console.error("Products API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
