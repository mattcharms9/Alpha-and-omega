import { NextRequest, NextResponse } from "next/server";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { getShopHealthReport, getSEORefreshTargets, suggestPriceAdjustments } from "@/lib/etsy/shop-manager";

export async function GET(req: NextRequest) {
  try {
    const action = new URL(req.url).searchParams.get("action") ?? "health";

    if (action === "health") {
      const report = await getShopHealthReport();
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "seo-targets") {
      const targets = await getSEORefreshTargets();
      return NextResponse.json({ success: true, data: targets });
    }

    if (action === "price-suggestions") {
      const suggestions = await suggestPriceAdjustments();
      return NextResponse.json({ success: true, data: suggestions });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });

  try {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "organize") {
      // Section organization requires Etsy API calls to set listing section IDs
      // Returns the section plan without mutating (full automation requires Etsy section API)
      const report = await getShopHealthReport();
      return NextResponse.json({ success: true, data: { sections: report.sections, message: "Section plan generated — apply in Etsy Shop Manager" } });
    }

    if (action === "refresh-seo") {
      const targets = await getSEORefreshTargets();
      return NextResponse.json({ success: true, data: { targets, message: `${targets.length} listings queued for SEO refresh` } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
