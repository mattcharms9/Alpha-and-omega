import { prisma } from "@/lib/db/prisma";

export interface RepricingRule {
  id: string;
  name: string;
  condition: {
    minViews: number;
    maxConversionRate: number;
    minDaysLive: number;
    maxCurrentPrice: number;
  };
  action: {
    type: "reduce_by_amount" | "reduce_by_percent" | "set_price";
    value: number;
    minPrice: number;
  };
  platforms: string[];
  maxApplicationsPerProduct: number;
}

export interface RepricingRecommendation {
  productId: string;
  title: string;
  platform: string;
  currentPrice: number;
  newPrice: number;
  rule: RepricingRule;
  reason: string;
}

export const DEFAULT_REPRICING_RULES: RepricingRule[] = [
  {
    id: "stale-journal",
    name: "Reduce stale journal price",
    condition: {
      minViews: 50,
      maxConversionRate: 0.005,
      minDaysLive: 21,
      maxCurrentPrice: 16,
    },
    action: { type: "reduce_by_amount", value: 2, minPrice: 9 },
    platforms: ["etsy", "gumroad"],
    maxApplicationsPerProduct: 2,
  },
  {
    id: "stale-workbook",
    name: "Reduce stale workbook price",
    condition: {
      minViews: 30,
      maxConversionRate: 0.005,
      minDaysLive: 21,
      maxCurrentPrice: 24,
    },
    action: { type: "reduce_by_amount", value: 3, minPrice: 12 },
    platforms: ["etsy", "gumroad"],
    maxApplicationsPerProduct: 2,
  },
  {
    id: "stale-planner",
    name: "Reduce stale planner price",
    condition: {
      minViews: 40,
      maxConversionRate: 0.005,
      minDaysLive: 21,
      maxCurrentPrice: 20,
    },
    action: { type: "reduce_by_amount", value: 2, minPrice: 10 },
    platforms: ["etsy", "gumroad"],
    maxApplicationsPerProduct: 2,
  },
];

function computeNewPrice(currentPrice: number, rule: RepricingRule): number {
  const { action } = rule;
  let newPrice: number;
  if (action.type === "reduce_by_amount") {
    newPrice = currentPrice - action.value;
  } else if (action.type === "reduce_by_percent") {
    newPrice = currentPrice * (1 - action.value / 100);
  } else {
    newPrice = action.value;
  }
  return Math.max(newPrice, action.minPrice);
}

export async function evaluateRepricingRules(
  rules: RepricingRule[] = DEFAULT_REPRICING_RULES
): Promise<RepricingRecommendation[]> {
  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: { not: "archived" } },
    select: {
      id: true,
      title: true,
      type: true,
      totalSales: true,
      createdAt: true,
      repricingApplications: true,
      listingVariants: {
        where: { isActive: true },
        select: { impressions: true, platform: true, price: true, clicks: true, conversions: true },
      },
    },
  });

  const now = Date.now();
  const recommendations: RepricingRecommendation[] = [];

  for (const product of products) {
    for (const variant of product.listingVariants) {
      for (const rule of rules) {
        if (!rule.platforms.includes(variant.platform)) continue;
        if (product.repricingApplications >= rule.maxApplicationsPerProduct) continue;

        const daysSinceLive = Math.floor((now - new Date(product.createdAt).getTime()) / 86400000);
        if (daysSinceLive < rule.condition.minDaysLive) continue;
        if (variant.impressions < rule.condition.minViews) continue;
        if (variant.price > rule.condition.maxCurrentPrice) continue;

        const conversionRate = variant.impressions > 0 ? variant.conversions / variant.impressions : 0;
        if (conversionRate >= rule.condition.maxConversionRate) continue;

        const newPrice = computeNewPrice(variant.price, rule);
        if (newPrice >= variant.price) continue;

        recommendations.push({
          productId: product.id,
          title: product.title,
          platform: variant.platform,
          currentPrice: variant.price,
          newPrice,
          rule,
          reason: `${variant.impressions} views, ${(conversionRate * 100).toFixed(2)}% conversion rate, ${daysSinceLive} days live — below conversion threshold`,
        });
      }
    }
  }

  return recommendations;
}

export async function applyRepricing(
  productId: string,
  platform: string,
  newPrice: number
): Promise<void> {
  await prisma.$transaction([
    prisma.listingVariant.updateMany({
      where: { productId, platform, isActive: true },
      data: { price: newPrice },
    }),
    prisma.product.update({
      where: { id: productId },
      data: {
        repricingApplications: { increment: 1 },
        lastRepricedAt: new Date(),
      },
    }),
  ]);
}
