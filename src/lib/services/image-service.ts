import { prisma } from "@/lib/db/prisma";
import { generateCoverImagePlan } from "@/lib/ai/image-engine";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { resizeForEtsy } from "@/lib/images/resize";
import path from "path";
import fs from "fs/promises";
import type { Prisma } from "@prisma/client";

export async function generateProductCoverImage(productId: string): Promise<{ path: string }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const blueprint = buildBlueprintFromProduct(product);
  const plan = await generateCoverImagePlan(blueprint);
  const prompt = plan.primaryCover;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });

  const image = await openai.images.generate({
    model: "gpt-image-1",
    prompt: prompt.dallePrompt,
    n: 1,
    size: prompt.dimensions,
    quality: "high",
  });

  const b64 = image.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data from OpenAI");

  const buffer = Buffer.from(b64, "base64");
  const filename = `${productId}-primary.png`;

  // Write to /tmp/ first (writable on Vercel). Also try public/ for local dev serving.
  const tmpSavePath = path.join("/tmp", "product-images", filename);
  await fs.mkdir(path.dirname(tmpSavePath), { recursive: true });
  await fs.writeFile(tmpSavePath, buffer);

  const publicSavePath = path.join(process.cwd(), "public", "product-images", filename);
  await fs.mkdir(path.dirname(publicSavePath), { recursive: true });
  await fs.writeFile(publicSavePath, buffer).catch(() => {});

  // Resize to Etsy minimum (2000px) if needed — resize the /tmp copy
  const resized = await resizeForEtsy(tmpSavePath).catch(() => null);
  const finalFilename = resized?.wasResized ? path.basename(resized.path) : filename;
  const finalPath = `/product-images/${finalFilename}`;

  if (resized?.wasResized) {
    console.log(`[image-service] Cover upscaled to ${resized.width}×${resized.height} for Etsy`);
    // Also write resized to public/ for local serving
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
  const concepts = await generateMockupConcepts(blueprint, 3);

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });

  const DALLE_TIMEOUT_MS = 30_000;

  const results = await Promise.allSettled(
    concepts.map(async (concept, i) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DALLE_TIMEOUT_MS);
      try {
        const image = await openai.images.generate(
          { model: "gpt-image-1", prompt: concept.dallePrompt, n: 1, size: "1024x1024", quality: "medium" },
          { signal: controller.signal }
        );
        const b64 = image.data?.[0]?.b64_json;
        if (!b64) throw new Error("No mockup image data");
        const buffer = Buffer.from(b64, "base64");
        const filename = `${productId}-mockup-${i}.png`;

        // Write to /tmp/ first (writable on Vercel). Also try public/ for local dev serving.
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
    throw new Error(firstError?.reason instanceof Error ? firstError.reason.message : "All mockup generation attempts failed");
  }

  await prisma.product.update({
    where: { id: productId },
    data: { mockupPaths: paths as unknown as Prisma.InputJsonValue },
  });

  return { paths };
}
