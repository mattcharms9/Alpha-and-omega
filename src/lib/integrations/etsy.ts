import { prisma } from "@/lib/db/prisma";
import { log } from "@/lib/logger";

export const ETSY_BASE = "https://openapi.etsy.com/v3";

export const ETSY_SCOPES = [
  "listings_r", "listings_w", "listings_d",
  "transactions_r",
  "shops_r",
  "profile_r",
  "email_r",
].join(" ");

// ── PKCE helpers ─────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const array = new Uint8Array(64);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 64; i++) array[i] = Math.floor(Math.random() * 256);
  }
  for (const byte of array) result += chars[byte % chars.length];
  return result;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  url: string;
  currency_code: string;
}

export interface EtsyListingResponse {
  listing_id: number;
  title: string;
  state: string;
  url: string;
  price: { amount: number; divisor: number };
  tags: string[];
  num_favorers: number;
  views: number;
}

export interface EtsyFileResponse {
  listing_file_id: number;
  filename: string;
}

export interface EtsyImageResponse {
  listing_image_id: number;
  url_fullxfull: string;
}

export interface EtsyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface EtsyListingStats {
  listing_id: number;
  views: number;
  num_favorers: number;
  shares: number;
}

export interface CreateListingParams {
  title: string;
  description: string;
  price: number;
  tags: string[];
  quantity: number;
  is_digital: boolean;
  who_made: string;
  when_made: string;
  taxonomy_id?: number;
}

export interface EtsyTokenContext {
  token: string;
  shopId: string;
  connectionId: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** Resolves the API key from either env var name so Vercel + local both work. */
export function resolveEtsyApiKey(): string {
  const key = process.env.ETSY_CLIENT_ID ?? process.env.ETSY_API_KEY;
  if (!key) throw new Error("ETSY_CLIENT_ID (or ETSY_API_KEY) env var is not set");
  return key;
}

async function etsyFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const clientId = resolveEtsyApiKey();

  const res = await fetch(`${ETSY_BASE}${path}`, {
    ...options,
    headers: {
      "x-api-key": clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy API error ${res.status}: ${text}`);
  }
  return res;
}

export async function getShop(accessToken: string, shopId: string): Promise<EtsyShop> {
  const res = await etsyFetch(`/application/shops/${shopId}`, accessToken);
  return res.json() as Promise<EtsyShop>;
}

export async function createDraftListing(
  accessToken: string,
  shopId: string,
  params: CreateListingParams
): Promise<EtsyListingResponse> {
  const res = await etsyFetch(`/application/shops/${shopId}/listings`, accessToken, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json() as Promise<EtsyListingResponse>;
}

export async function uploadListingFile(
  accessToken: string,
  shopId: string,
  listingId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<EtsyFileResponse> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
  formData.append("file", blob, filename);

  const clientId = resolveEtsyApiKey();

  const res = await fetch(
    `${ETSY_BASE}/application/shops/${shopId}/listings/${listingId}/files`,
    {
      method: "POST",
      headers: {
        "x-api-key": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy file upload error ${res.status}: ${text}`);
  }
  return res.json() as Promise<EtsyFileResponse>;
}

export async function uploadListingImage(
  accessToken: string,
  shopId: string,
  listingId: string,
  imageBuffer: Buffer,
  filename: string
): Promise<EtsyImageResponse> {
  const formData = new FormData();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("image", blob, filename);

  const clientId = resolveEtsyApiKey();

  const res = await fetch(
    `${ETSY_BASE}/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: "POST",
      headers: {
        "x-api-key": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy image upload error ${res.status}: ${text}`);
  }
  return res.json() as Promise<EtsyImageResponse>;
}

export async function activateListing(
  accessToken: string,
  shopId: string,
  listingId: string
): Promise<EtsyListingResponse> {
  const res = await etsyFetch(
    `/application/shops/${shopId}/listings/${listingId}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ state: "active" }) }
  );
  return res.json() as Promise<EtsyListingResponse>;
}

export async function updateListing(
  accessToken: string,
  shopId: string,
  listingId: string,
  params: Partial<CreateListingParams>
): Promise<EtsyListingResponse> {
  const res = await etsyFetch(
    `/application/shops/${shopId}/listings/${listingId}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify(params) }
  );
  return res.json() as Promise<EtsyListingResponse>;
}

export async function deleteListing(
  accessToken: string,
  shopId: string,
  listingId: string
): Promise<void> {
  await etsyFetch(
    `/application/shops/${shopId}/listings/${listingId}`,
    accessToken,
    { method: "DELETE" }
  );
}

export async function getShopListings(
  accessToken: string,
  shopId: string,
  limit = 25,
  offset = 0
): Promise<EtsyListingResponse[]> {
  const res = await etsyFetch(
    `/application/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}`,
    accessToken
  );
  const data = await res.json() as { results: EtsyListingResponse[] };
  return data.results ?? [];
}

export async function refreshEtsyToken(refreshToken: string): Promise<EtsyTokenResponse> {
  const clientId = resolveEtsyApiKey();

  const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy token refresh failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<EtsyTokenResponse>;
}

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Returns a valid token+shopId for the active Etsy connection, refreshing
 * automatically if expired. On unrecoverable refresh failure, deactivates
 * the connection and creates a StrategicAlert.
 */
export async function getValidEtsyToken(): Promise<EtsyTokenContext> {
  const connection = await prisma.etsyConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new Error("No Etsy shop connected");

  if (connection.tokenExpiry > new Date()) {
    return { token: connection.accessToken, shopId: connection.shopId, connectionId: connection.id };
  }

  log({ level: "info", route: "/lib/integrations/etsy", action: "token-refresh", status: 200 });

  try {
    const tokenData = await refreshEtsyToken(connection.refreshToken);
    const expiry = new Date(Date.now() + tokenData.expires_in * 1000);
    await prisma.etsyConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: expiry,
      },
    });
    return { token: tokenData.access_token, shopId: connection.shopId, connectionId: connection.id };
  } catch (err) {
    // Deactivate the connection so UI shows "not connected" and prompts reconnect
    await prisma.etsyConnection.update({
      where: { id: connection.id },
      data: { isActive: false },
    }).catch(() => {});

    // Non-fatal alert so Matt knows to reconnect
    await prisma.strategicAlert.create({
      data: {
        type: "risk",
        title: "Etsy Token Expired",
        body: "Your Etsy access token could not be refreshed. Go to Publishing and reconnect your shop.",
        actionLabel: "Reconnect",
        actionHref: "/publishing",
      },
    }).catch(() => {});

    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Etsy token refresh failed — please reconnect your shop (${msg})`);
  }
}

/** Convenience wrapper for callers that only need a single API call. */
export async function withEtsyToken<T>(
  fn: (token: string, shopId: string) => Promise<T>
): Promise<T> {
  const { token, shopId } = await getValidEtsyToken();
  return fn(token, shopId);
}
