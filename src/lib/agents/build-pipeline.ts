import { prisma } from "@/lib/db/prisma";
import { generateProductBlueprint } from "@/lib/ai/product-engine";
import { generateOptimizedListing, scoreListingQuality } from "@/lib/ai/listing-seo-engine";
import { generateProductPdf } from "@/lib/services/pdf-service";
import { generateProductCoverImage, generateProductMockups } from "@/lib/services/image-service";
import { publishProductToEtsy } from "@/lib/services/etsy-publish-service";
import { autoPromoteProduct } from "@/lib/promotions/auto-promote";
import type { Prisma } from "@prisma/client";
import type { BuildStatus } from "./agent-types";

const TOTAL_STAGES = 8;

const STAGE_ACTIVE_STATUS: Record<string, BuildStatus> = {
  blueprint:    "blueprinting",
  pdf:          "generating_pdf",
  cover_image:  "generating_cover",
  seo:          "optimizing_seo",
  mockups:      "generating_mockups",
  etsy_publish: "creating_listing",
};

const STAGE_FAILED_STATUS: Record<string, BuildStatus> = {
  blueprint:    "failed_blueprinting",
  pdf:          "failed_generating_pdf",
  cover_image:  "failed_generating_cover",
  seo:          "failed_optimizing_seo",
  mockups:      "failed_generating_mockups",
  etsy_publish: "failed_creating_listing",
};

async function setBuildStatus(cardId: string, status: BuildStatus, note?: string) {
  await prisma.launchCard.update({
    where: { id: cardId },
    data: { buildStatus: status, ...(note ? { failureReason: note } : {}) },
  });
}

// ── runStage: universal stage runner ────────────────────────────────────────
// Required: throws on failure → pipeline aborts.
// Optional: returns { success: false } on failure → pipeline continues.

type StageSuccess<T> = { success: true; result: T };
type StageFail = { success: false; skipped: true; error: string };
type StageOutcome<T> = StageSuccess<T> | StageFail;

