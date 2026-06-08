import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

// Schedule: 0 7 * * * (7am UTC daily)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const noDataCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const runningVariants = await prisma.listingVariant.findMany({
      where: { isActive: true, createdAt: { lt: cutoff } },
      include: { product: true },
    });

    // Group by productId
    const byProduct: Record<string, typeof runningVariants> = {};
    for (const v of runningVariants) {
      if (!byProduct[v.productId]) byProduct[v.productId] = [];
      byProduct[v.productId].push(v);
    }

    let resolved = 0;
    let noData = 0;

    for (const [, variants] of Object.entries(byProduct)) {
      if (variants.length < 2) continue;

      const totalImpressions = variants.reduce((a, b) => a + b.impressions, 0);

      // No data after 7 days
      if (totalImpressions === 0 && variants[0].createdAt < noDataCutoff) {
        await prisma.listingVariant.updateMany({
          where: { id: { in: variants.map((v) => v.id) } },
          data: { isActive: false },
        });
        await createAlert(
          "urgency",
          `A/B test for "${variants[0].product.title}" has no data after 7 days`,
          "No impressions recorded. Check if the listing is receiving traffic.",
          "View Products", "/products"
        );
        noData++;
        continue;
      }

      if (totalImpressions < 50) continue; // Not enough data yet

      // Find winner: highest conversion rate (clicks / impressions)
      const scored = variants.map((v) => ({
        ...v,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      })).sort((a, b) => b.ctr - a.ctr);

      const best = scored[0];
      const secondBest = scored[1];

      if (!best || !secondBest) continue;

      const improvement = secondBest.ctr > 0
        ? ((best.ctr - secondBest.ctr) / secondBest.ctr) * 100
        : 0;

      if (improvement < 20) continue; // Not a clear winner yet

      // Declare winner
      await prisma.listingVariant.update({
        where: { id: best.id },
        data: { isActive: true, isControl: false },
      });
      await prisma.listingVariant.updateMany({
        where: { id: { in: scored.slice(1).map((v) => v.id) } },
        data: { isActive: false },
      });

      // Propagate winning listing to product
      if (best.title && best.description) {
        const optimized: Prisma.InputJsonValue = {
          title: best.title,
          description: best.description,
          tags: best.tags,
          seoScore: 80,
          seoNotes: [`Auto-promoted: ${improvement.toFixed(0)}% better CTR than losing variant`],
        };
        await prisma.product.update({
          where: { id: best.productId },
          data: { optimizedListing: optimized },
        });
      }

      await createAlert(
        "opportunity",
        `A/B winner declared: "${best.product.title}"`,
        `Variant "${best.variantLabel}" wins with ${improvement.toFixed(0)}% better CTR (${(best.ctr * 100).toFixed(1)}% vs ${(secondBest.ctr * 100).toFixed(1)}%). Listing updated.`,
        "View Products", "/products"
      );

      resolved++;
    }

    return NextResponse.json({ success: true, data: { resolved, noData } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "A/B resolution failed";
    console.error("[cron/resolve-ab-tests]", msg);
    return NextResponse.json({ success: false, error: "A/B resolution failed" }, { status: 500 });
  }
}

async function createAlert(type: string, title: string, body: string, actionLabel: string, actionHref: string) {
  await prisma.strategicAlert.create({ data: { type, title, body, actionLabel, actionHref } }).catch(() => {});
}
