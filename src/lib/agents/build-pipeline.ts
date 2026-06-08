import { prisma } from "@/lib/db/prisma";
import { generateProductBlueprint } from "@/lib/ai/product-engine";
import { generateOptimizedListing } from "@/lib/ai/listing-seo-engine";
import { generateProductPdf } from "@/lib/services/pdf-service";
import { generateProductCoverImage, generateProductMockups } from "@/lib/services/image-service";
import { publishProductToEtsy } from "@/lib/services/etsy-publish-service";
import { autoPromoteProduct } from "@/lib/promotions/auto-promote";
import type { Prisma } from "@prisma/client";
import type { BuildStatus } from "./agent-types";

const TOTAL_STAGES = 8; // blueprint, pdf, cover_image, seo_optimize, mockups, etsy_draft, publish, pinterest

async function setBuildStatus(cardId: string, status: BuildStatus, note?: string) {
  await prisma.launchCard.update({
    where: { id: cardId },
    data: { buildStatus: status, ...(note ? { failureReason: note } : {}) },
  });
}

export async function runBuildPipeline(cardId: string): Promise<void> {
  const card = await prisma.launchCard.findUniqueOrThrow({ where: { id: cardId } });

  await prisma.launchCard.update({
    where: { id: cardId },
    data: { buildStatus: "building", buildStartedAt: new Date() },
  });

  const completed: string[] = [];
  const failed: Array<{ stage: string; reason: string }> = [];

  function markDone(stage: string) { completed.push(stage); }
  function markFailed(stage: string, reason: string) { failed.push({ stage, reason }); }

  try {
    // Stage 1: Blueprint (fatal — no product = nothing to build)
    const blueprint = await generateProductBlueprint(
      card.emotionalHook,
      card.productFormat as Parameters<typeof generateProductBlueprint>[1],
      card.targetAudience
    );

    const product = await prisma.product.create({
      data: {
        title: card.productTitle,
        subtitle: blueprint.subtitle,
        tagline: blueprint.tagline,
        type: card.productFormat,
        targetEmotion: card.emotionalHook,
        targetAudience: card.targetAudience,
        audienceArchetype: blueprint.audienceArchetype,
        pageCount: blueprint.pageCount,
        sections: blueprint.sections as unknown as Prisma.InputJsonValue,
        psychologicalFramework: blueprint.psychologicalFramework,
        transformationPromise: blueprint.transformationPromise,
        emotionalHooks: blueprint.emotionalHooks as unknown as Prisma.InputJsonValue,
        coverConcept: blueprint.coverConcept as unknown as Prisma.InputJsonValue,
        marketingAngles: blueprint.marketingAngles as unknown as Prisma.InputJsonValue,
        pricingStrategy: { ...blueprint.pricingStrategy, digitalPrice: card.suggestedPrice } as unknown as Prisma.InputJsonValue,
        platforms: blueprint.platforms as unknown as Prisma.InputJsonValue,
        estimatedMonthlyRevenue: blueprint.estimatedMonthlyRevenue,
        competitiveAdvantage: blueprint.competitiveAdvantage,
        keywords: ([card.primaryKeyword, ...blueprint.keywords.slice(0, 12)] as unknown as Prisma.InputJsonValue),
        descriptionShort: blueprint.descriptionShort,
        descriptionLong: blueprint.descriptionLong,
        status: "draft",
        launchCardId: cardId,
      },
    });

    await prisma.launchCard.update({ where: { id: cardId }, data: { productId: product.id } });
    markDone("blueprint");

    // Stage 2: PDF (non-fatal)
    await generateProductPdf(product.id)
      .then(() => markDone("pdf"))
      .catch((err) => {
        console.error("[build-pipeline] PDF failed (non-fatal):", err);
        markFailed("pdf", err instanceof Error ? err.message : "PDF generation failed");
      });

    // Stage 3: Cover image (non-fatal)
    await generateProductCoverImage(product.id)
      .then(() => markDone("cover_image"))
      .catch((err) => {
        console.error("[build-pipeline] Cover image failed (non-fatal):", err);
        markFailed("cover_image", err instanceof Error ? err.message : "Cover image failed");
      });

    // Stage 4: SEO optimize (non-fatal)
    await generateOptimizedListing(blueprint, [card.primaryKeyword])
      .then(async (optimized) => {
        await prisma.product.update({
          where: { id: product.id },
          data: { optimizedListing: optimized as unknown as Prisma.InputJsonValue },
        });
        markDone("seo_optimize");
      })
      .catch((err) => {
        console.error("[build-pipeline] SEO optimize failed (non-fatal):", err);
        markFailed("seo_optimize", err instanceof Error ? err.message : "SEO failed");
      });

    // Stage 5: Mockups (non-fatal)
    await generateProductMockups(product.id)
      .then(() => markDone("mockups"))
      .catch((err) => {
        console.error("[build-pipeline] Mockups failed (non-fatal):", err);
        markFailed("mockups", err instanceof Error ? err.message : "Mockups failed");
      });

    await setBuildStatus(cardId, "built");

    // Stage 6: Etsy publish (non-fatal — saved as "built" not "published")
    const refreshed = await prisma.product.findUnique({ where: { id: product.id } });
    if (refreshed?.pdfPath && refreshed.coverImagePath) {
      await publishProductToEtsy(product.id)
        .then(async (etsyResult) => {
          await prisma.launchCard.update({
            where: { id: cardId },
            data: {
              etsyListingId: etsyResult.listingId,
              buildStatus: "published",
              publishedAt: new Date(),
            },
          });
          markDone("etsy_draft");
          markDone("publish");
        })
        .catch((err) => {
          console.error("[build-pipeline] Etsy publish failed:", err);
          markFailed("etsy_draft", err instanceof Error ? err.message : "Etsy publish failed");
          markFailed("publish", "Publish to Etsy failed — publish manually from Products page");
        });
    } else {
      markFailed("etsy_draft", "PDF or cover image missing — publish manually from Products page");
      markFailed("publish", "Skipped — prerequisite assets missing");
    }

    // Stage 7: Pinterest (non-fatal)
    void autoPromoteProduct(product.id)
      .then(() => markDone("pinterest"))
      .catch((err) => {
        console.error("[build-pipeline] Pinterest failed (non-fatal):", err);
        markFailed("pinterest", err instanceof Error ? err.message : "Pinterest pin failed");
      });

    // Write final completeness
    const completeness = Math.round((completed.length / TOTAL_STAGES) * 100);
    const isPublished = completed.includes("publish");

    await prisma.launchCard.update({
      where: { id: cardId },
      data: {
        buildStatus: isPublished ? "published" : "built",
        buildCompletedAt: new Date(),
        publishedAt: isPublished ? new Date() : null,
        buildCompleteness: completeness,
        stagesCompleted: completed as unknown as Prisma.InputJsonValue,
        stagesFailed: failed as unknown as Prisma.InputJsonValue,
      },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Build pipeline failed";
    const completeness = Math.round((completed.length / TOTAL_STAGES) * 100);
    await prisma.launchCard.update({
      where: { id: cardId },
      data: {
        buildStatus: "failed",
        failureReason: message,
        buildCompleteness: completeness,
        stagesCompleted: completed as unknown as Prisma.InputJsonValue,
        stagesFailed: [...failed, { stage: "fatal", reason: message }] as unknown as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}
