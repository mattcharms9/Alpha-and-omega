import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const SaveSignalSchema = z.object({
  niche: z.string().min(1).max(100),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opportunityScore: z.number().int().min(0).max(100),
  competitionLevel: z.string().min(1),
  totalListings: z.number().int().min(0),
  sweetSpotPrice: z.number().nullable().optional(),
  topOpportunity: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });

  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "saved-signals") {
      const signals = await prisma.signal.findMany({
        orderBy: { opportunityScore: "desc" },
        select: {
          id: true,
          niche: true,
          reportDate: true,
          opportunityScore: true,
          competitionLevel: true,
          totalListings: true,
          sweetSpotPrice: true,
          topOpportunity: true,
          autoSaved: true,
          savedAt: true,
        },
      });
      return NextResponse.json({ success: true, data: signals });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const { message, status } = toSafeErrorMessage(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });

  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "save-signal") {
      const body = SaveSignalSchema.safeParse(await req.json());
      if (!body.success) {
        return NextResponse.json({ success: false, error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      const { niche, reportDate, opportunityScore, competitionLevel, totalListings, sweetSpotPrice, topOpportunity } = body.data;

      const signal = await prisma.signal.upsert({
        where: { niche_reportDate: { niche, reportDate } },
        update: { opportunityScore, competitionLevel, totalListings, sweetSpotPrice: sweetSpotPrice ?? null, topOpportunity },
        create: { niche, reportDate, opportunityScore, competitionLevel, totalListings, sweetSpotPrice: sweetSpotPrice ?? null, topOpportunity, autoSaved: false },
      });

      return NextResponse.json({ success: true, data: signal });
    }

    if (action === "delete-signal") {
      const id = req.nextUrl.searchParams.get("id");
      if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
      await prisma.signal.delete({ where: { id } });
      return NextResponse.json({ success: true, data: { deleted: true } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const { message, status } = toSafeErrorMessage(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
