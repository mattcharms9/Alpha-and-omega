import { generateJSON } from "./claude";
import { prisma } from "@/lib/db/prisma";
import type { Product } from "@prisma/client";

export interface ProductRecommendation {
  product: Pick<Product, "id" | "title" | "descriptionShort" | "type" | "targetEmotion">;
  recommendationReason: string;
  emailSubjectLine: string;
  emailBodySnippet: string;
  discountCodeSuggested: boolean;
}

const SYSTEM_PROMPT = `You are a product recommendation engine for a digital product seller on Etsy.

When a customer buys one product, recommend the single best next product from the catalog that:
1. Addresses the next logical step in their emotional journey
2. Complements (not duplicates) what they already bought
3. Has a different format than their purchase (if they bought a journal, recommend a workbook or guide)

Your recommendation email copy must:
- Reference what they already bought naturally
- Explain specifically WHY this next product makes sense for them
- Be warm and helpful, not salesy
- Feel like a personal recommendation, not automated marketing

Return valid JSON.`;

export async function getNextProductRecommendation(
  purchasedProductId: string,
  buyerEmail: string
): Promise<ProductRecommendation | null> {
  const purchased = await prisma.product.findUnique({ where: { id: purchasedProductId } });
  if (!purchased) return null;

  // Check if buyer already repurchased
  const purchases = await prisma.revenueRecord.count({
    where: {
      // Note: We don't store buyer email on RevenueRecord, so check all records
      productId: { not: purchasedProductId },
    },
  });
  if (purchases === 0) {
    // No other purchases — safe to recommend
  }

  const catalog = await prisma.product.findMany({
    where: {
      deletedAt: null,
      status: { in: ["published_etsy", "published"] },
      id: { not: purchasedProductId },
    },
    select: { id: true, title: true, type: true, targetEmotion: true, descriptionShort: true },
    take: 15,
    orderBy: { totalRevenue: "desc" },
  });

  if (catalog.length === 0) return null;

  const catalogList = catalog.map((p) => `- ID:${p.id} | "${p.title}" | ${p.type} | ${p.targetEmotion}`).join("\n");

  const prompt = `A buyer just purchased: "${purchased.title}" (${purchased.type}, emotion: ${purchased.targetEmotion}).

Other products available in the catalog:
${catalogList}

Recommend the SINGLE best next product for this buyer. Return JSON:
{
  "productId": "ID from catalog",
  "recommendationReason": "2 sentences: why this is the perfect next step after buying the first product",
  "emailSubjectLine": "compelling email subject line (under 60 chars)",
  "emailBodySnippet": "2-3 sentences of warm, specific email copy recommending this product",
  "discountCodeSuggested": true/false (true if buyer hasn't repurchased and this is the Day-7 email)
}`;

  const result = await generateJSON<{ productId: string; recommendationReason: string; emailSubjectLine: string; emailBodySnippet: string; discountCodeSuggested: boolean }>(
    SYSTEM_PROMPT, prompt, 1000
  );

  const recommendedProduct = catalog.find((p) => p.id === result.productId) ?? catalog[0];
  if (!recommendedProduct) return null;

  return {
    product: recommendedProduct,
    recommendationReason: result.recommendationReason,
    emailSubjectLine: result.emailSubjectLine,
    emailBodySnippet: result.emailBodySnippet,
    discountCodeSuggested: result.discountCodeSuggested ?? false,
  };
}
