import { prisma } from "@/lib/db/prisma";
import { pinterest } from "@/lib/integrations/pinterest";
import { generatePinterestPinPlan } from "@/lib/ai/pinterest-engine";
import { buildTrackedUrl } from "@/lib/tracking/utm";
import type { ProductBlueprint } from "@/lib/ai/product-engine";
import type { Prisma } from "@prisma/client";

function toBlueprint(product: {
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

export async function autoPromoteProduct(productId: string): Promise<void> {
  try {
    const [product, conn] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.pinterestConnection.findFirst(),
    ]);

    if (!product || !conn) return;

    const blueprint = toBlueprint(product);
    const plan = await generatePinterestPinPlan(
      blueprint,
      product.etsyListingUrl ?? undefined,
      product.gumroadUrl ?? undefined
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3090";
    const imageUrl = `${baseUrl}/product-images/${productId}.png`;
    const rawDestination = product.etsyListingUrl ?? product.gumroadUrl ?? baseUrl;
    const destinationUrl = buildTrackedUrl(rawDestination, {
      source: "pinterest",
      medium: "pin",
      campaign: productId,
    });

    const pinResponse = await pinterest.createPin(
      {
        boardId: conn.boardId,
        title: plan.primaryPin.title,
        description: plan.primaryPin.description,
        altText: plan.primaryPin.altText,
        destinationUrl,
        imageUrl,
      },
      conn.accessToken
    );

    await prisma.pinterestPin.create({
      data: {
        productId,
        pinId: pinResponse.id,
        pinUrl: pinResponse.link,
        boardId: conn.boardId,
        title: plan.primaryPin.title,
        description: plan.primaryPin.description,
        destinationUrl,
        imageUrl,
      },
    });
  } catch (err) {
    console.error("[auto-promote] Failed to auto-promote product", productId, err);
  }
}
