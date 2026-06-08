import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitiveLandscape, analyzeEmotionalGaps, generateCompetitiveCounterstrategy } from "@/lib/ai/competitor-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const LandscapeSchema = z.object({
  niche: z.string().min(1),
  emotionalTerritory: z.string().min(1),
  competitorCount: z.number().min(1).max(10).optional().default(5),
});

const GapsSchema = z.object({
  niche: z.string().min(1),
  currentTerritory: z.string().min(1),
});

const CounterSchema = z.object({
  ourBrand: z.object({
    name: z.string().min(1),
    positioning: z.string().min(1),
    emotionalTerritory: z.string().min(1),
  }),
  competitor: z.object({
    brandName: z.string().min(1),
    positioning: z.object({
      coreMessage: z.string(),
      uniqueClaim: z.string(),
      targetAudience: z.string(),
      categoryFrame: z.string(),
      emotionalHook: z.string(),
    }),
    weaknesses: z.object({
      emotionalGaps: z.array(z.string()),
      audienceUnderserved: z.array(z.string()),
      productGaps: z.array(z.string()),
      messagingWeaknesses: z.array(z.string()),
      operationalWeaknesses: z.array(z.string()),
    }),
    psychologyAnalysis: z.object({
      exploitedBiases: z.array(z.string()),
      urgencyMechanisms: z.array(z.string()),
      socialProofApproach: z.string(),
      identityPositioning: z.string(),
      fearBasedTriggers: z.array(z.string()),
      desireBasedTriggers: z.array(z.string()),
    }),
  }),
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
    const action = searchParams.get("action") ?? "landscape";

    if (action === "gaps") {
      const { niche, currentTerritory } = GapsSchema.parse(body);
      const result = await analyzeEmotionalGaps(niche, currentTerritory);
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "counter") {
      const { ourBrand, competitor } = CounterSchema.parse(body);
      const result = await generateCompetitiveCounterstrategy(ourBrand, competitor);
      return NextResponse.json({ success: true, data: result });
    }

    const { niche, emotionalTerritory, competitorCount } = LandscapeSchema.parse(body);
    const report = await analyzeCompetitiveLandscape(niche, emotionalTerritory, competitorCount);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    console.error("Competitors API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
