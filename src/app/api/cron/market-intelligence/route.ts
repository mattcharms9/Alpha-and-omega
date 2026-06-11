import { NextRequest, NextResponse } from "next/server";
import { runFullScan } from "@/lib/market-intelligence/run-scan";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Schedule: 0 1 * * * (1am UTC)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = Date.now();
    const BUDGET_MS = 270_000; // leave 30s margin under maxDuration
    let nextStart = 0;
    let totalNichesAnalyzed = 0;

    while (Date.now() - start < BUDGET_MS && nextStart < 25) {
      const result = await runFullScan(nextStart);
      totalNichesAnalyzed += result.nichesAnalyzed;
      if (result.isComplete) break;
      nextStart = result.nextStart;
    }

    const durationMs = Date.now() - start;
    console.log(`[cron/market-intelligence] Completed in ${durationMs}ms — ${totalNichesAnalyzed} niches analyzed`);

    return NextResponse.json({ success: true, data: { nichesAnalyzed: totalNichesAnalyzed, durationMs } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Market intelligence scan failed";
    console.error("[cron/market-intelligence]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
