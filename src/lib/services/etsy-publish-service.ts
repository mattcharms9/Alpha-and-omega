import { prisma } from "@/lib/db/prisma";
import {
  createDraftListing,
  uploadListingFile,
  uploadListingImage,
  activateListing,
  getValidEtsyToken,
} from "@/lib/integrations/etsy";
import { sanitizeForEtsy, sanitizeArrayForEtsy } from "@/lib/utils/etsy-sanitizer";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import type { Prisma } from "@prisma/client";
import type { OptimizedListing } from "@/lib/ai/listing-seo-engine";

export interface EtsyPublishResult {
  listingId: string;
  listingUrl: string;
  token: string;
  shopId: string;
}

// Etsy taxonomy IDs for digital product formats
// Source: GET /v3/application/seller-taxonomy/nodes (verified 2026-06-11)
const TAXONOMY_BY_FORMAT: Record<string, number> = {
  journal: 326,          // Books, Movies & Music > Books > Journals & Notebooks
  planner: 326,
  workbook: 326,
  bundle: 326,
  checklist: 1303,       // Paper & Party Supplies > Paper > Stationery
  template_pack: 1303,
  knowledge_guide: 6344, // Craft Supplies > Patterns & How To > Tutorials
  game_sheet: 1347,      // Paper & Party Supplies > Party Supplies > Party Favors & Games
  bingo_card: 1347,
};

export async function publishProductToEtsy(productId: string): Promise<EtsyPublishResult> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { etsyListings: { take: 1 } },
  });

  if (!product.pdfPath) throw new Error("Generate PDF first");

  const { token, shopId, connectionId } = await getValidEtsyToken();

  const optimized = product.optimizedListing as OptimizedListing | null;

  // Apply sanitizeForEtsy to all buyer-facing strings before sending to Etsy API
  const title = sanitizeForEtsy((optimized?.title ?? product.title).slice(0, 140));
  const description = sanitizeForEtsy(optimized?.description ?? product.descriptionLong);
  const rawTags = optimized?.tags ?? (product.keywords as string[]).slice(0, 13);
  const tags = sanitizeArrayForEtsy(rawTags.map((t: string) => t.slice(0, 20)));

  const price = (product.pricingStrategy as { digitalPrice?: number } | null)?.digitalPrice ?? 9.99;
  const taxonomy_id = TAXONOMY_BY_FORMAT[product.type] ?? 354;

  const listing = await createDraftListing(token, shopId, {
    title, description, price, tags,
    quantity: 999, is_digital: true, type: "download",
    who_made: "i_did", when_made: "2020_2026",
    taxonomy_id,
  });

  const listingId = String(listing.listing_id);

  // Upload PDF (required)
  const pdfFilename = basename(product.pdfPath);
  const pdfBuffer = await readFile(join("/tmp", "product-pdfs", pdfFilename))
    .catch(() => readFile(join(process.cwd(), "public", "product-pdfs", pdfFilename)));
  const safeFilename = sanitizeForEtsy(product.title).replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 60);
  await uploadListingFile(token, shopId, listingId, Buffer.from(pdfBuffer), `${safeFilename}.pdf`);

  // Upload cover image at rank 1 (optional — Etsy publish never fails without cover)
  if (product.coverImagePath) {
    const imgFilename = basename(product.coverImagePath);
    const imgBuffer = await readFile(join("/tmp", "product-images", imgFilename))
      .catch(() => readFile(join(process.cwd(), "public", "product-images", imgFilename)));
    await uploadListingImage(token, shopId, listingId, Buffer.from(imgBuffer), "cover.png", 1);
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
