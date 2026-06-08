import { NextRequest, NextResponse } from "next/server";
import { generateContentBatch, generateViralHooks, ContentPlatform } from "@/lib/ai/content-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const BatchSchema = z.object({
  productTitle: z.string().min(1),
  emotionalTheme: z.string().min(1),
  targetPlatforms: z.array(z.enum(["tiktok", "instagram", "pinterest", "youtube", "twitter"])).min(1),
  pieceCount: z.number().min(1).max(12).optional().default(6),
});

const HooksSchema = z.object({
  emotion: z.string().min(1),
  count: z.number().min(1).max(20).optional().default(10),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "batch";

    if (action === "hooks") {
      const { emotion, count } = HooksSchema.parse(body);
      const result = await generateViralHooks(emotion, count);
      return NextResponse.json({ success: true, data: result });
    }

    const { productTitle, emotionalTheme, targetPlatforms, pieceCount } = BatchSchema.parse(body);
    const batch = await generateContentBatch(productTitle, emotionalTheme, targetPlatforms as ContentPlatform[], pieceCount);
    return NextResponse.json({ success: true, data: batch });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    console.error("Content API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
