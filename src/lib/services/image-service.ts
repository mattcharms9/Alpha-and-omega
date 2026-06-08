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
  const savePath = path.join(process.cwd(), "public", "product-images", filename);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, buffer);

  // Resize to Etsy minimum (2000px) if needed
  const resized = await resizeForEtsy(savePath).catch(() => null);
  const finalPath = resized?.wasResized
    ? `/product-images/${path.basename(resized.path)}`
    : `/product-images/${filename}`;

  if (resized?.wasResized) {
    console.log(`[image-service] Cover upscaled to ${resized.width}×${resized.height} for Etsy`);
    // Remove original undersized file
    await fs.unlink(savePath).catch(() => {});
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

  const results = await Promise.allSettled(
    concepts.map(async (concept, i) => {
      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt: concept.dallePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });
      const b64 = image.data?.[0]?.b64_json;
      if (!b64) throw new Error("No mockup image data");
      const buffer = Buffer.from(b64, "base64");
      const filename = `${productId}-mockup-${i}.png`;
      const savePath = path.join(process.cwd(), "public", "product-mockups", filename);
      await fs.mkdir(path.dirname(savePath), { recursive: true });
      await fs.writeFile(savePath, buffer);
      return `/product-mockups/${filename}`;
    })
  );

  const paths = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<string>).value);

  await prisma.product.update({
    where: { id: productId },
    data: { mockupPaths: paths as unknown as Prisma.InputJsonValue },
  });

  return { paths };
}
