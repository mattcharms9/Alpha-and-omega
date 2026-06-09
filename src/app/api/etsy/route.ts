import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { etsyFetch, getEtsyShopId, getShopListings } from "@/lib/integrations/etsy";
import { z } from "zod";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  console.log("[etsy] action received:", action);

  try {
    // ── status — verify API keys by calling Etsy ──────────────────────────
    if (action === "status") {
      const keystring = process.env.ETSY_API_KEY;
      const shopId = process.env.ETSY_SHOP_ID;

      if (!keystring || !shopId) {
        return NextResponse.json({
          success: true,
          data: { connected: false, reason: "ETSY_API_KEY and ETSY_SHOP_ID must be set in environment variables" },
        });
      }

      try {
        const res = await etsyFetch(`/application/shops/${shopId}`);
        const shop = await res.json() as { shop_id: number; shop_name: string; url: string };
        const listingCount = await prisma.etsyListing.count({
          where: { status: "active" },
        }).catch(() => 0);
        console.log("[etsy status] connected, shop:", shop.shop_name);
        return NextResponse.json({
          success: true,
          data: {
            connected: true,
            shopId: String(shop.shop_id),
            shopName: shop.shop_name,
            shopUrl: shop.url,
            listingCount,
          },
        });
      } catch (e) {
        console.error("[etsy status] API call failed:", e);
        return NextResponse.json({
          success: true,
          data: { connected: false, reason: e instanceof Error ? e.message : "Could not reach Etsy API" },
        });
      }
    }

    // ── listings ──────────────────────────────────────────────────────────
    if (action === "listings") {
      const listings = await prisma.etsyListing.findMany({
        orderBy: { revenue: "desc" },
        take: 50,
      });
      return NextResponse.json({ success: true, data: listings });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

const DisconnectSchema = z.object({});

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });

  const action = new URL(req.url).searchParams.get("action");

  try {
    if (action === "disconnect") {
      await req.json().then(() => DisconnectSchema.parse({}));
      await prisma.etsyListing.deleteMany({});
      return NextResponse.json({ success: true, data: { disconnected: true } });
    }

    if (action === "sync") {
      const shopId = getEtsyShopId();
      const listings = await prisma.etsyListing.findMany({
        where: { status: "active" },
        take: 10,
      });

      const results = await Promise.allSettled(
        listings.map(async (listing) => {
          const remote = await getShopListings(shopId, 1);
          const match = remote.find((l) => String(l.listing_id) === listing.etsyListingId);
          if (match) {
            await prisma.etsyListing.update({
              where: { id: listing.id },
              data: { views: match.views, favorites: match.num_favorers, lastSyncAt: new Date() },
            });
          }
        })
      );

      return NextResponse.json({ success: true, data: { synced: results.length } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
