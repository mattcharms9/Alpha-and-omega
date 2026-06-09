import { NextRequest, NextResponse } from "next/server";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { findBundleOpportunities, generateBundleFromTheme, saveBundleToDb, invalidateBundleCache } from "@/lib/ai/bundle-engine";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const GenerateSchema = z.object({
  theme: z.string().min(1),
  productIds: z.array(z.string()).min(2).max(4),
});

export async function GET(req: NextRequest) {
  try {
    const action = new URL(req.url).searchParams.get("action") ?? "list";

    if (action === "opportunities") {
      const bundles = await findBundleOpportunities();
      return NextResponse.json({ success: true, data: bundles });
    }

    if (action === "list") {
      const bundles = await prisma.bundle.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
      return NextResponse.json({ success: true, data: bundles });
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
    const action = new URL(req.url).searchParams.get("action") ?? "generate";
    const body = await req.json();

    if (action === "generate") {
      const { theme, productIds } = GenerateSchema.parse(body);
      const bundle = await generateBundleFromTheme(theme, productIds);
      const id = await saveBundleToDb(bundle);
      invalidateBundleCache();
      return NextResponse.json({ success: true, data: { ...bundle, id } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
