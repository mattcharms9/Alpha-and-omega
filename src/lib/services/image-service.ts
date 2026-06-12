import type OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { sanitizeForEtsy } from "@/lib/utils/etsy-sanitizer";
import { getCoverPath, getMockupPath } from "@/lib/utils/file-paths";
import path from "path";
import fs from "fs/promises";
import type { Prisma } from "@prisma/client";

const COVER_TIMEOUT_MS = 30_000;
const MOCKUP_TIMEOUT_MS = 30_000;
const MOCKUP_CONCEPTS_TIMEOUT_MS = 20_000;

async function uploadCoverToBlob(buffer: Buffer, productId: string): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`covers/${productId}.png`, buffer, { access: "public" });
    return blob.url;
  } catch (err) {
    console.warn("[image-service] Vercel Blob upload failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

async function generateDalleImage(openai: OpenAI, prompt: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const image = await openai.images.generate(
      { model: "gpt-image-1", prompt, n: 1, size: "1024x1024", quality: "high" },
      { signal: controller.signal }
    );
    const b64 = image.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned from OpenAI");
    return Buffer.from(b64, "base64");
  } finally {
    clearTimeout(timer);
  }
}

function buildGenericCoverPrompt(title: string, type: string): string {
  const safeTitle = sanitizeForEtsy(title);
  const safeType = sanitizeForEtsy(type);
  return `Professional Etsy digital product cover image, 2000x2000px, clean warm cream background, premium ${safeType} product, elegant typography, includes title: ${safeTitle}, high end wellness aesthetic, no people, soft natural lighting, minimalist design`;
}

export async function generateProductCoverImage(productId: string): Promise<{ path: string; blobUrl: string | null }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

  const primaryKeyword = (product.keywords as string[])?.[0] ?? "";
  let dallePrompt: string = buildGenericCoverPrompt(product.title, product.type);

  // Build prompt from visual intelligence data when available (48h lookback)
  if (primaryKeyword) {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const report = await prisma.marketIntelligenceReport.findFirst({
      where: { niche: { contains: primaryKeyword }, createdAt: { gte: since } },
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
      dallePrompt = [
        `Professional Etsy digital product cover image, 2000x2000px square format.`,
        `Dominant color palette: ${colors}.`,
        `Design elements to include: ${elements}.`,
        `Visual style: ${style}.`,
        titleOnCover ? `Include product title prominently: ${safeTitle}.` : "",
        `This is a premium digital download ${sanitizeForEtsy(product.type)} product.`,
        `The cover must look indistinguishable from a top selling Etsy product in this category.`,
        `Do not include: ${avoid}.`,
        `No people, no hands. Typography forward layout. High end wellness and self development aesthetic.`,
      ].filter(Boolean).join(" ");
      console.log("[image-service] Building cover from visual intel data");
    }
  }

  const { default: OpenAIClient } = await import("openai");
  const openai = new OpenAIClient({ apiKey: openaiKey });

  // Attempt 1: primary prompt (30s timeout)
  let buffer: Buffer | null = null;
  try {
    buffer = await generateDalleImage(openai, dallePrompt, COVER_TIMEOUT_MS);
    console.log("[image-service] Cover generated (attempt 1)");
  } catch (err) {
    console.warn("[image-service] Cover attempt 1 failed:", err instanceof Error ? err.message : "unknown");
  }

  // Attempt 2: generic fallback prompt (20s timeout)
  if (!buffer) {
    try {
      buffer = await generateDalleImage(openai, buildGenericCoverPrompt(product.title, product.type), 20_000);
      console.log("[image-service] Cover generated using generic fallback prompt");
    } catch (err) {
      console.warn("[image-service] Cover attempt 2 failed:", err instanceof Error ? err.message : "unknown");
    }
  }

  // Attempt 3: all failed — continue without cover
  if (!buffer) {
    console.warn("[image-service] All cover generation attempts failed — listing will publish without cover");
    return { path: "", blobUrl: null };
  }

  const tmpPath = getCoverPath(productId);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, buffer);

  const blobUrl = await uploadCoverToBlob(buffer, productId);
  if (blobUrl) {
    console.log(`[image-service] Cover uploaded to Vercel Blob: ${blobUrl}`);
  } else {
    console.log("[image-service] Cover in /tmp only (Vercel Blob not configured)");
  }

  const filename = `${productId}-primary.png`;
  const finalPath = `/product-images/${filename}`;

  await prisma.product.update({
    where: { id: productId },
    data: {
      coverImagePath: finalPath,
      ...(blobUrl ? { coverImageBlobUrl: blobUrl } : {}),
    },
  });

  return { path: finalPath, blobUrl };
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

  const { default: OpenAIClient } = await import("openai");
  const openai = new OpenAIClient({ apiKey: openaiKey });

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
        const tmpPath = getMockupPath(productId, i);
        await fs.mkdir(path.dirname(tmpPath), { recursive: true });
        await fs.writeFile(tmpPath, buffer);
        return `/product-mockups/${productId}-mockup-${i}.png`;
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
