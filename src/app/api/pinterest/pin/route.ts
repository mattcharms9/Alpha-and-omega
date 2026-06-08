import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pinterest } from "@/lib/integrations/pinterest";
import { generatePinterestPinPlan } from "@/lib/ai/pinterest-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { ProductBlueprint } from "@/lib/ai/product-engine";
import type { Prisma } from "@prisma/client";

const CreateSchema = z.object({
  productId: z.string().min(1),
  useVariant: z.boolean().optional().default(false),
});

const QueueSchema = z.object({
  productId: z.string().min(1),
  scheduledFor: z.string().datetime(),
  useVariant: z.boolean().optional().default(false),
});

function productToBlueprint(product: {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  type: string;
  targetEmotion: string;
  targetAudience: string;
  audienceArchetype: string;
  pageCount: number;
  sections: Prisma.JsonValue;
  psychologicalFramework: string;
  transformationPromise: string;
  emotionalHooks: Prisma.JsonValue;
  coverConcept: Prisma.JsonValue;
  marketingAngles: Prisma.JsonValue;
  pricingStrategy: Prisma.JsonValue;
  platforms: Prisma.JsonValue;
  estimatedMonthlyRevenue: string;
  competitiveAdvantage: string;
  keywords: Prisma.JsonValue;
  descriptionShort: string;
  descriptionLong: string;
}): ProductBlueprint {
  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle,
    tagline: product.tagline,
    type: product.type as ProductBlueprint["type"],
    targetEmotion: product.targetEmotion,
    targetAudience: product.targetAudience,
    audienceArchetype: product.audienceArchetype,
    pageCount: product.pageCount,
    sections: product.sections as unknown as ProductBlueprint["sections"],
    psychologicalFramework: product.psychologicalFramework,
    transformationPromise: product.transformationPromise,
    emotionalHooks: product.emotionalHooks as unknown as string[],
    coverConcept: product.coverConcept as unknown as ProductBlueprint["coverConcept"],
    marketingAngles: product.marketingAngles as unknown as string[],
    pricingStrategy: product.pricingStrategy as unknown as ProductBlueprint["pricingStrategy"],
    platforms: product.platforms as unknown as string[],
    estimatedMonthlyRevenue: product.estimatedMonthlyRevenue,
    competitiveAdvantage: product.competitiveAdvantage,
    keywords: product.keywords as unknown as string[],
    descriptionShort: product.descriptionShort,
    descriptionLong: product.descriptionLong,
  };
}

async function createAndSavePin(productId: string, useVariant: boolean) {
  const [product, conn] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { id: productId } }),
    prisma.pinterestConnection.findFirst(),
  ]);

  if (!conn) throw new Error("Pinterest not connected");

  const blueprint = productToBlueprint(product);
  const plan = await generatePinterestPinPlan(
    blueprint,
    product.etsyListingUrl ?? undefined,
    product.gumroadUrl ?? undefined
  );

  const pinContent = useVariant ? plan.variant : plan.primaryPin;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3090";
  const imageUrl = `${baseUrl}/product-images/${productId}.png`;
  const destinationUrl = product.etsyListingUrl ?? product.gumroadUrl ?? baseUrl;

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

  const saved = await prisma.pinterestPin.create({
    data: {
      productId,
      pinId: pinResponse.id,
      pinUrl: pinResponse.link,
      boardId: conn.boardId,
      title: pinContent.title,
      description: pinContent.description,
      destinationUrl,
      imageUrl,
    },
  });

  return { pin: saved, plan };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const body = await req.json() as unknown;

    if (action === "create") {
      const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
      if (!rl.success) {
        return NextResponse.json(
          { success: false, error: "Too many requests." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
      }

      const { productId, useVariant } = CreateSchema.parse(body);
      const result = await createAndSavePin(productId, useVariant);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "auto-pin") {
      const { productId, useVariant } = CreateSchema.parse(body);
      const result = await createAndSavePin(productId, useVariant);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "queue") {
      const { productId, scheduledFor, useVariant } = QueueSchema.parse(body);
      const [product, conn] = await Promise.all([
        prisma.product.findUniqueOrThrow({ where: { id: productId } }),
        prisma.pinterestConnection.findFirst(),
      ]);

      if (!conn) throw new Error("Pinterest not connected");

      const blueprint = productToBlueprint(product);
      const plan = await generatePinterestPinPlan(
        blueprint,
        product.etsyListingUrl ?? undefined,
        product.gumroadUrl ?? undefined
      );
      const pinContent = useVariant ? plan.variant : plan.primaryPin;

      const queued = await prisma.pinQueue.create({
        data: {
          productId,
          pinContent: pinContent as unknown as Prisma.InputJsonValue,
          scheduledFor: new Date(scheduledFor),
          platform: "pinterest",
        },
      });

      return NextResponse.json({ success: true, data: queued });
    }

    if (action === "sync-analytics") {
      const conn = await prisma.pinterestConnection.findFirst();
      if (!conn) throw new Error("Pinterest not connected");

      const pins = await prisma.pinterestPin.findMany();

      const results = await Promise.allSettled(
        pins.map(async (pin) => {
          const analytics = await pinterest.getPinAnalytics(pin.pinId, conn.accessToken);
          return prisma.pinterestPin.update({
            where: { id: pin.id },
            data: {
              impressions: analytics.metrics.IMPRESSION,
              saves: analytics.metrics.SAVE,
              clicks: analytics.metrics.PIN_CLICK,
            },
          });
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      return NextResponse.json({ success: true, data: { synced: succeeded, failed } });
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
