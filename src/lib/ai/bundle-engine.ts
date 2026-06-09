import { generateJSON } from "./claude";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface BundleOpportunity {
  name: string;
  productIds: string[];
  suggestedPrice: number;
  individualTotal: number;
  savingsPercent: number;
  emotionalJourney: string;
  targetBuyer: string;
  etsyTitle: string;
  etsyDescription: string;
  estimatedConversionLift: number;
  bundleScore: number;
  estimatedConversion: "high" | "medium" | "low";
  reasoning: string;
  bundleType: "emotional_journey" | "life_event" | "transformation";
}

const SYSTEM_PROMPT = `You are a digital product bundle strategist for Etsy.

Your job: identify the most compelling product bundles from a catalog. The best bundles:
1. Tell a coherent emotional journey (not random products thrown together)
2. Address the same buyer in different phases of their journey
3. Have a 20-35% savings vs buying individually (sweetspot for perceived value)
4. Use a title that sounds like a complete program, not a random collection

BUNDLE TYPES:
- emotional_journey: journal + workbook + guide on same emotional theme
- life_event: everything someone needs for one occasion (wedding, baby shower, graduation)
- transformation: beginner → intermediate → advanced on one topic

BUNDLE NAMING: Lead with the emotional transformation.
Good: "The Financial Clarity Bundle" or "Complete Wedding Party Pack"
Bad: "Journal + Checklist + Workbook Bundle"

For etsyDescription, write 100-150 words explaining what's included, who it's for, and the transformation it creates.

Return exactly 3 bundle opportunities as a JSON array.`;

// In-process cache: 24h
let _bundleCache: { ts: number; data: BundleOpportunity[] } | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function findBundleOpportunities(): Promise<BundleOpportunity[]> {
  if (_bundleCache && Date.now() - _bundleCache.ts < CACHE_TTL) {
    return _bundleCache.data;
  }

  const products = await prisma.product.findMany({
    where: { deletedAt: null, lifecycleStage: "active" },
    select: { id: true, title: true, type: true, targetEmotion: true, targetAudience: true, descriptionShort: true, pricingStrategy: true },
    take: 30,
    orderBy: { totalRevenue: "desc" },
  });

  if (products.length < 3) return [];

  const productList = products.map((p) => {
    const price = (p.pricingStrategy as { digitalPrice?: number } | null)?.digitalPrice ?? 9.99;
    return `- ID: ${p.id} | "${p.title}" | Type: ${p.type} | Emotion: ${p.targetEmotion} | Audience: ${p.targetAudience} | Price: $${price}`;
  }).join("\n");

  const prompt = `Here are ${products.length} active products from a digital seller's catalog:\n\n${productList}\n\nIdentify exactly 3 bundle opportunities — one of each type (emotional_journey, life_event, transformation). For each bundle, choose 2-4 products that form a natural emotional journey.\n\nReturn JSON array of 3 objects: { name, productIds, suggestedPrice, individualTotal, savingsPercent, emotionalJourney, targetBuyer, etsyTitle, etsyDescription (100-150 words), estimatedConversionLift (number 0-50), bundleScore (0-100), estimatedConversion ("high"/"medium"/"low"), reasoning, bundleType }`;

  const result = await generateJSON<{ bundles: BundleOpportunity[] } | BundleOpportunity[]>(
    SYSTEM_PROMPT, prompt, 4000
  );

  const bundles = Array.isArray(result) ? result : (result as { bundles: BundleOpportunity[] }).bundles ?? [];

  _bundleCache = { ts: Date.now(), data: bundles.slice(0, 3) };
  return _bundleCache.data;
}

export function invalidateBundleCache(): void {
  _bundleCache = null;
}

export async function generateBundleFromTheme(theme: string, productIds: string[]): Promise<BundleOpportunity> {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, title: true, type: true, targetEmotion: true, descriptionShort: true, pricingStrategy: true },
  });

  const productList = products.map((p) => {
    const price = (p.pricingStrategy as { digitalPrice?: number } | null)?.digitalPrice ?? 9.99;
    return `- ID: ${p.id} | "${p.title}" | $${price}`;
  }).join("\n");

  const prompt = `Create one compelling bundle for the theme "${theme}" from these products:\n${productList}\n\nReturn one JSON object: { name, productIds, suggestedPrice, individualTotal, savingsPercent, emotionalJourney, targetBuyer, etsyTitle, etsyDescription, estimatedConversionLift, bundleScore, estimatedConversion, reasoning, bundleType }`;

  return generateJSON<BundleOpportunity>(SYSTEM_PROMPT, prompt, 2000);
}

export async function saveBundleToDb(bundle: BundleOpportunity): Promise<string> {
  const saved = await prisma.bundle.create({
    data: {
      name: bundle.name,
      theme: bundle.emotionalJourney,
      bundlePrice: bundle.suggestedPrice,
      componentIds: bundle.productIds as Prisma.InputJsonValue,
      etsyTitle: bundle.etsyTitle,
      etsyDescription: bundle.etsyDescription,
      status: "draft",
    },
  });
  return saved.id;
}