async function runStage<T>(
  cardId: string,
  stageName: string,
  isRequired: boolean,
  timeoutMs: number,
  fn: () => Promise<T>
): Promise<StageOutcome<T>> {
  const activeStatus = STAGE_ACTIVE_STATUS[stageName];
  if (activeStatus) await setBuildStatus(cardId, activeStatus);
  console.log(`[pipeline] Starting stage: ${stageName}`);

  try {
    const result = await Promise.race<T>([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${stageName} timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
    console.log(`[pipeline] ✓ ${stageName}`);
    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Stage ${stageName} failed: ${message}`);

    if (isRequired) {
      const failedStatus = STAGE_FAILED_STATUS[stageName] ?? "failed";
      await setBuildStatus(cardId, failedStatus as BuildStatus, message);
      throw new Error(`Required stage ${stageName} failed: ${message}`);
    }

    console.warn(`[pipeline] Optional stage ${stageName} skipped — continuing pipeline`);
    return { success: false, skipped: true, error: message };
  }
}

// ── Main pipeline ────────────────────────────────────────────────────────────

export async function runBuildPipeline(cardId: string): Promise<void> {
  const card = await prisma.launchCard.findUniqueOrThrow({ where: { id: cardId } });

  await prisma.launchCard.update({
    where: { id: cardId },
    data: { buildStatus: "blueprinting", buildStartedAt: new Date() },
  });

  const completed: string[] = [];
  const failedStages: Array<{ stage: string; reason: string }> = [];

  // Shared state across stages (set in blueprint, used in seo)
  let productId = "";
  let savedBlueprint: Awaited<ReturnType<typeof generateProductBlueprint>> | null = null;

  try {
    // ── Stage 1: Blueprint (required, 60s) ─────────────────────────────────
    const bpOutcome = await runStage(
      cardId, "blueprint", true, 60_000,
      async () => {
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
            keywords: [card.primaryKeyword, ...blueprint.keywords.slice(0, 12)] as unknown as Prisma.InputJsonValue,
            descriptionShort: blueprint.descriptionShort,
            descriptionLong: blueprint.descriptionLong,
            status: "draft",
            launchCardId: cardId,
          },
        });
        await prisma.launchCard.update({ where: { id: cardId }, data: { productId: product.id } });
        console.log(`[build-pipeline] ✓ blueprint — ${product.title}`);
        return { productId: product.id, blueprint };
      }
    );
    // Required — if failed it threw. Safe to access result.
    if (!bpOutcome.success) throw new Error("unreachable");
    productId = bpOutcome.result.productId;
    savedBlueprint = bpOutcome.result.blueprint;
    completed.push("blueprint");

    // ── Stage 2: PDF (required, 120s) ──────────────────────────────────────
    const pdfOutcome = await runStage<void>(
      cardId, "pdf", true, 120_000,
      async () => { await generateProductPdf(productId); }
    );
    if (pdfOutcome.success) completed.push("pdf");

    // ── Stage 3: Cover image (optional, 30s) ───────────────────────────────
    const coverOutcome = await runStage<{ path: string } | null>(
      cardId, "cover_image", false, 30_000,
      async () => {
        try {
          return await generateProductCoverImage(productId);
        } catch (err) {
          console.log("[pipeline] Cover image skipped —", err instanceof Error ? err.message : "DALL-E unavailable");
          return null;
        }
      }
    );
    if (coverOutcome.success && coverOutcome.result) {
      completed.push("cover_image");
    } else if (!coverOutcome.success) {
      failedStages.push({ stage: "cover_image", reason: coverOutcome.error });
    }

    // ── Stage 4: SEO optimize (required, 30s) ──────────────────────────────
    const seoOutcome = await runStage<number>(
      cardId, "seo", true, 30_000,
      async () => {
        // Use blueprint from Stage 1; guaranteed non-null since blueprint is required
        const bp = savedBlueprint!;
        let finalListing = await generateOptimizedListing(bp, [card.primaryKeyword]);
        const qualityScore = scoreListingQuality(finalListing);
        if (qualityScore < 75) {
          const retry = await generateOptimizedListing(bp, [card.primaryKeyword]).catch(() => finalListing);
          if (scoreListingQuality(retry) > qualityScore) finalListing = retry;
        }
        const finalScore = scoreListingQuality(finalListing);
        await prisma.product.update({
          where: { id: productId },
          data: {
            optimizedListing: finalListing as unknown as Prisma.InputJsonValue,
            listingQualityScore: finalScore,
          },
        });
        console.log(`[build-pipeline] ✓ seo_optimize — quality: ${finalScore}`);
        return finalScore;
      }
    );
    if (seoOutcome.success) completed.push("seo_optimize");

    // ── Stage 5: Mockups (optional, 20s) ───────────────────────────────────
    const mockupOutcome = await runStage<{ paths: string[] } | null>(
      cardId, "mockups", false, 20_000,
      async () => {
        try {
          return await generateProductMockups(productId);
        } catch {
          console.log("[pipeline] Mockups skipped — DALL-E unavailable");
          return null;
        }
      }
    );
    if (mockupOutcome.success && mockupOutcome.result && mockupOutcome.result.paths.length > 0) {
      completed.push("mockups");
    } else if (!mockupOutcome.success) {
      failedStages.push({ stage: "mockups", reason: mockupOutcome.error });
    }

    // Mark built before Etsy — product is complete regardless of publish outcome
    await setBuildStatus(cardId, "built");

    // ── Stage 6: Etsy publish (required, 60s) ──────────────────────────────
    const etsyOutcome = await runStage(
      cardId, "etsy_publish", true, 60_000,
      async () => publishProductToEtsy(productId)
    );
    if (!etsyOutcome.success) throw new Error("unreachable");

    await setBuildStatus(cardId, "publishing");
    await prisma.launchCard.update({
      where: { id: cardId },
      data: {
        etsyListingId: etsyOutcome.result.listingId,
        buildStatus: "published",
        publishedAt: new Date(),
      },
    });
    completed.push("etsy_draft");
    completed.push("publish");
    console.log(`[build-pipeline] ✓ published — ${etsyOutcome.result.listingUrl}`);

    // ── Stage 7: Pinterest (optional, fire-and-forget) ─────────────────────
    void runStage<void>(cardId, "pinterest", false, 30_000, () => autoPromoteProduct(productId))
      .then((r) => {
        if (r.success) completed.push("pinterest");
        else failedStages.push({ stage: "pinterest", reason: r.error });
      })
      .catch(() => {});

    // ── Finalize ────────────────────────────────────────────────────────────
    const completeness = Math.round((completed.length / TOTAL_STAGES) * 100);
    await prisma.launchCard.update({
      where: { id: cardId },
      data: {
        buildStatus: "published",
        buildCompletedAt: new Date(),
        publishedAt: new Date(),
        buildCompleteness: completeness,
        stagesCompleted: completed as unknown as Prisma.InputJsonValue,
        stagesFailed: failedStages as unknown as Prisma.InputJsonValue,
      },
    });

  } catch (err) {
    // Required stage already set its failed_* status. Just save summary.
    const message = err instanceof Error ? err.message : "Build pipeline failed";
    console.error(`[build-pipeline] Fatal error:`, message);
    const completeness = Math.round((completed.length / TOTAL_STAGES) * 100);
    await prisma.launchCard.update({
      where: { id: cardId },
      data: {
        buildCompleteness: completeness,
        stagesCompleted: completed as unknown as Prisma.InputJsonValue,
        stagesFailed: [
          ...failedStages,
          { stage: "pipeline", reason: message },
        ] as unknown as Prisma.InputJsonValue,
      },
    }).catch(() => {});
    throw err;
  }
}
