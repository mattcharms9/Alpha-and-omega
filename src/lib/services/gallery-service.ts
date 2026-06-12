import type OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { uploadListingImage } from "@/lib/integrations/etsy";
import { sanitizeForEtsy } from "@/lib/utils/etsy-sanitizer";
import { getGalleryPath } from "@/lib/utils/file-paths";
import path from "path";
import fs from "fs/promises";

interface ProductSection {
  name: string;
  purpose: string;
  pageCount: number;
  prompts: string[];
}

const IMAGE_TIMEOUT_MS = 25_000;

async function generateWithTimeout(openai: OpenAI, prompt: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const result = await openai.images.generate(
      { model: "gpt-image-1", prompt, n: 1, size: "1024x1024", quality: "medium" },
      { signal: controller.signal }
    );
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return null;
    return Buffer.from(b64, "base64");
  } catch (err) {
    console.warn("[gallery] Image generation failed:", err instanceof Error ? err.message : "unknown");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function saveTmp(buffer: Buffer, productId: string, rank: number): Promise<void> {
  const tmpPath = getGalleryPath(productId, rank);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, buffer);
}

export async function generateAndUploadGallery(
  productId: string,
  listingId: string,
  token: string,
  shopId: string
): Promise<{ uploaded: number; total: number }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn("[gallery] OPENAI_API_KEY not set — skipping gallery");
    return { uploaded: 0, total: 0 };
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Product ${productId} not found`);

  const sections = (product.sections as unknown as ProductSection[]) ?? [];
  const safeType = sanitizeForEtsy(product.type);
  const pageCount = product.pageCount ?? 60;
  const sectionCount = sections.length;
  const firstSection = sections[0];

  const { default: OpenAIClient } = await import("openai");
  const openai = new OpenAIClient({ apiKey: openaiKey });

  const sectionList = sections.slice(0, 6).map((s, i) => `${i + 1}. ${sanitizeForEtsy(s.name)}`).join(", ");
  const spreadSection = firstSection ? sanitizeForEtsy(firstSection.name) : safeType;

  const prompts: Array<{ rank: number; prompt: string }> = [
    {
      rank: 2,
      prompt: `Professional Etsy digital product listing image, 2000x2000px, clean warm cream background, elegant typography, bold title at top reading WHAT IS INSIDE, then a numbered list showing these sections: ${sectionList}, styled as a premium table of contents, gold accent lines as dividers, no people, no photographs, looks like a luxury wellness ${safeType} listing image on Etsy, high end design`,
    },
    {
      rank: 3,
      prompt: `Professional Etsy digital product interior spread image, 2000x2000px, two open journal pages side by side, warm cream paper texture, clean serif typography, showing actual guided reflection prompts and journal questions from the section titled ${spreadSection}, elegant minimal design with gold accent details, realistic page curl at center, top down flat lay perspective, soft natural lighting, premium feel`,
    },
    {
      rank: 4,
      prompt: `Professional digital product mockup, iPad Pro displaying a beautifully designed PDF journal open to a content page, clean workspace background, warm natural lighting, top down perspective, premium lifestyle feel, the screen shows clean typography and a guided reflection prompt, no visible brand logos on the device`,
    },
    {
      rank: 5,
      prompt: `Professional Etsy listing image, 2000x2000px, warm cream background, bold title WHAT YOU GET at top, then a bulleted list showing: ${pageCount} pages, ${sectionCount} complete sections, printable and digital fillable PDF, compatible with GoodNotes Notability and Adobe, instant download, personal use license. Clean minimal design, gold checkmark icons, premium typography, no photographs`,
    },
  ];

  // Generate all 4 images in parallel
  const generated = await Promise.allSettled(
    prompts.map(async ({ rank, prompt }) => {
      const buffer = await generateWithTimeout(openai, prompt);
      if (!buffer) return null;
      const filename = `${productId}-gallery-${rank}.png`;
      await saveTmp(buffer, productId, rank);
      return { buffer, filename, rank };
    })
  );

  const uploads = generated
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<{ buffer: Buffer; filename: string; rank: number }>).value);

  console.log(`[gallery] Generated ${uploads.length}/4 images in parallel`);

  // Upload to Etsy listing sequentially (rate limit safe)
  let uploaded = 0;
  for (const img of uploads) {
    try {
      await uploadListingImage(token, shopId, listingId, img.buffer, img.filename, img.rank);
      uploaded++;
      console.log(`[gallery] Uploaded rank ${img.rank} image`);
    } catch (err) {
      console.warn(`[gallery] Failed to upload rank ${img.rank}:`, err instanceof Error ? err.message : "unknown");
    }
  }

  console.log(`[gallery] ${uploaded}/${uploads.length} gallery images uploaded to listing ${listingId}`);
  return { uploaded, total: uploads.length };
}
