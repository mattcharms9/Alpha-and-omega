import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ETSY_BASE = "https://openapi.etsy.com/v3";

export interface EtsySearchIntelligence {
  keywords: string[];
  totalListingsEstimate: number;
  avgPrice: number;
  priceRange: { min: number; max: number };
  topTags: string[];
  competitionLevel: "low" | "medium" | "high" | "saturated";
  avgFavorites: number;
  opportunityScore: number;
  fetchedAt: string;
}

export interface CompetitionScore {
  keyword: string;
  listingCount: number;
  avgReviews: number;
  avgPrice: number;
  level: "low" | "medium" | "high" | "saturated";
}

interface EtsyListingResult {
  listing_id: number;
  title: string;
  price: { amount: number; divisor: number };
  num_favorers: number;
  tags: string[];
  quantity: number;
}

function cacheKeyFor(action: string, params: string): string {
  return createHash("md5").update(`${action}:${params}`).digest("hex");
}

async function getCached<T>(key: string): Promise<T | null> {
  const entry = await prisma.etsySearchCache.findUnique({
    where: { cacheKey: key },
  });
  if (!entry || entry.expiresAt < new Date()) return null;
  return entry.data as T;
}

async function setCache(key: string, data: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await prisma.etsySearchCache.upsert({
    where: { cacheKey: key },
    create: { cacheKey: key, data: data as Prisma.InputJsonValue, expiresAt },
    update: { data: data as Prisma.InputJsonValue, fetchedAt: new Date(), expiresAt },
  });
}

async function etsyGet(path: string): Promise<Response | null> {
  const apiKey = process.env.ETSY_API_KEY;
  if (!apiKey) return null;
  return fetch(`${ETSY_BASE}${path}`, {
    headers: { "x-api-key": apiKey },
  });
}

export async function fetchEtsySearchIntelligence(
  keywords: string[]
): Promise<EtsySearchIntelligence> {
  const key = cacheKeyFor("search-intel", keywords.join(","));
  const cached = await getCached<EtsySearchIntelligence>(key);
  if (cached) return cached;

  const allListings: EtsyListingResult[] = [];
  let totalListings = 0;

  for (const keyword of keywords.slice(0, 3)) {
    const res = await etsyGet(
      `/application/listings/active?keywords=${encodeURIComponent(keyword)}&limit=20&sort_on=score`
    );
    if (!res?.ok) continue;
    const data = await res.json() as { count: number; results: EtsyListingResult[] };
    totalListings += data.count ?? 0;
    allListings.push(...(data.results ?? []));
  }

  if (allListings.length === 0) {
    return buildFallback(keywords);
  }

  const prices = allListings.map((l) => l.price.amount / l.price.divisor).filter((p) => p > 0);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 10;
  const avgFavorites =
    allListings.reduce((a, b) => a + (b.num_favorers ?? 0), 0) / allListings.length;

  const tagFreq: Record<string, number> = {};
  for (const l of allListings) {
    for (const tag of l.tags ?? []) {
      tagFreq[tag] = (tagFreq[tag] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 13)
    .map(([tag]) => tag);

  const level = competitionLevel(totalListings);
  const opportunityScore = computeOpportunityScore(totalListings, avgFavorites, avgPrice);

  const result: EtsySearchIntelligence = {
    keywords,
    totalListingsEstimate: totalListings,
    avgPrice: Math.round(avgPrice * 100) / 100,
    priceRange: {
      min: Math.min(...prices, 0),
      max: Math.max(...prices, 0),
    },
    topTags,
    competitionLevel: level,
    avgFavorites: Math.round(avgFavorites),
    opportunityScore,
    fetchedAt: new Date().toISOString(),
  };

  await setCache(key, result);
  return result;
}

export async function fetchEtsyTrendingSearches(category: string): Promise<string[]> {
  const key = cacheKeyFor("trending", category);
  const cached = await getCached<string[]>(key);
  if (cached) return cached;

  const res = await etsyGet(
    `/application/listings/active?keywords=${encodeURIComponent(category)}&limit=50&sort_on=score`
  );
  if (!res?.ok) return [];

  const data = await res.json() as { results: EtsyListingResult[] };
  const tagFreq: Record<string, number> = {};
  for (const listing of data.results ?? []) {
    for (const tag of listing.tags ?? []) {
      tagFreq[tag] = (tagFreq[tag] ?? 0) + 1;
    }
  }

  const trends = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag]) => tag);

  await setCache(key, trends);
  return trends;
}

export async function fetchEtsyCompetitionScore(keyword: string): Promise<CompetitionScore> {
  const key = cacheKeyFor("competition", keyword);
  const cached = await getCached<CompetitionScore>(key);
  if (cached) return cached;

  const res = await etsyGet(
    `/application/listings/active?keywords=${encodeURIComponent(keyword)}&limit=20&sort_on=score`
  );

  if (!res?.ok) {
    return { keyword, listingCount: 0, avgReviews: 0, avgPrice: 0, level: "low" };
  }

  const data = await res.json() as { count: number; results: EtsyListingResult[] };
  const listings = data.results ?? [];
  const count = data.count ?? 0;
  const prices = listings.map((l) => l.price.amount / l.price.divisor).filter((p) => p > 0);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const result: CompetitionScore = {
    keyword,
    listingCount: count,
    avgReviews: 0,
    avgPrice: Math.round(avgPrice * 100) / 100,
    level: competitionLevel(count),
  };

  await setCache(key, result);
  return result;
}

function competitionLevel(count: number): "low" | "medium" | "high" | "saturated" {
  if (count < 500) return "low";
  if (count < 2000) return "medium";
  if (count < 5000) return "high";
  return "saturated";
}

function computeOpportunityScore(listings: number, avgFav: number, avgPrice: number): number {
  const compScore = listings < 500 ? 90 : listings < 2000 ? 70 : listings < 5000 ? 40 : 15;
  const favScore = Math.min(avgFav / 100, 1) * 10;
  const priceScore = Math.min(avgPrice / 20, 1) * 10;
  return Math.round(Math.min(100, compScore + favScore + priceScore));
}

function buildFallback(keywords: string[]): EtsySearchIntelligence {
  return {
    keywords,
    totalListingsEstimate: 0,
    avgPrice: 0,
    priceRange: { min: 0, max: 0 },
    topTags: [],
    competitionLevel: "low",
    avgFavorites: 0,
    opportunityScore: 50,
    fetchedAt: new Date().toISOString(),
  };
}
