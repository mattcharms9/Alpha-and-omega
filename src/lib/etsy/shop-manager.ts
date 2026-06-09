import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/claude";

export interface ShopSection {
  name: string;
  listingIds: string[];
  theme: string;
}

export interface ShopHealthReport {
  totalListings: number;
  activeListings: number;
  draftListings: number;
  sections: ShopSection[];
  missingFromSections: string[];
  listingsWithLowQualityScore: string[];
  listingsWithNoImage: string[];
  listingsWithShortDescription: string[];
  zeroViewListings: string[];
  highViewLowSaleListings: string[];
  suggestedSections: string[];
  suggestedPriceAdjustments: { listingId: string; currentPrice: number; suggestedPrice: number }[];
  listingsToDeactivate: string[];
  shopHealthScore: number;
}

const SECTION_THEMES = [
  "Financial Wellness",
  "Life Transitions",
  "Party Games",
  "Wedding & Events",
  "Seasonal",
  "Bundles & Collections",
  "Self-Care & Healing",
  "Career & Productivity",
];

export async function getShopHealthReport(): Promise<ShopHealthReport> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const listings = await prisma.etsyListing.findMany({
    include: { product: { select: { id: true, title: true, coverImagePath: true, descriptionLong: true, listingQualityScore: true, targetEmotion: true, type: true, pricingStrategy: true } } },
  });

  const totalListings = listings.length;
  const activeListings = listings.filter((l) => l.status === "active").length;
  const draftListings = listings.filter((l) => l.status === "draft").length;

  const zeroViewListings = listings
    .filter((l) => l.views === 0 && l.publishedAt && l.publishedAt < thirtyDaysAgo)
    .map((l) => l.etsyListingId);

  const highViewLowSaleListings = listings
    .filter((l) => l.views > 50 && l.sales === 0)
    .map((l) => l.etsyListingId);

  const listingsToDeactivate = listings
    .filter((l) => l.views === 0 && l.sales === 0 && l.publishedAt && l.publishedAt < sixtyDaysAgo)
    .map((l) => l.etsyListingId);

  const listingsWithLowQualityScore = listings
    .filter((l) => l.product?.listingQualityScore !== null && (l.product?.listingQualityScore ?? 100) < 75)
    .map((l) => l.etsyListingId);

  const listingsWithNoImage = listings
    .filter((l) => !l.product?.coverImagePath)
    .map((l) => l.etsyListingId);

  const listingsWithShortDescription = listings
    .filter((l) => (l.product?.descriptionLong ?? "").split(/\s+/).length < 200)
    .map((l) => l.etsyListingId);

  // Organize into sections by emotion/type
  const sections: ShopSection[] = SECTION_THEMES.map((name) => ({
    name,
    theme: name.toLowerCase(),
    listingIds: [] as string[],
  }));

  listings.forEach((l) => {
    const emotion = (l.product?.targetEmotion ?? "").toLowerCase();
    const type = (l.product?.type ?? "").toLowerCase();
    let assigned = false;

    if (type.includes("game") || type.includes("bingo") || type.includes("trivia") || type.includes("party")) {
      sections[2]!.listingIds.push(l.etsyListingId); assigned = true;
    } else if (emotion.includes("wedding") || emotion.includes("bride") || type.includes("wedding")) {
      sections[3]!.listingIds.push(l.etsyListingId); assigned = true;
    } else if (emotion.includes("financial") || emotion.includes("money") || emotion.includes("debt")) {
      sections[0]!.listingIds.push(l.etsyListingId); assigned = true;
    } else if (emotion.includes("grief") || emotion.includes("loss") || emotion.includes("healing") || emotion.includes("recovery")) {
      sections[6]!.listingIds.push(l.etsyListingId); assigned = true;
    } else if (emotion.includes("career") || emotion.includes("burnout") || emotion.includes("productivity")) {
      sections[7]!.listingIds.push(l.etsyListingId); assigned = true;
    } else if (emotion.includes("transition") || emotion.includes("change") || emotion.includes("divorce")) {
      sections[1]!.listingIds.push(l.etsyListingId); assigned = true;
    }

    if (!assigned) sections[4]!.listingIds.push(l.etsyListingId);
  });

  const nonEmptySections = sections.filter((s) => s.listingIds.length > 0);
  const missingFromSections: string[] = [];

  // Compute health score
  let score = 100;
  if (zeroViewListings.length > 0) score -= Math.min(zeroViewListings.length * 3, 20);
  if (listingsWithLowQualityScore.length > 0) score -= Math.min(listingsWithLowQualityScore.length * 2, 15);
  if (listingsWithNoImage.length > 0) score -= Math.min(listingsWithNoImage.length * 5, 20);
  if (listingsWithShortDescription.length > 0) score -= Math.min(listingsWithShortDescription.length * 2, 15);
  score = Math.max(Math.round(score), 0);

  return {
    totalListings,
    activeListings,
    draftListings,
    sections: nonEmptySections,
    missingFromSections,
    listingsWithLowQualityScore,
    listingsWithNoImage,
    listingsWithShortDescription,
    zeroViewListings,
    highViewLowSaleListings,
    suggestedSections: SECTION_THEMES,
    suggestedPriceAdjustments: [],
    listingsToDeactivate,
    shopHealthScore: score,
  };
}

export async function getSEORefreshTargets(): Promise<string[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const listings = await prisma.etsyListing.findMany({
    where: { views: 0, status: "active", publishedAt: { lt: thirtyDaysAgo } },
    select: { etsyListingId: true },
    take: 20,
  });
  return listings.map((l) => l.etsyListingId);
}

export async function suggestPriceAdjustments(): Promise<ShopHealthReport["suggestedPriceAdjustments"]> {
  const listings = await prisma.etsyListing.findMany({
    where: { status: "active" },
    include: { product: { select: { pricingStrategy: true } } },
    take: 20,
  });

  const products = listings.map((l) => ({
    listingId: l.etsyListingId,
    currentPrice: l.price,
    views: l.views,
    sales: l.sales,
    etsyAvgPrice: l.price,
  }));

  if (products.length === 0) return [];

  const result = await generateJSON<{ adjustments: ShopHealthReport["suggestedPriceAdjustments"] }>(
    "You are a pricing strategist for Etsy digital products.",
    `Based on these listing performances, suggest price adjustments (±$2-5 moves only). High views + no sales = price may be too high. No views = SEO problem, not price.\n\nListings: ${JSON.stringify(products)}\n\nReturn: { adjustments: [{ listingId, currentPrice, suggestedPrice }] }`,
    1000
  ).catch(() => ({ adjustments: [] }));

  return result.adjustments ?? [];
}
