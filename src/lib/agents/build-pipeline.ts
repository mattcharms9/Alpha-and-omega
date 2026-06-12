import { prisma } from "@/lib/db/prisma";
import { generateProductBlueprint } from "@/lib/ai/product-engine";
import { generateOptimizedListing, scoreListingQuality } from "@/lib/ai/listing-seo-engine";
import { generateProductPdf } from "@/lib/services/pdf-service";
import { generateProductCoverImage, generateProductMockups } from "@/lib/services/image-service";
import { publishProductToEtsy } from "@/lib/services/etsy-publish-service";
import { generateAndUploadGallery } from "@/lib/services/gallery-service";
import { pinterest, getValidPinterestToken } from "@/lib/integrations/pinterest";
import { sanitizeForEtsy } from "@/lib/utils/etsy-sanitizer";
import type { Prisma } from "@prisma/client";
import type { BuildStatus } from "./agent-types";

const TOTAL_STAGES = 9;

const STAGE_ORDER = [
  "blueprint",
  "pdf",
  "cover_image",
  "seo",
  "mockups",
  "etsy_publish",
  "gallery",
  "pinterest_pin",
] as const;

type StageName = (typeof STAGE_ORDER)[number];

const STAGE_ACTIVE_STATUS: Record<string, BuildStatus> = {
  blueprint:    "blueprinting",
  pdf:          "generating_pdf",
  cover_image:  "generating_cover",
  seo:          "optimizing_seo",
  mockups:      "generating_mockups",
  etsy_publish: "creating_listing",
  gallery:      "generating_gallery",
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
  const t0 = Date.now();
  console.log(`[pipeline] [${new Date().toISOString()}] Starting stage: ${stageName}`);

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
    console.log(`[pipeline] ✓ ${stageName} (${Date.now() - t0}ms)`);
    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Stage ${stageName} failed after ${Date.now() - t0}ms: ${message}`);

    if (isRequired) {
      const failedStatus = STAGE_FAILED_STATUS[stageName] ?? "failed";
      await setBuildStatus(cardId, failedStatus as BuildStatus, message);
      throw new Error(`Required stage ${stageName} failed: ${message}`);
    }

    console.warn(`[pipeline] Optional stage ${stageName} skipped — continuing pipeline`);
    return { success: false, skipped: true, error: message };
  }
}

function stageIndex(name: string): number {
  return STAGE_ORDER.indexOf(name as StageName);
}

// ── Main pipeline ────────────────────────────────────────────────────────────

export async function runBuildPipeline(cardId: string, resumeFrom?: string): Promise<void> {
  const card = await prisma.launchCard.findUniqueOrThrow({ where: { id: cardId } });
  const resumeIdx = resumeFrom ? stageIndex(resumeFrom) : 0;

  await prisma.launchCard.update({
    where: { id: cardId },
    data: {
      buildStatus: "blueprinting",
      ...(resumeIdx === 0 ? { buildStartedAt: new Date() } : {}),
    },
  });

  const completed: string[] = [];
  const failedStages: Array<{ stage: string; reason: string }> = [];

  // Shared state across stages
  let productId = card.productId ?? "";
  let savedBlueprint: Awaited<ReturnType<typeof generateProductBlueprint>> | null = null;

  // Pre-load etsyOutcome result if resuming after etsy_publish
  let etsyResult: { listingId: string; listingUrl: string; token: string; shopId: string } | null = null;
  if (resumeIdx > stageIndex("etsy_publish") && productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { etsyListingId: true, etsyListingUrl: true },
    });
    const conn = await prisma.etsyConnection.findFirst({ select: { accessToken: true, shopId: true } });
    if (product?.etsyListingId && product.etsyListingUrl && conn) {
      etsyResult = {
        listingId: product.etsyListingId,
        listingUrl: product.etsyListingUrl,
        token: conn.accessToken,
        shopId: conn.shopId,
      };
    }
  }

  try {
    // ── Stage 1: Blueprint (required, 120s) ────────────────────────────────
    if (resumeIdx <= stageIndex("blueprint")) {
      const bpOutcome = await runStage(
        cardId, "blueprint", true, 120_000,
        async () => {
          const blueprint = await generateProductBlueprint(
            card.emotionalHook,
            card.productFormat as Parameters<typeof generateProductBlueprint>[1],
            card.targetAudience
          );
          const safeTitle = sanitizeForEtsy(card.productTitle);
          const safeSections = blueprint.sections.map((s) => ({
            ...s,
            name: sanitizeForEtsy(s.name),
          }));
          const product = await prisma.product.create({
            data: {
              title: safeTitle,
              subtitle: blueprint.subtitle,
              tagline: blueprint.tagline,
              type: card.productFormat,
              targetEmotion: card.emotionalHook,
              targetAudience: card.targetAudience,
              audienceArchetype: blueprint.audienceArchetype,
              pageCount: blueprint.pageCount,
              sections: safeSections as unknown as Prisma.InputJsonValue,
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
      if (!bpOutcome.success) throw new Error("unreachable");
      productId = bpOutcome.result.productId;
      savedBlueprint = bpOutcome.result.blueprint;
      completed.push("blueprint");
    } else {
      console.log(`[pipeline] Skipping blueprint (resumeFrom=${resumeFrom})`);
      completed.push("blueprint");
    }

    // ── Stage 2: PDF (required, 120s) ─────────────────────────────────────
    if (resumeIdx <= stageIndex("pdf")) {
      const pdfOutcome = await runStage<void>(
        cardId, "pdf", true, 120_000,
        async () => { await generateProductPdf(productId); }
      );
      if (pdfOutcome.success) completed.push("pdf");
    } else {
      console.log(`[pipeline] Skipping pdf (resumeFrom=${resumeFrom})`);
      completed.push("pdf");
    }

    // ── Stage 3: Cover image (optional, 45s) ──────────────────────────────
    if (resumeIdx <= stageIndex("cover_image")) {
      const coverOutcome = await runStage<{ path: string } | null>(
        cardId, "cover_image", false, 45_000,
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
    } else {
      console.log(`[pipeline] Skipping cover_image (resumeFrom=${resumeFrom})`);
      completed.push("cover_image");
    }

    // ── Stage 4: SEO optimize (required, 30s) ─────────────────────────────
    if (resumeIdx <= stageIndex("seo")) {
      if (!savedBlueprint) {
        // Load blueprint from product for resume
        const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
        savedBlueprint = product as unknown as typeof savedBlueprint;
      }
      const seoOutcome = await runStage<number>(
        cardId, "seo", true, 30_000,
        async () => {
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
    } else {
      console.log(`[pipeline] Skipping seo (resumeFrom=${resumeFrom})`);
      completed.push("seo_optimize");
    }

    // ── Stage 5: Mockups (optional, 20s) ──────────────────────────────────
    if (resumeIdx <= stageIndex("mockups")) {
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
    } else {
      console.log(`[pipeline] Skipping mockups (resumeFrom=${resumeFrom})`);
      completed.push("mockups");
    }

    // Mark built before Etsy
    await setBuildStatus(cardId, "built");

    // ── Stage 6: Etsy publish (required, 60s) ─────────────────────────────
    if (resumeIdx <= stageIndex("etsy_publish")) {
      const etsyOutcome = await runStage(
        cardId, "etsy_publish", true, 60_000,
        async () => publishProductToEtsy(productId)
      );
      if (!etsyOutcome.success) throw new Error("unreachable");
      etsyResult = etsyOutcome.result;

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
    } else {
      console.log(`[pipeline] Skipping etsy_publish (resumeFrom=${resumeFrom})`);
      completed.push("etsy_draft");
      completed.push("publish");
    }

    if (!etsyResult) throw new Error("No Etsy listing result — cannot continue to gallery/pinterest");

    // ── Stage 7: Gallery (optional, 60s) ──────────────────────────────────
    if (resumeIdx <= stageIndex("gallery")) {
      const galleryOutcome = await runStage(
        cardId, "gallery", false, 60_000,
        async () => generateAndUploadGallery(
          productId,
          etsyResult!.listingId,
          etsyResult!.token,
          etsyResult!.shopId
        )
      );
      if (galleryOutcome.success) {
        completed.push("gallery");
        console.log(`[build-pipeline] ✓ gallery — ${galleryOutcome.result.uploaded}/${galleryOutcome.result.total} images`);
      } else {
        failedStages.push({ stage: "gallery", reason: galleryOutcome.error });
      }
    } else {
      console.log(`[pipeline] Skipping gallery (resumeFrom=${resumeFrom})`);
      completed.push("gallery");
    }

    // ── Stage 8: Pinterest pin (optional, 30s) ────────────────────────────
    if (resumeIdx <= stageIndex("pinterest_pin")) {
      const pinterestOutcome = await runStage<void>(
        cardId, "pinterest_pin", false, 30_000,
        async () => {
          const accessToken = await getValidPinterestToken();
          const conn = await prisma.pinterestConnection.findFirst();
          if (!conn) throw new Error("Pinterest not connected");

          const product = await prisma.product.findUniqueOrThrow({
            where: { id: productId },
            select: { title: true, descriptionShort: true, coverImagePath: true, etsyListingUrl: true },
          });

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
          const imageUrl = product.coverImagePath ? `${baseUrl}${product.coverImagePath}` : "";
          if (!imageUrl) throw new Error("No cover image available for Pinterest pin");

          const listingUrl = product.etsyListingUrl ?? etsyResult!.listingUrl;
          const safeTitle = sanitizeForEtsy(product.title).slice(0, 100);
          const safeDesc = sanitizeForEtsy(product.descriptionShort).slice(0, 500);

          const pinResponse = await pinterest.createPin(
            {
              boardId: conn.boardId,
              title: safeTitle,
              description: safeDesc,
              altText: safeTitle,
              destinationUrl: listingUrl,
              imageUrl,
            },
            accessToken
          );

          await prisma.pinterestPin.create({
            data: {
              productId,
              pinId: pinResponse.id,
              pinUrl: pinResponse.link,
              boardId: conn.boardId,
              title: safeTitle,
              description: safeDesc,
              destinationUrl: listingUrl,
              imageUrl,
            },
          });
        }
      );
      if (pinterestOutcome.success) {
        completed.push("pinterest_pin");
      } else {
        failedStages.push({ stage: "pinterest_pin", reason: pinterestOutcome.error });
      }
    } else {
      console.log(`[pipeline] Skipping pinterest_pin (resumeFrom=${resumeFrom})`);
      completed.push("pinterest_pin");
    }

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
