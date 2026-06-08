import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildBrandArchitecture, generateBrandBible } from "@/lib/ai/brand-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, brandName: true, emotionalCategory: true, status: true, brandScore: true, estimatedMonthlyRevenue: true, createdAt: true },
    });
    return NextResponse.json({ success: true, data: brands });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

const BuildSchema = z.object({
  emotionalNiche: z.string().min(1),
  audienceArchetype: z.string().min(1),
  revenueTarget: z.string().min(1),
});

const BibleSchema = z.object({
  brand: z.object({
    brandName: z.string().min(1),
    positioning: z.object({
      uniqueValueProposition: z.string(),
      emotionalPromise: z.string(),
      brandPersonality: z.array(z.string()),
      brandVoice: z.string(),
      jungianArchetype: z.string(),
      categoryFrame: z.string(),
    }),
    audiencePsychology: z.object({
      coreDesires: z.array(z.string()),
      deepFears: z.array(z.string()),
      secretShame: z.string(),
      aspirationalIdentity: z.string(),
      currentPainState: z.string(),
      desiredTransformation: z.string(),
      buyingTriggers: z.array(z.string()),
      objections: z.array(z.string()),
      internalDialogue: z.string(),
    }),
    messagingFramework: z.object({
      masterHeadline: z.string(),
      subheadline: z.string(),
      origin: z.string(),
      emotionalBody: z.string(),
      proofPoints: z.array(z.string()),
      urgencyMechanisms: z.array(z.string()),
      identityShift: z.string(),
      closingStatement: z.string(),
    }),
  }),
});

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
    const action = searchParams.get("action") ?? "build";

    if (action === "bible") {
      const { brand } = BibleSchema.parse(body);
      const result = await generateBrandBible(brand);
      return NextResponse.json({ success: true, data: result });
    }

    const { emotionalNiche, audienceArchetype, revenueTarget } = BuildSchema.parse(body);
    const brand = await buildBrandArchitecture(emotionalNiche, audienceArchetype, revenueTarget);

    await prisma.brand.create({
      data: {
        id: brand.id,
        brandName: brand.brandName,
        tagline: brand.tagline,
        emotionalCategory: brand.emotionalCategory,
        targetEmotion: brand.targetEmotion,
        audienceArchetype: brand.audienceArchetype,
        jungianArchetype: brand.positioning.jungianArchetype,
        categoryFrame: brand.positioning.categoryFrame,
        uniqueValueProposition: brand.positioning.uniqueValueProposition,
        emotionalPromise: brand.positioning.emotionalPromise,
        brandPersonality: toJson(brand.positioning.brandPersonality),
        brandVoice: brand.positioning.brandVoice,
        brandScore: brand.brandScore,
        defensibilityScore: brand.defensibilityScore,
        estimatedMonthlyRevenue: brand.estimatedMonthlyRevenue,
        competitiveMoat: brand.competitiveMoat,
        positioning: toJson(brand.positioning),
        audiencePsychology: toJson(brand.audiencePsychology),
        offerStack: toJson(brand.offerStack),
        productLadder: toJson(brand.productLadder),
        messagingFramework: toJson(brand.messagingFramework),
        funnelMap: toJson(brand.funnelMap),
        contentStrategy: toJson(brand.contentStrategy),
        visualIdentity: toJson(brand.visualIdentity),
        launchRoadmap: toJson(brand.launchRoadmap),
        revenueProjection: toJson(brand.revenueProjection),
        keywords: brand.keywords,
      },
    });

    return NextResponse.json({ success: true, data: brand });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    console.error("Brands API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
