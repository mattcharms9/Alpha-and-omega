import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { toSafeErrorMessage } from "@/lib/errors";
import { runFullScan, runNicheScan, getLatestSnapshot, getAllNicheReports } from "@/lib/market-intelligence/run-scan";
import { TRACKED_NICHES } from "@/lib/market-intelligence/types";
import { prisma } from "@/lib/db/prisma";

const ScanNicheSchema = z.object({ niche: z.string().min(1).max(100) });

export async function GET(req: NextRequest) {
  const limit = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!limit.success) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });

  const action = req.nextUrl.searchParams.get("action") ?? "latest";
  const q = req.nextUrl.searchParams.get("q") ?? "";

  try {
    if (action === "latest") {
      const [snapshot, reports] = await Promise.all([
        getLatestSnapshot(),
        getAllNicheReports(),
      ]);
      return NextResponse.json({ success: true, data: { snapshot, reports } });
    }

    if (action === "niche") {
      if (!q) return NextResponse.json({ success: false, error: "q param required" }, { status: 400 });
      const report = await prisma.marketIntelligenceReport.findFirst({
        where: { niche: q },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "visual") {
      if (!q) return NextResponse.json({ success: false, error: "q param required" }, { status: 400 });
      const report = await prisma.marketIntelligenceReport.findFirst({
        where: { niche: q },
        orderBy: { createdAt: "desc" },
        select: { visualStyle: true, niche: true, reportDate: true },
      });
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "history") {
      const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7");
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const snapshots = await prisma.etsyMarketSnapshot.findMany({
        where: { createdAt: { gte: cutoff } },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return NextResponse.json({ success: true, data: snapshots });
    }

    if (action === "scan-progress") {
      const today = new Date().toISOString().slice(0, 10);
      const [completedNiches, snapshot] = await Promise.all([
        prisma.marketIntelligenceReport.count({ where: { reportDate: today } }),
        prisma.etsyMarketSnapshot.findFirst({ where: { snapshotDate: today }, orderBy: { createdAt: "desc" } }),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          completedNiches,
          totalNiches: TRACKED_NICHES.length,
          isComplete: !!snapshot,
          marketSummary: snapshot?.marketSummary ?? null,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: toSafeErrorMessage(err).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") ?? "";

  if (action === "run-full-scan") {
    const limit = rateLimit(req, { limit: 10, windowMs: 60_000 });
    if (!limit.success) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });

    try {
      let startFrom = 0;
      const body = await req.text();
      if (body) {
        const parsed = JSON.parse(body) as { startFrom?: number };
        startFrom = typeof parsed.startFrom === "number" ? Math.max(0, parsed.startFrom) : 0;
      }
      const result = await runFullScan(startFrom);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return NextResponse.json({ success: false, error: toSafeErrorMessage(err).message }, { status: 500 });
    }
  }

  if (action === "run-niche") {
    const limit = rateLimit(req, { limit: 10, windowMs: 60_000 });
    if (!limit.success) return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });

    try {
      const body = await req.json();
      const { niche } = ScanNicheSchema.parse(body);
      const reportDate = new Date().toISOString().slice(0, 10);
      const { report } = await runNicheScan(niche, reportDate);
      return NextResponse.json({ success: true, data: report });
    } catch (err) {
      return NextResponse.json({ success: false, error: toSafeErrorMessage(err).message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
