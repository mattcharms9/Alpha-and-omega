import { NextRequest, NextResponse } from "next/server";
import { recordDailyLessons } from "@/lib/learning/daily-ledger";
import { computeAndSaveIntelligenceScore } from "@/lib/learning/intelligence-score";

// Schedule: 50 23 * * * (10:50pm UTC — runs before close-day at 11:59pm)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [lesson, score] = await Promise.all([
      recordDailyLessons(today),
      computeAndSaveIntelligenceScore(),
    ]);
    return NextResponse.json({ success: true, data: { date: today, confidenceScore: lesson.confidenceScore, intelligenceScore: score } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Record learning failed";
    console.error("[cron/record-learning]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
