import { NextResponse } from "next/server";
import { computePerformanceInsights } from "@/lib/analytics/revenue-aggregator";
import { toSafeErrorMessage } from "@/lib/errors";

export async function GET(): Promise<NextResponse> {
  try {
    const insights = await computePerformanceInsights();
    return NextResponse.json({ success: true, data: insights });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
