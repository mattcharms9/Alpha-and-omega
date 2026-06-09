// Personal Access Token authentication — no OAuth flow.
// ETSY_API_KEY  = keystring from developer.etsy.com (goes in x-api-key header)
// ETSY_SHOP_ID  = your Etsy shop ID (numeric, found in your shop URL)

export const ETSY_BASE = "https://openapi.etsy.com/v3";

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function buildEtsyHeaders(): Record<string, string> {
  const keystring = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  if (!keystring) throw new Error("ETSY_API_KEY not set");
  if (!sharedSecret) throw new Error("ETSY_SHARED_SECRET not set");
  return {
    "x-api-key": `${keystring}:${sharedSecret}`,
    "Content-Type": "application/json",
  };
}

export function getEtsyShopId(): string {
  const shopId = process.env.ETSY_SHOP_ID;
  if (!shopId) throw new Error("ETSY_SHOP_ID not set");
  return shopId;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

export async function etsyFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = buildEtsyHeaders();
  const res = await fetch(`${ETSY_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy API ${res.status} on ${path}: ${text}`);
  }
  return res;
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

// ── API functions ─────────────────────────────────────────────────────────────

export async function getShop(shopId: string): Promise<EtsyShop> {
  const res = await etsyFetch(`/application/shops/${shopId}`);
  return res.json() as Promise<EtsyShop>;
}

export async function createDraftListing(
  shopId: string,
  params: CreateListingParams
): Promise<EtsyListingResponse> {
  const res = await etsyFetch(`/application/shops/${shopId}/listings`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json() as Promise<EtsyListingResponse>;
}

export async function uploadListingFile(
  shopId: string,
  listingId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<EtsyFileResponse> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" }), filename);

  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  if (!apiKey) throw new Error("ETSY_API_KEY not set");
  if (!sharedSecret) throw new Error("ETSY_SHARED_SECRET not set");

  const res = await fetch(
    `${ETSY_BASE}/application/shops/${shopId}/listings/${listingId}/files`,
    {
      method: "POST",
      headers: { "x-api-key": `${apiKey}:${sharedSecret}` },
      body: formData,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy file upload ${res.status}: ${text}`);
  }
  return res.json() as Promise<EtsyFileResponse>;
}

export async function uploadListingImage(
  shopId: string,
  listingId: string,
  imageBuffer: Buffer,
  filename: string
): Promise<EtsyImageResponse> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const formData = new FormData();
  formData.append("image", new Blob([new Uint8Array(imageBuffer)], { type: mimeType }), filename);

  const apiKey = process.env.ETSY_API_KEY;
  const sharedSecret = process.env.ETSY_SHARED_SECRET;
  if (!apiKey) throw new Error("ETSY_API_KEY not set");
  if (!sharedSecret) throw new Error("ETSY_SHARED_SECRET not set");

  const res = await fetch(
    `${ETSY_BASE}/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: "POST",
      headers: { "x-api-key": `${apiKey}:${sharedSecret}` },
      body: formData,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Etsy image upload ${res.status}: ${text}`);
  }
  return res.json() as Promise<EtsyImageResponse>;
}

export async function activateListing(shopId: string, listingId: string): Promise<EtsyListingResponse> {
  const res = await etsyFetch(`/application/shops/${shopId}/listings/${listingId}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "active" }),
  });
  return res.json() as Promise<EtsyListingResponse>;
}

export async function updateListing(
  shopId: string,
  listingId: string,
  params: Partial<CreateListingParams>
): Promise<EtsyListingResponse> {
  const res = await etsyFetch(`/application/shops/${shopId}/listings/${listingId}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
  return res.json() as Promise<EtsyListingResponse>;
}

export async function deleteListing(shopId: string, listingId: string): Promise<void> {
  await etsyFetch(`/application/shops/${shopId}/listings/${listingId}`, { method: "DELETE" });
}

export async function getShopListings(
  shopId: string,
  limit = 25,
  offset = 0
): Promise<EtsyListingResponse[]> {
  const res = await etsyFetch(
    `/application/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}`
  );
  const data = await res.json() as { results: EtsyListingResponse[] };
  return data.results ?? [];
}
