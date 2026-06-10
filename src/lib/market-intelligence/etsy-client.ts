import { ETSY_BASE } from "@/lib/integrations/etsy";
import type { TopSellerListing, RisingListing, PricePoint } from "./types";

function buildPublicHeaders(): Record<string, string> {
  const key = process.env.ETSY_API_KEY;
  if (!key) throw new Error("ETSY_API_KEY not set");
  return { "x-api-key": key };
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface EtsyListingRaw {
  listing_id: number;
  title: string;
  state: string;
  price?: { amount: number; divisor: number };
  tags?: string[];
  num_favorers?: number;
  views?: number;
  creation_timestamp?: number;
  shop?: { shop_name: string };
  images?: Array<{ url_fullxfull: string }>;
  num_reviews?: number;
  quantity?: number;
}

interface EtsySearchResponse {
  results: EtsyListingRaw[];
  count: number;
}

async function etsySearch(
  query: string,
  sortOn: "score" | "created",
  limit: number,
  minPrice?: number,
  maxPrice?: number
): Promise<EtsyListingRaw[]> {
  const params = new URLSearchParams({
    keywords: query,
    sort_on: sortOn,
    limit: String(limit),
    type: "digital",
  });
  if (minPrice !== undefined) params.set("min_price", String(minPrice));
  if (maxPrice !== undefined) params.set("max_price", String(maxPrice));

  const url = `${ETSY_BASE}/application/listings/active?${params}`;
  const headers = buildPublicHeaders();

  let res = await fetch(url, { headers });

  if (res.status === 429) {
    await delay(2000);
    res = await fetch(url, { headers });
    if (res.status === 429) {
      console.warn(`[etsy-client] Rate limited twice on query "${query}", skipping`);
      return [];
    }
  }

  if (!res.ok) {
    console.warn(`[etsy-client] Search failed for "${query}": ${res.status}`);
    return [];
  }

  const data = (await res.json()) as EtsySearchResponse;
  return data.results ?? [];
}

async function fetchListingDetails(listingId: number): Promise<EtsyListingRaw | null> {
  await delay(100);
  const url = `${ETSY_BASE}/application/listings/${listingId}?includes=images,shop`;
  const res = await fetch(url, { headers: buildPublicHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as EtsyListingRaw;
}

function daysAgo(timestamp: number): number {
  return Math.floor((Date.now() - timestamp * 1000) / (1000 * 60 * 60 * 24));
}

function reviewVelocity(reviews: number, daysListed: number): number {
  if (daysListed < 1) return 0;
  return parseFloat((reviews / (daysListed / 30)).toFixed(2));
}

export async function searchTopListings(
  query: string,
  limit = 25
): Promise<TopSellerListing[]> {
  const raw = await etsySearch(query, "score", Math.min(limit, 25));
  if (raw.length === 0) return [];

  // Phase 2: fetch full details for the top 10 by favorers
  const sorted = [...raw].sort((a, b) => (b.num_favorers ?? 0) - (a.num_favorers ?? 0));
  const toDetail = sorted.slice(0, 10);

  const detailed: EtsyListingRaw[] = [];
  for (const listing of toDetail) {
    await delay(100);
    const detail = await fetchListingDetails(listing.listing_id);
    detailed.push(detail ?? listing);
  }

  // Merge detailed back with rest
  const detailMap = new Map(detailed.map((d) => [d.listing_id, d]));
  const merged = raw.map((r) => detailMap.get(r.listing_id) ?? r);

  return merged
    .sort((a, b) => (b.num_reviews ?? 0) - (a.num_reviews ?? 0))
    .slice(0, limit)
    .map((l) => {
      const price = l.price ? l.price.amount / l.price.divisor : 0;
      const days = l.creation_timestamp ? daysAgo(l.creation_timestamp) : 365;
      const reviews = l.num_reviews ?? 0;
      return {
        listingId: String(l.listing_id),
        title: l.title ?? "",
        price,
        reviewCount: reviews,
        favoritesCount: l.num_favorers ?? 0,
        tags: l.tags ?? [],
        imageUrl: l.images?.[0]?.url_fullxfull ?? "",
        shopName: l.shop?.shop_name ?? "",
        daysListed: days,
        reviewVelocity: reviewVelocity(reviews, days),
      };
    });
}

export async function searchRisingListings(
  query: string,
  limit = 15
): Promise<RisingListing[]> {
  // Search recent listings (last 90 days) sorted by creation date
  const raw = await etsySearch(query, "created", 25);
  if (raw.length === 0) return [];

  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  const recent = raw.filter(
    (l) => l.creation_timestamp && l.creation_timestamp * 1000 >= ninetyDaysAgo
  );

  return recent
    .map((l) => {
      const price = l.price ? l.price.amount / l.price.divisor : 0;
      const days = l.creation_timestamp ? daysAgo(l.creation_timestamp) : 30;
      const reviews = l.num_reviews ?? 0;
      const favorites = l.num_favorers ?? 0;
      const momentum = favorites / Math.max(reviews, 1) / Math.sqrt(Math.max(days, 1));
      return {
        listingId: String(l.listing_id),
        title: l.title ?? "",
        price,
        reviewCount: reviews,
        favoritesCount: favorites,
        tags: l.tags ?? [],
        imageUrl: l.images?.[0]?.url_fullxfull ?? "",
        daysListed: days,
        momentumScore: parseFloat(momentum.toFixed(3)),
      };
    })
    .sort((a, b) => b.momentumScore - a.momentumScore)
    .slice(0, limit);
}

export async function getPriceDistribution(query: string): Promise<PricePoint[]> {
  const raw = await etsySearch(query, "score", 25);
  if (raw.length === 0) return [];

  const buckets: Record<string, number> = {};
  for (const l of raw) {
    if (!l.price) continue;
    const price = l.price.amount / l.price.divisor;
    const bucket = Math.round(price / 2) * 2; // round to nearest $2
    const key = String(bucket);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  return Object.entries(buckets)
    .map(([price, count]) => ({
      price: Number(price),
      count,
      percentOfTop50: parseFloat(((count / raw.length) * 100).toFixed(1)),
    }))
    .sort((a, b) => a.price - b.price);
}

export async function getListingCount(query: string): Promise<number> {
  const params = new URLSearchParams({
    keywords: query,
    sort_on: "score",
    limit: "1",
    type: "digital",
  });
  const url = `${ETSY_BASE}/application/listings/active?${params}`;
  const res = await fetch(url, { headers: buildPublicHeaders() });
  if (!res.ok) return 0;
  const data = (await res.json()) as { count?: number };
  return data.count ?? 0;
}
