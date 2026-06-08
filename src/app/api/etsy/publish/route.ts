import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { withEtsyToken, createDraftListing, uploadListingFile, uploadListingImage, activateListing, updateListing } from "@/lib/integrations/etsy";
import { readFile } from "fs/promises";
import { join } from "path";

const PublishSchema = z.object({ productId: z.string().min(1) });
const UpdateSchema = z.object({ etsyListingId: z.string().min(1), fields: z.record(z.string(), z.unknown()) });

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "publish";

  if (action === "update") {
    try {
      const body = await req.json();
      const { etsyListingId, fields } = UpdateSchema.parse(body);
      const listing = await prisma.etsyListing.findUnique({ where: { etsyListingId } });
      if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
      const conn = await prisma.etsyConnection.findUnique({ where: { id: listing.connectionId } });
      if (!conn) return NextResponse.json({ success: false, error: "Not connected" }, { status: 400 });
      const updated = await updateListing(conn.accessToken, conn.shopId, etsyListingId, fields as Parameters<typeof updateListing>[3]);
      return NextResponse.json({ success: true, data: updated });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  if (action === "renew") {
    try {
      const body = await req.json();
      const { etsyListingId } = z.object({ etsyListingId: z.string() }).parse(body);
      const listing = await prisma.etsyListing.findUnique({ where: { etsyListingId } });
      if (!listing) return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 });
      await withEtsyToken(async (token, shopId) => updateListing(token, shopId, etsyListingId, {}));
      const newExpiry = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000); // ~4 months
      await prisma.etsyListing.update({ where: { etsyListingId }, data: { expiresAt: newExpiry } });
      return NextResponse.json({ success: true, data: { renewed: true } });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  // publish or draft — SSE streaming
  try {
    const body = await req.json();
    const { productId } = PublishSchema.parse(body);
    const isDraft = action === "draft";

    const encoder = new TextEncoder();
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();

    const send = async (data: object) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    void (async () => {
      try {
        await send({ type: "progress", step: "Preparing listing…" });

        const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
        if (!product.pdfPath) { await send({ type: "error", message: "Generate PDF first" }); return; }
        if (!product.coverImagePath) { await send({ type: "error", message: "Generate cover image first" }); return; }

        const conn = await prisma.etsyConnection.findFirst({ where: { isActive: true } });
        if (!conn) { await send({ type: "error", message: "Connect Etsy first" }); return; }

        await send({ type: "progress", step: "Creating draft listing…" });

        const optimized = product.optimizedListing as { title?: string; description?: string; tags?: string[] } | null;
        const title = optimized?.title ?? product.title.slice(0, 140);
        const description = optimized?.description ?? product.descriptionLong;
        const tags = (optimized?.tags ?? (product.keywords as string[]).slice(0, 13)).map((t: string) => t.slice(0, 20));

        const listing = await withEtsyToken((token, shopId) =>
          createDraftListing(token, shopId, {
            title,
            description,
            price: 9.99,
            tags,
            quantity: 999,
            is_digital: true,
            who_made: "i_did",
            when_made: "2020_2024",
          })
        );
        const listingId = String(listing.listing_id);

        await send({ type: "progress", step: "Uploading PDF…" });
        const pdfBuffer = await readFile(join(process.cwd(), "public", product.pdfPath.replace(/^\//, "")));
        await withEtsyToken((token, shopId) =>
          uploadListingFile(token, shopId, listingId, Buffer.from(pdfBuffer), `${product.title}.pdf`)
        );

        await send({ type: "progress", step: "Uploading cover image…" });
        const imgBuffer = await readFile(join(process.cwd(), "public", product.coverImagePath!.replace(/^\//, "")));
        await withEtsyToken((token, shopId) =>
          uploadListingImage(token, shopId, listingId, Buffer.from(imgBuffer), `cover.png`)
        );

        const expiry = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

        if (!isDraft) {
          await send({ type: "progress", step: "Activating listing…" });
          await withEtsyToken((token, shopId) => activateListing(token, shopId, listingId));
        }

        await prisma.etsyListing.create({
          data: {
            productId,
            connectionId: conn.id,
            etsyListingId: listingId,
            title,
            description,
            price: 9.99,
            tags,
            status: isDraft ? "draft" : "active",
            publishedAt: isDraft ? undefined : new Date(),
            expiresAt: expiry,
          },
        });

        if (!isDraft) {
          await prisma.product.update({ where: { id: productId }, data: { status: "published_etsy", etsyListingId: listingId } });
        }

        const listingUrl = `https://www.etsy.com/listing/${listingId}`;
        await send({ type: "complete", listingUrl, listingId, isDraft });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publish failed";
        await send({ type: "error", message: msg });
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(stream.readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
