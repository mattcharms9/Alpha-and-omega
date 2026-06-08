import { NextRequest, NextResponse } from "next/server";
import { analyzeEtsyMarket } from "@/lib/ai/market-research-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ResearchSchema = z.object({
  niche: z.string().min(1).max(200),
  emotionalCategory: z.string().min(1).max(100),
  productType: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json() as unknown;
    const params = ResearchSchema.parse(body);
    const report = await analyzeEtsyMarket(params);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
