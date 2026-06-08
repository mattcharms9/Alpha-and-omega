import { prisma } from "@/lib/db/prisma";

export type LifecycleStage = "active" | "declining" | "end_of_life" | "archived";

export interface LifecycleScanResult {
  declining: string[];
  endOfLife: string[];
  resurrectable: string[];
  archived: string[];
  unchanged: number;
}

const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

export async function runLifecycleScan(): Promise<LifecycleScanResult> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { deletedAt: null, lifecycleStage: { not: "archived" } },
    include: { etsyListings: true },
  });

  const result: LifecycleScanResult = {
    declining: [],
    endOfLife: [],
    resurrectable: [],
    archived: [],
    unchanged: 0,
  };

  for (const product of products) {
    const daysSinceRevenue = product.lastRevenueAt
      ? (now.getTime() - product.lastRevenueAt.getTime()) / (24 * 60 * 60 * 1000)
      : 999;

    const etsyListing = product.etsyListings[0];
    const viewsLast30 = etsyListing?.views ?? 0; // Simplified: total views as proxy

    // Seasonal end-of-life
    if (product.peakSeasonEnd && product.peakSeasonEnd < now && !product.isEvergreen) {
      await updateLifecycle(product.id, "end_of_life", "Peak season ended");
      result.endOfLife.push(product.id);

      // Auto-unpublish seasonal products
      await unpublishProduct(product.id, product.etsyListings.map((l) => l.etsyListingId)).catch(() => {});
      continue;
    }

    // Stale with no views — candidate for end of life
    if (daysSinceRevenue > 90 && viewsLast30 < 5 && product.totalRevenue > 0) {
      await updateLifecycle(product.id, "end_of_life", "Zero revenue and <5 views in 90 days");
      result.endOfLife.push(product.id);
      continue;
    }

    // Declining: had revenue in last 90 days but not last 30
    if (product.lastRevenueAt) {
      const since = now.getTime() - product.lastRevenueAt.getTime();
      if (since > DAYS_30 && since <= DAYS_90 && product.lifecycleStage === "active") {
        await updateLifecycle(product.id, "declining", "No revenue in last 30 days");
        result.declining.push(product.id);
        continue;
      }
    }

    // Resurrectable: strong lifetime revenue but currently stale
    if (product.totalRevenue >= 100 && daysSinceRevenue > 60 && product.lifecycleStage !== "declining") {
      result.resurrectable.push(product.id);
    }

    result.unchanged++;
  }

  // Create strategic alerts for transitions
  if (result.declining.length > 0) {
    await prisma.strategicAlert.create({
      data: {
        type: "urgency",
        title: `${result.declining.length} product${result.declining.length > 1 ? "s" : ""} declining`,
        body: "No revenue in the last 30 days. Consider repricing or running a promotion.",
        actionLabel: "View in Portfolio",
        actionHref: "/portfolio",
      },
    }).catch(() => {});
  }

  if (result.resurrectable.length > 0) {
    await prisma.strategicAlert.create({
      data: {
        type: "opportunity",
        title: `${result.resurrectable.length} strong product${result.resurrectable.length > 1 ? "s" : ""} need attention`,
        body: "These products earned $100+ but have gone dormant. Use Reposition to find new audiences.",
        actionLabel: "Reposition Products",
        actionHref: "/products",
      },
    }).catch(() => {});
  }

  return result;
}

async function updateLifecycle(productId: string, stage: LifecycleStage, note: string): Promise<void> {
  await prisma.product.update({
    where: { id: productId },
    data: { lifecycleStage: stage, lifecycleNote: note },
  });
}

async function unpublishProduct(productId: string, etsyListingIds: string[]): Promise<void> {
  // Mark as inactive in DB — actual Etsy unpublish would require OAuth token
  await prisma.etsyListing.updateMany({
    where: { productId, etsyListingId: { in: etsyListingIds } },
    data: { status: "inactive" },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { status: "archived" },
  });
}
