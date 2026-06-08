import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { fetchEtsySearchIntelligence } from "@/lib/ai/etsy-market-engine";

// Schedule: 0 4 * * 1 (4am UTC every Monday)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let alertsCreated = 0;

    // Niche threat detection — check competition growth for active niches
    const niches = await prisma.nicheResearch.findMany({
      where: { status: "researched" },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    for (const niche of niches) {
      const keywords = (niche.etsyIntel as { primaryKeywords?: string[] })?.primaryKeywords?.slice(0, 2) ?? [];
      if (keywords.length === 0) continue;

      const intel = await fetchEtsySearchIntelligence(keywords).catch(() => null);
      if (!intel) continue;

      const previousCount = niche.competitionScore ?? 0;
      const newCount = intel.totalListingsEstimate;

      await prisma.nicheResearch.update({
        where: { id: niche.id },
        data: {
          competitionScore: newCount,
          lastCheckedAt: new Date(),
          competitionLevel: intel.competitionLevel,
        },
      });

      // Alert if competition grew >30%
      if (previousCount > 0 && newCount > previousCount * 1.3) {
        const growth = Math.round(((newCount - previousCount) / previousCount) * 100);
        await prisma.strategicAlert.create({
          data: {
            type: "threat",
            title: `Niche "${niche.nicheName}" competition +${growth}%`,
            body: `${newCount.toLocaleString()} listings now (was ~${previousCount.toLocaleString()}). Consider pivoting to a more specific sub-niche.`,
            actionLabel: "Explore Sub-niches",
            actionHref: "/niche-research",
          },
        });
        alertsCreated++;
      }
    }

    return NextResponse.json({ success: true, data: { nichesChecked: niches.length, alertsCreated } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Monitor failed";
    console.error("[cron/competitor-monitor]", msg);
    return NextResponse.json({ success: false, error: "Monitor failed" }, { status: 500 });
  }
}
