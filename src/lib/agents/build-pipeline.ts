import { prisma } from "@/lib/db/prisma";
import { generateProductBlueprint } from "@/lib/ai/product-engine";
import { generateOptimizedListing, scoreListingQuality } from "@/lib/ai/listing-seo-engine";
import { generateProductPdf } from "@/lib/services/pdf-service";
import { generateProductCoverImage, generateProductMockups } from "@/lib/services/image-service";
import { publishProductToEtsy } from "@/lib/services/etsy-publish-service";
import { autoPromoteProduct } from "@/lib/promotions/auto-promote";
import type { Prisma } from "@prisma/client";
import type { BuildStatus } from "./agent-types";

const TOTAL_STAGES = 8; // blueprint, pdf, cover_image, seo_optimize, mockups, etsy_draft, publish, pinterest

const FAILED_STATUS: Record<string, BuildStatus> = {
  blueprinting: "failed_blueprinting",
  generating_pdf: "failed_generating_pdf",
  generating_cover: "failed_generating_cover",
  optimizing_seo: "failed_optimizing_seo",
  generating_mockups: "failed_generating_mockups",
  creating_listing: "failed_creating_listing",
  publishing: "failed_publishing",
};

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
    data: { buildStatus: "blueprinting", buildStartedAt: new Date() },
  });

  const completed: string[] = [];
  const failed: Array<{ stage: string; reason: string }> = [];

  function markDone(stage: string) { completed.push(stage); }
  function markFailed(stage: string, reason: string) { failed.push({ stage, reason }); }

  let currentStage: string = "blueprinting";

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
    console.log(`[build-pipeline] ✓ blueprint — ${product.title}`);

    // Stage 2: PDF (non-fatal)
    currentStage = "generating_pdf";
    await setBuildStatus(cardId, "generating_pdf");
    await generateProductPdf(product.id)
      .then(() => { markDone("pdf"); console.log(`[build-pipeline] ✓ pdf`); })
      .catch((err) => {
        console.error("[build-pipeline] PDF failed (non-fatal):", err instanceof Error ? err.message : err);
        markFailed("pdf", err instanceof Error ? err.message : "PDF generation failed");
      });

    // Stage 3: Cover image (non-fatal)
    currentStage = "generating_cover";
    await setBuildStatus(cardId, "generating_cover");
    await generateProductCoverImage(product.id)
      .then(() => { markDone("cover_image"); console.log(`[build-pipeline] ✓ cover_image`); })
      .catch((err) => {
        console.error("[build-pipeline] Cover image failed (non-fatal):", err instanceof Error ? err.message : err);
        markFailed("cover_image", err instanceof Error ? err.message : "Cover image failed");
      });

    // Stage 4: SEO optimize (non-fatal)
    currentStage = "optimizing_seo";
    await setBuildStatus(cardId, "optimizing_seo");
    await generateOptimizedListing(blueprint, [card.primaryKeyword])
      .then(async (optimized) => {
        let finalListing = optimized;
        const qualityScore = scoreListingQuality(optimized);
        if (qualityScore < 75) {
          const retry = await generateOptimizedListing(blueprint, [card.primaryKeyword]).catch(() => optimized);
          const retryScore = scoreListingQuality(retry);
          if (retryScore > qualityScore) finalListing = retry;
        }
        const finalScore = scoreListingQuality(finalListing);
        await prisma.product.update({
          where: { id: product.id },
          data: {
            optimizedListing: finalListing as unknown as Prisma.InputJsonValue,
            listingQualityScore: finalScore,
          },
        });
        markDone("seo_optimize");
        console.log(`[build-pipeline] ✓ seo_optimize — quality: ${finalScore}`);
      })
      .catch((err) => {
        console.error("[build-pipeline] SEO optimize failed (non-fatal):", err instanceof Error ? err.message : err);
        markFailed("seo_optimize", err instanceof Error ? err.message : "SEO failed");
      });

    // Stage 5: Mockups (non-fatal)
    currentStage = "generating_mockups";
    await setBuildStatus(cardId, "generating_mockups");
    await generateProductMockups(product.id)
      .then(() => { markDone("mockups"); console.log(`[build-pipeline] ✓ mockups`); })
      .catch((err) => {
        console.error("[build-pipeline] Mockups failed (non-fatal):", err instanceof Error ? err.message : err);
        markFailed("mockups", err instanceof Error ? err.message : "Mockups failed");
      });

    await setBuildStatus(cardId, "built");
    currentStage = "built";

    // Stage 6-7: Etsy publish (non-fatal — card saved as "built" if Etsy fails)
    const refreshed = await prisma.product.findUnique({ where: { id: product.id } });
    if (refreshed?.pdfPath && refreshed.coverImagePath) {
      currentStage = "creating_listing";
      await setBuildStatus(cardId, "creating_listing");
      await publishProductToEtsy(product.id)
        .then(async (etsyResult) => {
          currentStage = "publishing";
          await setBuildStatus(cardId, "publishing");
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
          console.log(`[build-pipeline] ✓ published — ${etsyResult.listingUrl}`);
        })
        .catch((err) => {
          console.error("[build-pipeline] Etsy publish failed:", err instanceof Error ? err.message : err);
          markFailed("etsy_draft", err instanceof Error ? err.message : "Etsy publish failed");
          markFailed("publish", "Publish to Etsy failed — publish manually from Products page");
        });
    } else {
      console.warn(`[build-pipeline] Skipping Etsy — pdfPath: ${refreshed?.pdfPath}, coverImagePath: ${refreshed?.coverImagePath}`);
      markFailed("etsy_draft", "PDF or cover image missing — publish manually from Products page");
      markFailed("publish", "Skipped — prerequisite assets missing");
    }

    // Stage 8: Pinterest (fire-and-forget)
    void autoPromoteProduct(product.id)
      .then(() => markDone("pinterest"))
      .catch((err) => {
        console.error("[build-pipeline] Pinterest failed (non-fatal):", err instanceof Error ? err.message : err);
        markFailed("pinterest", err instanceof Error ? err.message : "Pinterest pin failed");
      });

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
    console.error(`[build-pipeline] Fatal error at stage "${currentStage}":`, message);
    const failedStatus: BuildStatus = FAILED_STATUS[currentStage] ?? "failed";
    const completeness = Math.round((completed.length / TOTAL_STAGES) * 100);
    await prisma.launchCard.update({
      where: { id: cardId },
      data: {
        buildStatus: failedStatus,
        failureReason: message,
        buildCompleteness: completeness,
        stagesCompleted: completed as unknown as Prisma.InputJsonValue,
        stagesFailed: [...failed, { stage: currentStage, reason: message }] as unknown as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}
