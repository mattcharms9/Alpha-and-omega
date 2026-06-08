import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

// GET — receives redirect from Etsy OAuth; exchanges code for tokens
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");

  const verifier = req.cookies.get("etsy_pkce_verifier")?.value;
  const expectedState = req.cookies.get("etsy_pkce_state")?.value;

  if (!code || !verifier) {
    return redirectWithError("Missing OAuth code or PKCE verifier");
  }
  if (expectedState && returnedState !== expectedState) {
    return redirectWithError("State mismatch — possible CSRF attack");
  }

  const clientId = process.env.ETSY_CLIENT_ID;
  const redirectUri = process.env.ETSY_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return redirectWithError("Etsy not configured");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(ETSY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithError("Token exchange failed");
    }

    const tokenData = await tokenRes.json() as {
      access_token: string; refresh_token: string; expires_in: number;
    };

    // Get user's shops
    const shopsRes = await fetch(
      "https://openapi.etsy.com/v3/application/users/me/shops?limit=1",
      {
        headers: {
          "x-api-key": clientId,
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!shopsRes.ok) return redirectWithError("Could not fetch shop info");

    const shopsData = await shopsRes.json() as {
      results: Array<{ shop_id: number; shop_name: string; url: string; currency_code: string }>;
    };

    const shop = shopsData.results[0];
    if (!shop) return redirectWithError("No Etsy shop found on this account");

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.etsyConnection.upsert({
      where: { shopId: String(shop.shop_id) },
      create: {
        shopId: String(shop.shop_id),
        shopName: shop.shop_name,
        shopUrl: shop.url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: expiry,
        currencyCode: shop.currency_code ?? "USD",
        isActive: true,
      },
      update: {
        shopName: shop.shop_name,
        shopUrl: shop.url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: expiry,
        isActive: true,
      },
    });

    const res = NextResponse.redirect(new URL("/publishing?connected=etsy", req.url));
    res.cookies.delete("etsy_pkce_verifier");
    res.cookies.delete("etsy_pkce_state");
    return res;
  } catch {
    return redirectWithError("OAuth flow failed");
  }
}

function redirectWithError(msg: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3090";
  return NextResponse.redirect(`${base}/publishing?etsy_error=${encodeURIComponent(msg)}`);
}
