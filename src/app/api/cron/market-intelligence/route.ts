import { NextRequest, NextResponse } from "next/server";
import { runFullScan } from "@/lib/market-intelligence/run-scan";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Schedule: 0 1 * * * (1am UTC — runs 1 hour before agent pipeline at 2am)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = Date.now();
    const result = await runFullScan();
    const durationMs = Date.now() - start;

    console.log(`[cron/market-intelligence] Completed in ${durationMs}ms — ${result.nichesAnalyzed} niches, ${result.totalListingsPulled} listings`);

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        durationMs,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Market intelligence scan failed";
    console.error("[cron/market-intelligence]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
