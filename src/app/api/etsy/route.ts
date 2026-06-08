import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { generateCodeVerifier, generateCodeChallenge, ETSY_SCOPES, withEtsyToken, getShopListings } from "@/lib/integrations/etsy";
import { z } from "zod";

const ETSY_AUTH_BASE = "https://www.etsy.com/oauth/connect";

// GET: status or initiate connect
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "status") {
      const conn = await prisma.etsyConnection.findFirst({ where: { isActive: true } });
      if (!conn) return NextResponse.json({ success: true, data: { connected: false } });
      const listingCount = await prisma.etsyListing.count({ where: { connectionId: conn.id, status: "active" } });
      return NextResponse.json({
        success: true,
        data: { connected: true, shopName: conn.shopName, shopUrl: conn.shopUrl, listingCount },
      });
    }

    if (action === "listings") {
      const conn = await prisma.etsyConnection.findFirst({ where: { isActive: true } });
      if (!conn) return NextResponse.json({ success: true, data: [] });
      const listings = await prisma.etsyListing.findMany({
        where: { connectionId: conn.id },
        orderBy: { revenue: "desc" },
        take: 50,
      });
      return NextResponse.json({ success: true, data: listings });
    }

    if (action === "connect") {
      const clientId = process.env.ETSY_CLIENT_ID;
      const redirectUri = process.env.ETSY_REDIRECT_URI;
      if (!clientId || !redirectUri) {
        return NextResponse.json({ success: false, error: "Etsy not configured" }, { status: 500 });
      }
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = Math.random().toString(36).slice(2);
      const authUrl = `${ETSY_AUTH_BASE}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(ETSY_SCOPES)}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

      const res = NextResponse.json({ success: true, data: { authUrl, state } });
      res.cookies.set("etsy_pkce_verifier", verifier, { httpOnly: true, maxAge: 300, path: "/" });
      res.cookies.set("etsy_pkce_state", state, { httpOnly: true, maxAge: 300, path: "/" });
      return res;
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

const DisconnectSchema = z.object({});

// POST: disconnect or sync
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "disconnect") {
      await req.json().then(() => DisconnectSchema.parse({}));
      const conn = await prisma.etsyConnection.findFirst({ where: { isActive: true } });
      if (conn) {
        await prisma.etsyListing.deleteMany({ where: { connectionId: conn.id } });
        await prisma.etsyConnection.delete({ where: { id: conn.id } });
      }
      return NextResponse.json({ success: true, data: { disconnected: true } });
    }

    if (action === "sync") {
      const conn = await prisma.etsyConnection.findFirst({ where: { isActive: true } });
      if (!conn) return NextResponse.json({ success: false, error: "Not connected" }, { status: 400 });

      const listings = await prisma.etsyListing.findMany({
        where: { connectionId: conn.id, status: "active" },
        take: 10,
      });

      const results = await withEtsyToken(async (token) => {
        return Promise.allSettled(
          listings.map(async (listing) => {
            const remote = await getShopListings(token, conn.shopId, 1);
            const match = remote.find((l) => String(l.listing_id) === listing.etsyListingId);
            if (match) {
              await prisma.etsyListing.update({
                where: { id: listing.id },
                data: {
                  views: match.views,
                  favorites: match.num_favorers,
                  lastSyncAt: new Date(),
                },
              });
            }
          })
        );
      });

      await prisma.etsyConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date() } });
      return NextResponse.json({ success: true, data: { synced: results.length } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
