import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { extractVerifierFromState } from "@/lib/etsy-state";

const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

// GET — receives redirect from Etsy OAuth; exchanges code for tokens
export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const { searchParams } = reqUrl;
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const base = `${reqUrl.protocol}//${reqUrl.host}`;

  const etsyError = searchParams.get("error");
  if (etsyError) return redirectWithError(base, `Etsy denied: ${etsyError}`);
  if (!code) return redirectWithError(base, "No auth code — check redirect_uri matches Etsy developer portal");
  if (!returnedState) return redirectWithError(base, "No state returned from Etsy");

  const verifier = extractVerifierFromState(returnedState);
  if (!verifier) return redirectWithError(base, "Invalid OAuth state — please try connecting again");

  const clientId = process.env.ETSY_CLIENT_ID;
  const redirectUri = process.env.ETSY_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return redirectWithError(base, "Etsy not configured");
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
      const errText = await tokenRes.text().catch(() => "");
      return redirectWithError(base, `Token exchange failed (${tokenRes.status}${errText ? `: ${errText.slice(0, 200)}` : ""})`);
    }

    const tokenData = await tokenRes.json() as {
      access_token: string; refresh_token: string; expires_in: number; user_id?: string | number;
    };

    // Etsy access tokens are JWTs — decode payload to get user_id without an extra API call
    const userId = tokenData.user_id ?? jwtUserId(tokenData.access_token);
    if (!userId) return redirectWithError(base, "Could not identify Etsy user from token");

    const shopsRes = await fetch(
      `https://openapi.etsy.com/v3/application/users/${userId}/shops`,
      {
        headers: {
          "x-api-key": clientId,
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!shopsRes.ok) {
      const errText = await shopsRes.text().catch(() => "");
      return redirectWithError(base, `Could not fetch shop info (${shopsRes.status}${errText ? `: ${errText.slice(0, 120)}` : ""})`);
    }

    type ShopObj = { shop_id: number; shop_name: string; url: string; currency_code: string };
    const shopsData = await shopsRes.json() as ShopObj | { results: ShopObj[] } | { count: number; results: ShopObj[] };

    const shop: ShopObj | undefined =
      "shop_id" in shopsData
        ? shopsData
        : "results" in shopsData
          ? shopsData.results[0]
          : undefined;
    if (!shop) return redirectWithError(base, "No Etsy shop found on this account");

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

    return NextResponse.redirect(`${base}/publishing?connected=etsy`);
  } catch {
    return redirectWithError(base, "OAuth flow failed");
  }
}

function redirectWithError(base: string, msg: string): NextResponse {
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
