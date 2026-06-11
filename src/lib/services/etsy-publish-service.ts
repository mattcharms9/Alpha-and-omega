import { prisma } from "@/lib/db/prisma";
import {
  createDraftListing,
  uploadListingFile,
  uploadListingImage,
  activateListing,
  getValidEtsyToken,
} from "@/lib/integrations/etsy";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import type { Prisma } from "@prisma/client";
import type { OptimizedListing } from "@/lib/ai/listing-seo-engine";

export interface EtsyPublishResult {
  listingId: string;
  listingUrl: string;
}

// Etsy taxonomy IDs for digital product formats
// Source: GET /v3/application/seller-taxonomy/nodes
const TAXONOMY_BY_FORMAT: Record<string, number> = {
  journal: 354,       // Paper & Party Supplies > Paper > Calendars & Planners
  planner: 354,
  workbook: 354,
  bundle: 354,
  checklist: 1303,    // Paper & Party Supplies > Paper > Stationery
  template_pack: 1303,
  knowledge_guide: 6344, // Craft Supplies > Patterns & How To > Tutorials
  game_sheet: 1347,   // Paper & Party Supplies > Party Supplies > Party Favors & Games
  bingo_card: 1347,
};

export async function publishProductToEtsy(productId: string): Promise<EtsyPublishResult> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { etsyListings: { take: 1 } },
  });

  if (!product.pdfPath) throw new Error("Generate PDF first");
  if (!product.coverImagePath) throw new Error("Generate cover image first");

  const { token, shopId, connectionId } = await getValidEtsyToken();

  const optimized = product.optimizedListing as OptimizedListing | null;
  const title = (optimized?.title ?? product.title).slice(0, 140);
  const description = optimized?.description ?? product.descriptionLong;
  const tags = (optimized?.tags ?? (product.keywords as string[]).slice(0, 13)).map((t: string) => t.slice(0, 20));
  const price = (product.pricingStrategy as { digitalPrice?: number } | null)?.digitalPrice ?? 9.99;
  const taxonomy_id = TAXONOMY_BY_FORMAT[product.type] ?? 354;

  const listing = await createDraftListing(token, shopId, {
    title, description, price, tags,
    quantity: 999, is_digital: true, type: "download",
    who_made: "i_did", when_made: "2020_2026",
    taxonomy_id,
  });

  const listingId = String(listing.listing_id);

  // Try /tmp/ first (Vercel runtime), fall back to public/ (local dev).
  // pdfFilename / imgFilename are extracted before the catch to preserve TS narrowing.
  const pdfFilename = basename(product.pdfPath);
  const pdfBuffer = await readFile(join("/tmp", "product-pdfs", pdfFilename))
    .catch(() => readFile(join(process.cwd(), "public", "product-pdfs", pdfFilename)));
  const safeFilename = product.title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
  await uploadListingFile(token, shopId, listingId, Buffer.from(pdfBuffer), `${safeFilename}.pdf`);

  const imgFilename = basename(product.coverImagePath!);
  const imgBuffer = await readFile(join("/tmp", "product-images", imgFilename))
    .catch(() => readFile(join(process.cwd(), "public", "product-images", imgFilename)));
  await uploadListingImage(token, shopId, listingId, Buffer.from(imgBuffer), "cover.png");

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

  return { listingId, listingUrl };
}
