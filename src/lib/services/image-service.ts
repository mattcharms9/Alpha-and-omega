import { prisma } from "@/lib/db/prisma";
import { generateCoverImagePlan } from "@/lib/ai/image-engine";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { resizeForEtsy } from "@/lib/images/resize";
import type { VisualIntelligence } from "@/lib/market-intelligence/types";
import path from "path";
import fs from "fs/promises";
import type { Prisma } from "@prisma/client";

const COVER_TIMEOUT_MS = 30_000;
const MOCKUP_TIMEOUT_MS = 30_000;
const MOCKUP_CONCEPTS_TIMEOUT_MS = 20_000;

export async function generateProductCoverImage(productId: string): Promise<{ path: string }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const blueprint = buildBlueprintFromProduct(product);

  // Query visual intelligence from the most recent MarketIntelligenceReport for this niche
  const primaryKeyword = (product.keywords as string[])?.[0] ?? "";
  let visualIntel: VisualIntelligence | undefined;
  if (primaryKeyword) {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const report = await prisma.marketIntelligenceReport.findFirst({
      where: {
        niche: { contains: primaryKeyword },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
    if (report?.visualStyle) {
      visualIntel = report.visualStyle as unknown as VisualIntelligence;
    }
  }

  const plan = await generateCoverImagePlan(blueprint, visualIntel);
  const prompt = plan.primaryCover;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COVER_TIMEOUT_MS);

  let image: Awaited<ReturnType<typeof openai.images.generate>>;
  try {
    image = await openai.images.generate(
      {
        model: "gpt-image-1",
        prompt: prompt.dallePrompt,
        n: 1,
        size: prompt.dimensions,
        quality: "high",
      },
      { signal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }

  const b64 = image.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data from OpenAI");

  const buffer = Buffer.from(b64, "base64");
  const filename = `${productId}-primary.png`;

  const tmpSavePath = path.join("/tmp", "product-images", filename);
  await fs.mkdir(path.dirname(tmpSavePath), { recursive: true });
  await fs.writeFile(tmpSavePath, buffer);

  const publicSavePath = path.join(process.cwd(), "public", "product-images", filename);
  await fs.mkdir(path.dirname(publicSavePath), { recursive: true });
  await fs.writeFile(publicSavePath, buffer).catch(() => {});

  const resized = await resizeForEtsy(tmpSavePath).catch(() => null);
  const finalFilename = resized?.wasResized ? path.basename(resized.path) : filename;
  const finalPath = `/product-images/${finalFilename}`;

  if (resized?.wasResized) {
    console.log(`[image-service] Cover upscaled to ${resized.width}×${resized.height} for Etsy`);
    await fs.copyFile(resized.path, path.join(process.cwd(), "public", "product-images", finalFilename)).catch(() => {});
  }

  await prisma.product.update({ where: { id: productId }, data: { coverImagePath: finalPath } });

  return { path: finalPath };
}

export async function generateProductMockups(productId: string): Promise<{ paths: string[] }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return { paths: [] };

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const blueprint = buildBlueprintFromProduct(product);
  const { generateMockupConcepts } = await import("@/lib/ai/mockup-engine");

  // Wrap the Claude call with a timeout
  const concepts = await Promise.race([
    generateMockupConcepts(blueprint, 3),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("generateMockupConcepts timed out")), MOCKUP_CONCEPTS_TIMEOUT_MS)
    ),
  ]);

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });

  const results = await Promise.allSettled(
    concepts.map(async (concept, i) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MOCKUP_TIMEOUT_MS);
      try {
        const image = await openai.images.generate(
          { model: "gpt-image-1", prompt: concept.dallePrompt, n: 1, size: "1024x1024", quality: "medium" },
          { signal: controller.signal }
        );
        const b64 = image.data?.[0]?.b64_json;
        if (!b64) throw new Error("No mockup image data");
        const buffer = Buffer.from(b64, "base64");
        const filename = `${productId}-mockup-${i}.png`;

        const tmpSavePath = path.join("/tmp", "product-mockups", filename);
        await fs.mkdir(path.dirname(tmpSavePath), { recursive: true });
        await fs.writeFile(tmpSavePath, buffer);
        await fs.writeFile(path.join(process.cwd(), "public", "product-mockups", filename), buffer).catch(() => {});

        return `/product-mockups/${filename}`;
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const paths = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<string>).value);

  // Never throw — return empty paths if all failed (pipeline continues)
  if (paths.length === 0 && concepts.length > 0) {
    const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    console.warn("[image-service] All mockup attempts failed:", firstError?.reason instanceof Error ? firstError.reason.message : "unknown");
    return { paths: [] };
  }

  await prisma.product.update({
    where: { id: productId },
    data: { mockupPaths: paths as unknown as Prisma.InputJsonValue },
  });

  return { paths };
}
