import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluateRepricingRules, applyRepricing } from "@/lib/rules/repricing";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";

const ApplySchema = z.object({
  productId: z.string().min(1),
  platform: z.string().min(1),
  newPrice: z.number().positive(),
});

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  try {
    const recommendations = await evaluateRepricingRules();
    return NextResponse.json({ success: true, data: recommendations });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  const action = new URL(req.url).searchParams.get("action");
  if (action !== "apply") {
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }

  try {
    const body = await req.json() as unknown;
    const { productId, platform, newPrice } = ApplySchema.parse(body);
    await applyRepricing(productId, platform, newPrice);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
