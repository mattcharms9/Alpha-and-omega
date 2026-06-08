import { NextRequest, NextResponse } from "next/server";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  fetchEtsySearchIntelligence,
  fetchEtsyTrendingSearches,
  fetchEtsyCompetitionScore,
} from "@/lib/ai/etsy-market-engine";

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "search-intel") {
      const raw = searchParams.get("keywords") ?? "";
      const keywords = raw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 5);
      if (keywords.length === 0) {
        return NextResponse.json({ success: false, error: "keywords required" }, { status: 400 });
      }
      const data = await fetchEtsySearchIntelligence(keywords);
      return NextResponse.json({ success: true, data });
    }

    if (action === "trending") {
      const category = searchParams.get("category") ?? "journals";
      const data = await fetchEtsyTrendingSearches(category);
      return NextResponse.json({ success: true, data });
    }

    if (action === "competition") {
      const keyword = searchParams.get("keyword") ?? "";
      if (!keyword) return NextResponse.json({ success: false, error: "keyword required" }, { status: 400 });
      const data = await fetchEtsyCompetitionScore(keyword);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
