import { generateJSON } from "./claude";
import { prisma } from "@/lib/db/prisma";

export interface BundleOpportunity {
  name: string;
  productIds: string[];
  suggestedPrice: number;
  individualTotal: number;
  savingsPercent: number;
  emotionalJourney: string;
  targetBuyer: string;
  etsyTitle: string;
  estimatedConversion: "high" | "medium" | "low";
  reasoning: string;
}

const SYSTEM_PROMPT = `You are a digital product bundle strategist for Etsy.

Your job: identify the most compelling product bundles from a catalog. The best bundles:
1. Tell a coherent emotional journey (not random products thrown together)
2. Address the same buyer in different phases of their journey
3. Have a 20-35% savings vs buying individually (sweetspot for perceived value)
4. Use a title that sounds like a complete program, not a random collection

BUNDLE NAMING: Lead with the emotional transformation, not the product types.
Good: "The New Homeowner Survival Kit"
Bad: "Journal + Checklist + Workbook Bundle"

Return exactly 3 bundle opportunities.`;

// In-process cache: 48h
let _bundleCache: { ts: number; data: BundleOpportunity[] } | null = null;
const CACHE_TTL = 48 * 60 * 60 * 1000;

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

  const prompt = `Here are ${products.length} active products from a digital seller's catalog:

${productList}

Identify exactly 3 bundle opportunities. For each bundle, choose 2-4 products that form a natural emotional journey for the same buyer.

Return JSON array of 3 objects: { name, productIds (array of IDs), suggestedPrice, individualTotal, savingsPercent, emotionalJourney (the narrative connecting them), targetBuyer, etsyTitle, estimatedConversion ("high"/"medium"/"low"), reasoning }`;

  const result = await generateJSON<{ bundles: BundleOpportunity[] } | BundleOpportunity[]>(
    SYSTEM_PROMPT, prompt, 3000
  );

  const bundles = Array.isArray(result) ? result : (result as { bundles: BundleOpportunity[] }).bundles ?? [];

  _bundleCache = { ts: Date.now(), data: bundles.slice(0, 3) };
  return _bundleCache.data;
}
