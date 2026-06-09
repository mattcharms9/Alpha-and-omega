import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getShopListings, withEtsyToken } from "@/lib/integrations/etsy";

// Schedule: 0 6 * * * (6am UTC daily)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let remoteListings: Awaited<ReturnType<typeof getShopListings>>;
    try {
      remoteListings = await withEtsyToken((token, shopId) => getShopListings(token, shopId, 100, 0));
    } catch {
      return NextResponse.json({ success: true, data: { skipped: "No Etsy shop connected" } });
    }

    const listings = await prisma.etsyListing.findMany({
      where: { status: "active" },
      take: 10,
      orderBy: { lastSyncAt: "asc" },
    });

    if (listings.length === 0) return NextResponse.json({ success: true, data: { synced: 0 } });

    const remoteMap = new Map(remoteListings.map((l) => [String(l.listing_id), l]));
    let synced = 0;

    for (const listing of listings) {
      const remote = remoteMap.get(listing.etsyListingId);
      if (remote) {
        await prisma.etsyListing.update({
          where: { id: listing.id },
          data: {
            views: remote.views,
            favorites: remote.num_favorers,
            status: remote.state === "active" ? "active" : remote.state,
            lastSyncAt: new Date(),
          },
        });
        synced++;
      }
    }

    return NextResponse.json({ success: true, data: { synced } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    console.error("[cron/sync-etsy] Error:", msg);
    return NextResponse.json({ success: false, error: "Sync failed" }, { status: 500 });
  }
}
