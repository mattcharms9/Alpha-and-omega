import { NextRequest, NextResponse } from "next/server";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { recordDailyLessons, getLearningContext } from "@/lib/learning/daily-ledger";
import { getIntelligenceScoreBreakdown } from "@/lib/learning/intelligence-score";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "get-context") {
      const context = await getLearningContext();
      return NextResponse.json({ success: true, data: { context } });
    }

    if (action === "score") {
      const breakdown = await getIntelligenceScoreBreakdown();
      return NextResponse.json({ success: true, data: breakdown });
    }

    if (action === "history") {
      const ledger = await prisma.learningLedger.findMany({ orderBy: { date: "desc" }, take: 30 });
      return NextResponse.json({ success: true, data: ledger });
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

    if (action === "record-day") {
      const body = await req.json() as { date?: string };
      const date = body.date ?? new Date().toISOString().slice(0, 10);
      const lesson = await recordDailyLessons(date);
      return NextResponse.json({ success: true, data: lesson });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
