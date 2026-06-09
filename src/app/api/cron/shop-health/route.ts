import { NextRequest, NextResponse } from "next/server";
import { getShopHealthReport } from "@/lib/etsy/shop-manager";
import { prisma } from "@/lib/db/prisma";

// Schedule: 0 7 * * * (7am UTC daily)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await getShopHealthReport();

    // Create a strategic alert if health is below 60
    if (report.shopHealthScore < 60) {
      await prisma.strategicAlert.create({
        data: {
          type: "risk",
          title: "Etsy Shop Health Low",
          body: `Shop health score is ${report.shopHealthScore}/100. Issues: ${report.zeroViewListings.length} zero-view listings, ${report.listingsWithLowQualityScore.length} low-quality listings.`,
          actionLabel: "Open Shop Manager",
          actionHref: "/shop-manager",
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: { shopHealthScore: report.shopHealthScore, issues: { zeroView: report.zeroViewListings.length, lowQuality: report.listingsWithLowQualityScore.length, noImage: report.listingsWithNoImage.length } } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Shop health check failed";
    console.error("[cron/shop-health]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
