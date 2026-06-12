import { prisma } from "@/lib/db/prisma";
import {
  createDraftListing,
  uploadListingFile,
  uploadListingImage,
  activateListing,
  getValidEtsyToken,
} from "@/lib/integrations/etsy";
import { sanitizeForEtsy, sanitizeArrayForEtsy } from "@/lib/utils/etsy-sanitizer";
import { getPdfPath, getCoverPath } from "@/lib/utils/file-paths";
import { readFile } from "fs/promises";
import type { Prisma } from "@prisma/client";
import type { OptimizedListing } from "@/lib/ai/listing-seo-engine";

export interface EtsyPublishResult {
  listingId: string;
  listingUrl: string;
  token: string;
  shopId: string;
}

const TAXONOMY_BY_FORMAT: Record<string, number> = {
  journal: 326,
  planner: 326,
  workbook: 326,
  bundle: 326,
  checklist: 1303,
  template_pack: 1303,
  knowledge_guide: 6344,
  game_sheet: 1347,
  bingo_card: 1347,
};

async function fetchBuffer(blobUrl: string | null, tmpPath: string): Promise<Buffer> {
  if (blobUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(blobUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
      console.warn(`[etsy-publish] Blob fetch returned ${res.status} — falling back to /tmp`);
    } catch (err) {
      console.warn("[etsy-publish] Blob fetch failed:", err instanceof Error ? err.message : "unknown", "— falling back to /tmp");
    }
  }
  return readFile(tmpPath);
}

function validateListing(title: string, description: string, tags: string[], price: number, pdfBlobUrl: string | null | undefined): void {
  if (title.length < 5 || title.length > 140) {
    throw new Error(`Listing title must be 5-140 chars, got ${title.length}`);
  }
  if (description.length < 100) {
    throw new Error(`Listing description must be 100+ chars, got ${description.length}`);
  }
  if (tags.length < 1 || tags.length > 13) {
    throw new Error(`Listing must have 1-13 tags, got ${tags.length}`);
  }
  for (const tag of tags) {
    if (tag.length > 20) {
      throw new Error(`Tag "${tag}" exceeds 20 chars (${tag.length})`);
    }
  }
  if (price <= 0) {
    throw new Error(`Listing price must be > 0, got ${price}`);
  }
  if (!pdfBlobUrl || !pdfBlobUrl.startsWith("https://")) {
    // Only warn — we can still upload from /tmp if it's the same invocation
    console.warn("[etsy-publish] pdfBlobUrl is missing or invalid — will attempt /tmp fallback");
  }
}

export async function publishProductToEtsy(productId: string): Promise<EtsyPublishResult> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { etsyListings: { take: 1 } },
  });

  if (!product.pdfPath) throw new Error("Generate PDF first");

  const { token, shopId, connectionId } = await getValidEtsyToken();

  const optimized = product.optimizedListing as OptimizedListing | null;

  const title = sanitizeForEtsy((optimized?.title ?? product.title).slice(0, 140));
  const description = sanitizeForEtsy(optimized?.description ?? product.descriptionLong);
  const rawTags = optimized?.tags ?? (product.keywords as string[]).slice(0, 13);
  const tags = sanitizeArrayForEtsy(rawTags.map((t: string) => t.slice(0, 20)));

  const price = (product.pricingStrategy as { digitalPrice?: number } | null)?.digitalPrice ?? 9.99;
  const taxonomy_id = TAXONOMY_BY_FORMAT[product.type] ?? 354;

  validateListing(title, description, tags, price, product.pdfBlobUrl);

  const listing = await createDraftListing(token, shopId, {
    title, description, price, tags,
    quantity: 999, is_digital: true, type: "download",
    who_made: "i_did", when_made: "2020_2026",
    taxonomy_id,
  });

  const listingId = String(listing.listing_id);

  // Upload PDF — try blob URL first, then /tmp (same invocation only)
  const pdfBuffer = await fetchBuffer(
    product.pdfBlobUrl ?? null,
    getPdfPath(productId)
  );
  const safeFilename = sanitizeForEtsy(product.title).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 60);
  await uploadListingFile(token, shopId, listingId, pdfBuffer, `${safeFilename}.pdf`);

  // Upload cover image at rank 1 (optional)
  if (product.coverImagePath) {
    try {
      const imgBuffer = await fetchBuffer(
        product.coverImageBlobUrl ?? null,
        getCoverPath(productId)
      );
      await uploadListingImage(token, shopId, listingId, imgBuffer, "cover.png", 1);
    } catch (err) {
      console.warn("[etsy-publish] Cover upload failed — listing will publish without cover:", err instanceof Error ? err.message : "unknown");
    }
  }

  await activateListing(token, shopId, listingId);

  const expiry = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
  await prisma.etsyListing.create({
    data: {
      productId,
      connectionId,
      etsyListingId: listingId,
      title, description, price,
      tags: tags as unknown as Prisma.InputJsonValue,
      status: "active",
      publishedAt: new Date(),
      expiresAt: expiry,
    },
  });

  const listingUrl = `https://www.etsy.com/listing/${listingId}`;
  await prisma.product.update({
    where: { id: productId },
    data: { status: "published_etsy", etsyListingId: listingId, etsyListingUrl: listingUrl },
  });

  return { listingId, listingUrl, token, shopId };
}
