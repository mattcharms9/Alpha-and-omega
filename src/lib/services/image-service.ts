import { prisma } from "@/lib/db/prisma";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { resizeForEtsy } from "@/lib/images/resize";
import { sanitizeForEtsy } from "@/lib/utils/etsy-sanitizer";
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

  // Query visual intelligence from the most recent MarketIntelligenceReport for this niche
  const primaryKeyword = (product.keywords as string[])?.[0] ?? "";
  let dallePrompt: string;

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
      const vs = report.visualStyle as Record<string, unknown>;
      const colors = (vs.dominantColors as string[])?.slice(0, 3).join(", ") ?? "warm cream, soft white, gold";
      const elements = (vs.commonElements as string[])?.slice(0, 4).join(", ") ?? "clean typography, minimal design, journal pages";
      const style = (vs.dominantStyle as string) ?? "clean minimal";
      const avoid = (vs.whatToAvoid as string[])?.slice(0, 3).join(", ") ?? "busy collages, stock photos, dark backgrounds";
      const titleOnCover = (vs.titleOnCover as boolean) ?? true;
      const safeTitle = sanitizeForEtsy(product.title);

      console.log(`[image-service] Building cover prompt from visual intel for "${primaryKeyword}"`);
      dallePrompt = [
        `Professional Etsy digital product cover image, 2000x2000px square format.`,
        `Dominant color palette: ${colors}.`,
        `Design elements to include: ${elements}.`,
        `Visual style: ${style}.`,
        titleOnCover ? `Include product title prominently: ${safeTitle}.` : "",
        `This is a premium digital download ${sanitizeForEtsy(product.type)} product.`,
        `The cover must look indistinguishable from a top selling Etsy product in this category.`,
        `Do not include: ${avoid}.`,
        `No people, no hands, no dark backgrounds unless that is the dominant style.`,
        `Typography forward layout. High end wellness and self development aesthetic.`,
      ].filter(Boolean).join(" ");
    } else {
      console.warn(`[image-service] No visual intel for "${primaryKeyword}" — using generic cover prompt`);
      dallePrompt = await buildGenericCoverPrompt(product);
    }
  } else {
    dallePrompt = await buildGenericCoverPrompt(product);
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COVER_TIMEOUT_MS);

  let image: Awaited<ReturnType<typeof openai.images.generate>>;
  try {
    image = await openai.images.generate(
      {
        model: "gpt-image-1",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
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
    console.log(`[image-service] Cover upscaled to ${resized.width}x${resized.height} for Etsy`);
    await fs.copyFile(resized.path, path.join(process.cwd(), "public", "product-images", finalFilename)).catch(() => {});
  }

  await prisma.product.update({ where: { id: productId }, data: { coverImagePath: finalPath } });

  return { path: finalPath };
}

async function buildGenericCoverPrompt(product: { title: string; type: string; targetEmotion: string; targetAudience: string }): Promise<string> {
  const { generateCoverImagePlan } = await import("@/lib/ai/image-engine");
  const { buildBlueprintFromProduct } = await import("@/lib/pdf/build-blueprint");
  const fullProduct = await prisma.product.findUnique({ where: { id: (product as { id?: string }).id ?? "" } });
  if (fullProduct) {
    const bp = buildBlueprintFromProduct(fullProduct as Parameters<typeof buildBlueprintFromProduct>[0]);
    const plan = await generateCoverImagePlan(bp);
    return plan.primaryCover.dallePrompt;
  }
  const safeTitle = sanitizeForEtsy(product.title);
  return `Professional Etsy digital product cover image, 2000x2000px, clean warm cream background, premium ${sanitizeForEtsy(product.type)} product, elegant typography, includes title: ${safeTitle}, high end wellness aesthetic, no people, soft natural lighting`;
}

export async function generateProductMockups(productId: string): Promise<{ paths: string[] }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return { paths: [] };

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const blueprint = buildBlueprintFromProduct(product as Parameters<typeof buildBlueprintFromProduct>[0]);
  const { generateMockupConcepts } = await import("@/lib/ai/mockup-engine");

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
