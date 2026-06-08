import { NextRequest, NextResponse } from "next/server";
import { runLifecycleScan } from "@/lib/analytics/lifecycle-manager";

// Schedule: 0 5 * * * (5am UTC daily)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLifecycleScan();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lifecycle scan failed";
    console.error("[cron/lifecycle-scan]", msg);
    return NextResponse.json({ success: false, error: "Lifecycle scan failed" }, { status: 500 });
  }
}
