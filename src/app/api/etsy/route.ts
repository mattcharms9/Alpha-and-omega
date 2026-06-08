import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildOAuthState,
  extractVerifierFromState,
} from "@/lib/etsy-state";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  resolveEtsyApiKey,
  ETSY_SCOPES,
  withEtsyToken,
  getShopListings,
} from "@/lib/integrations/etsy";
import { z } from "zod";

const ETSY_AUTH_BASE = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const { searchParams } = reqUrl;
  const action = searchParams.get("action");

  // ── OAuth callback from Etsy ───────────────────────────────────────────────
  if (action === "callback") {
    const base = `${reqUrl.protocol}//${reqUrl.host}`;
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const etsyError = searchParams.get("error");

    if (etsyError) return cbError(base, `Etsy denied: ${etsyError}`);
    if (!code) return cbError(base, "No auth code — check redirect_uri in Etsy developer portal");
    if (!returnedState) return cbError(base, "No state returned from Etsy");

    const verifier = extractVerifierFromState(returnedState);
    if (!verifier) return cbError(base, "Invalid OAuth state — please try connecting again");

    let apiKey: string;
    try { apiKey = resolveEtsyApiKey(); } catch {
      return cbError(base, "ETSY_API_KEY env var not set on this server");
    }
    const redirectUri = process.env.ETSY_REDIRECT_URI;
    if (!redirectUri) return cbError(base, "ETSY_REDIRECT_URI env var not set");

    console.log("[etsy callback] api key prefix:", apiKey.slice(0, 8), "redirect_uri:", redirectUri);

    try {
      const tokenRes = await fetch(ETSY_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: apiKey,
          redirect_uri: redirectUri,
          code,
          code_verifier: verifier,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text().catch(() => "");
        console.error("[etsy callback] token exchange failed:", tokenRes.status, err);
        return cbError(base, `Token exchange failed (${tokenRes.status}: ${err.slice(0, 200)})`);
      }

      const tokenData = await tokenRes.json() as {
        access_token: string; refresh_token: string; expires_in: number; user_id?: string | number;
      };
      console.log("[etsy callback] token exchange success, fetching user identity...");

      const etsyHeaders = {
        Authorization: `Bearer ${tokenData.access_token}`,
        "x-api-key": apiKey,
      };

      // Try token payload first, then /users/me
      let userId: string | number | undefined = tokenData.user_id ?? jwtUserId(tokenData.access_token);
      if (!userId) {
        const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", { headers: etsyHeaders });
        if (!meRes.ok) {
          const err = await meRes.text().catch(() => "");
          console.error("[etsy callback] /users/me failed:", meRes.status, err);
          return cbError(base, `Could not identify Etsy user (${meRes.status}: ${err.slice(0, 120)})`);
        }
        const meData = await meRes.json() as { user_id?: string | number; login_name?: string };
        userId = meData.user_id;
        console.log("[etsy callback] user identified:", meData.user_id, meData.login_name);
      } else {
        console.log("[etsy callback] user_id from token:", userId);
      }
      if (!userId) return cbError(base, "Could not identify Etsy user — no user_id in token or /users/me response");

      const shopsRes = await fetch(
        `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
        { headers: etsyHeaders }
      );
      if (!shopsRes.ok) {
        const err = await shopsRes.text().catch(() => "");
        console.error("[etsy callback] shops failed:", shopsRes.status, err);
        return cbError(base, `Could not fetch shop info (${shopsRes.status}: ${err.slice(0, 120)})`);
      }

      type ShopObj = { shop_id: number; shop_name: string; url: string; currency_code: string };
      const shopsData = await shopsRes.json() as ShopObj | { results: ShopObj[] };
      const shop: ShopObj | undefined =
        "shop_id" in shopsData ? shopsData : (shopsData as { results: ShopObj[] }).results?.[0];
      if (!shop) return cbError(base, "No Etsy shop found on this account");

      console.log("[etsy callback] shop identified:", shop.shop_id, shop.shop_name);

      await prisma.etsyConnection.upsert({
        where: { shopId: String(shop.shop_id) },
        create: {
          shopId: String(shop.shop_id),
          shopName: shop.shop_name,
          shopUrl: shop.url,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
          currencyCode: shop.currency_code ?? "USD",
          isActive: true,
        },
        update: {
          shopName: shop.shop_name,
          shopUrl: shop.url,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
          isActive: true,
        },
      });

      console.log("[etsy callback] connection saved, redirecting to /publishing");
      return NextResponse.redirect(`${base}/publishing?connected=etsy`);
    } catch {
      return cbError(base, "OAuth flow failed");
    }
  }

  // ── Protected actions (require x-api-key via proxy) ───────────────────────
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
      let apiKey: string;
      try { apiKey = resolveEtsyApiKey(); } catch {
        return NextResponse.json({ success: false, error: "ETSY_API_KEY env var not configured" }, { status: 500 });
      }
      const redirectUri = process.env.ETSY_REDIRECT_URI;
      if (!redirectUri) {
        return NextResponse.json({ success: false, error: "ETSY_REDIRECT_URI env var not configured" }, { status: 500 });
      }
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = buildOAuthState(verifier);
      const authUrl = `${ETSY_AUTH_BASE}?response_type=code&client_id=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(ETSY_SCOPES)}&state=${encodeURIComponent(state)}&code_challenge=${challenge}&code_challenge_method=S256`;
      return NextResponse.json({ success: true, data: { authUrl } });
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
                data: { views: match.views, favorites: match.num_favorers, lastSyncAt: new Date() },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function cbError(base: string, msg: string): NextResponse {
  return NextResponse.redirect(`${base}/publishing?etsy_error=${encodeURIComponent(msg)}`);
}

function jwtUserId(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const id = decoded.user_id ?? decoded.userId ?? decoded.sub;
    return id != null ? String(id) : undefined;
  } catch {
    return undefined;
  }
}
