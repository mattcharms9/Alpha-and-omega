import type OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { uploadListingImage } from "@/lib/integrations/etsy";
import { sanitizeForEtsy } from "@/lib/utils/etsy-sanitizer";
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

async function saveImage(buffer: Buffer, filename: string): Promise<void> {
  const tmpPath = path.join("/tmp", "gallery", filename);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, buffer);
  await fs.mkdir(path.join(process.cwd(), "public", "gallery"), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "public", "gallery", filename), buffer).catch(() => {});
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

  const uploads: Array<{ buffer: Buffer; filename: string; rank: number }> = [];

  // Image 2: "What Is Inside" overview
  const sectionList = sections.slice(0, 6).map((s, i) => `${i + 1}. ${sanitizeForEtsy(s.name)}`).join(", ");
  const insidePrompt = `Professional Etsy digital product listing image, 2000x2000px, clean warm cream background, elegant typography, bold title at top reading WHAT IS INSIDE, then a numbered list showing these sections: ${sectionList}, styled as a premium table of contents, gold accent lines as dividers, no people, no photographs, looks like a luxury wellness ${safeType} listing image on Etsy, high end design`;
  const insideBuf = await generateWithTimeout(openai, insidePrompt);
  if (insideBuf) {
    const filename = `${productId}-gallery-2.png`;
    await saveImage(insideBuf, filename);
    uploads.push({ buffer: insideBuf, filename, rank: 2 });
  }

  // Image 3: interior page spread
  const spreadSection = firstSection ? sanitizeForEtsy(firstSection.name) : safeType;
  const spreadPrompt = `Professional Etsy digital product interior spread image, 2000x2000px, two open journal pages side by side, warm cream paper texture, clean serif typography, showing actual guided reflection prompts and journal questions from the section titled ${spreadSection}, elegant minimal design with gold accent details, realistic page curl at center, top down flat lay perspective, soft natural lighting, premium feel`;
  const spreadBuf = await generateWithTimeout(openai, spreadPrompt);
  if (spreadBuf) {
    const filename = `${productId}-gallery-3.png`;
    await saveImage(spreadBuf, filename);
    uploads.push({ buffer: spreadBuf, filename, rank: 3 });
  }

  // Image 4: device mockup (iPad)
  const devicePrompt = `Professional digital product mockup, iPad Pro displaying a beautifully designed PDF journal open to a content page, clean workspace background, warm natural lighting, top down perspective, premium lifestyle feel, the screen shows clean typography and a guided reflection prompt, no visible brand logos on the device`;
  const deviceBuf = await generateWithTimeout(openai, devicePrompt);
  if (deviceBuf) {
    const filename = `${productId}-gallery-4.png`;
    await saveImage(deviceBuf, filename);
    uploads.push({ buffer: deviceBuf, filename, rank: 4 });
  }

  // Image 5: "What You Get" summary
  const summaryPrompt = `Professional Etsy listing image, 2000x2000px, warm cream background, bold title WHAT YOU GET at top, then a bulleted list showing: ${pageCount} pages, ${sectionCount} complete sections, printable and digital fillable PDF, compatible with GoodNotes Notability and Adobe, instant download, personal use license. Clean minimal design, gold checkmark icons, premium typography, no photographs`;
  const summaryBuf = await generateWithTimeout(openai, summaryPrompt);
  if (summaryBuf) {
    const filename = `${productId}-gallery-5.png`;
    await saveImage(summaryBuf, filename);
    uploads.push({ buffer: summaryBuf, filename, rank: 5 });
  }

  // Upload all generated images sequentially to Etsy listing
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
