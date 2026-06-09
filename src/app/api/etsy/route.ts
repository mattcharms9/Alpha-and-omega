import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { buildOAuthState, extractVerifierFromState } from "@/lib/etsy-state";
import {
  getEtsyApiKey,
  getEtsyUser,
  getEtsyShop,
  generateCodeVerifier,
  generateCodeChallenge,
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
  const action = reqUrl.searchParams.get("action");
  const base = `${reqUrl.protocol}//${reqUrl.host}`;

  // ── OAuth callback (public — no API key needed) ───────────────────────────
  if (action === "callback") {
    const code = reqUrl.searchParams.get("code");
    const returnedState = reqUrl.searchParams.get("state");
    const etsyErr = reqUrl.searchParams.get("error");

    if (etsyErr) {
      console.error("[etsy callback] Etsy returned error:", etsyErr);
      return err(base, `Etsy denied access: ${etsyErr}`);
    }
    if (!code) return err(base, "No authorization code — check redirect_uri in Etsy developer portal");
    if (!returnedState) return err(base, "No state parameter returned from Etsy");

    // Verifier is AES-encrypted inside the state — no cookie or DB needed
    const verifier = extractVerifierFromState(returnedState);
    if (!verifier) return err(base, "Invalid OAuth state — please try connecting again");

    let apiKey: string;
    try {
      apiKey = getEtsyApiKey();
    } catch {
      return err(base, "ETSY_API_KEY is not configured on this server");
    }

    const redirectUri = process.env.ETSY_REDIRECT_URI;
    if (!redirectUri) return err(base, "ETSY_REDIRECT_URI is not configured on this server");

    console.log("[etsy callback] api_key_prefix:", apiKey.slice(0, 8), "redirect_uri:", redirectUri);

    try {
      // 1. Exchange code for tokens
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
        const body = await tokenRes.text().catch(() => "");
        console.error("[etsy callback] token exchange failed:", tokenRes.status, body);
        return err(base, `Token exchange failed (${tokenRes.status}: ${body.slice(0, 200)})`);
      }

      const tokenData = await tokenRes.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user_id?: number;
      };
      console.log("[etsy callback] token exchange success");

      // 2. Identify user — getEtsyUser uses buildEtsyHeaders which always
      //    reads ETSY_API_KEY fresh from process.env at call time
      let userId: number;
      let loginName = "";
      if (tokenData.user_id) {
        userId = tokenData.user_id;
        console.log("[etsy callback] user_id from token:", userId);
      } else {
        const userData = await getEtsyUser(tokenData.access_token);
        userId = userData.user_id;
        loginName = userData.login_name ?? "";
        console.log("[etsy callback] user identified:", userId, loginName);
      }

      // 3. Fetch shop
      let shopId = String(userId);
      let shopName = loginName;
      let shopUrl = `https://www.etsy.com/shop/${loginName}`;
      let currencyCode = "USD";
      try {
        const shop = await getEtsyShop(tokenData.access_token, userId);
        shopId = String(shop.shop_id);
        shopName = shop.shop_name;
        shopUrl = shop.url;
        currencyCode = shop.currency_code ?? "USD";
        console.log("[etsy callback] shop identified:", shopId, shopName);
      } catch (shopErr) {
        console.error("[etsy callback] shop fetch failed (non-fatal), using userId as fallback:", shopErr);
      }

      // 4. Save connection
      const expiry = new Date(Date.now() + tokenData.expires_in * 1000);
      await prisma.etsyConnection.upsert({
        where: { shopId },
        create: {
          shopId,
          shopName,
          shopUrl,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: expiry,
          currencyCode,
          isActive: true,
        },
        update: {
          shopName,
          shopUrl,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: expiry,
          isActive: true,
        },
      });

      console.log("[etsy callback] connection saved — redirecting to /publishing");
      return NextResponse.redirect(`${base}/publishing?connected=etsy`);
    } catch (e) {
      console.error("[etsy callback] unhandled error:", e);
      return err(base, "OAuth flow failed — check Vercel logs for details");
    }
  }

  // ── connect — browser navigation (no x-api-key needed, exempt in proxy) ──
  if (action === "connect") {
    let apiKey: string;
    try { apiKey = getEtsyApiKey(); } catch {
      return err(base, "ETSY_API_KEY env var not configured on this server");
    }
    const redirectUri = process.env.ETSY_REDIRECT_URI;
    if (!redirectUri) {
      return err(base, "ETSY_REDIRECT_URI env var not configured on this server");
    }

    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = buildOAuthState(verifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: apiKey,
      redirect_uri: redirectUri,
      scope: ETSY_SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    return NextResponse.redirect(`${ETSY_AUTH_BASE}?${params.toString()}`);
  }

  // ── Protected GET actions (require x-api-key header via proxy) ───────────
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
        where: { connectionId: conn.id, status: "active" }, take: 10,
      });

      const results = await withEtsyToken(async (token) =>
        Promise.allSettled(
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
        )
      );

      await prisma.etsyConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date() } });
      return NextResponse.json({ success: true, data: { synced: results.length } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function err(base: string, msg: string): NextResponse {
  return NextResponse.redirect(`${base}/publishing?etsy_error=${encodeURIComponent(msg)}`);
}
