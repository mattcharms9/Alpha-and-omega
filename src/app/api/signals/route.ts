import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { discoverEmotionalTrends } from "@/lib/ai/intelligence-engine";
import { computeSignalFreshness, computeOpportunityScore, computeRarityScore } from "@/lib/ai/empire-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ScanSchema = z.object({
  focusArea: z.string().optional(),
  count: z.number().min(1).max(12).optional().default(8),
});

const ActivateSchema = z.object({
  signalId: z.string().min(1),
  brandId: z.string().min(1),
});

const BankSchema = z.object({
  id: z.string().min(1),
  emotion: z.string(),
  painPoint: z.string(),
  description: z.string(),
  intensity: z.number(),
  monetizationScore: z.number(),
  evergreenScore: z.number(),
  audienceLoyalty: z.number(),
  urgency: z.number(),
  platforms: z.array(z.string()),
  audienceArchetypes: z.array(z.string()),
  productOpportunities: z.array(z.string()),
  searchVolumeTrend: z.string(),
  competitionLevel: z.string(),
  estimatedAnnualRevenue: z.string(),
  tags: z.array(z.string()),
});

export async function GET() {
  try {
    const signals = await prisma.bankedSignal.findMany({
      orderBy: { opportunityScore: "desc" },
      include: { connectedBrand: { select: { id: true, brandName: true } } },
    });

    const withFreshness = signals.map((s) => {
      const freshness = computeSignalFreshness(s.createdAt);
      return {
        ...s,
        freshnessScore: s.activatedAt ? 100 : freshness,
      };
    });

    return NextResponse.json({ success: true, data: withFreshness });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "scan";

    if (action === "bank") {
      const trend = BankSchema.parse(body);
      const existing = await prisma.bankedSignal.findFirst({ where: { emotion: trend.emotion, painPoint: trend.painPoint, deletedAt: null } });
      if (existing) return NextResponse.json({ success: true, data: { alreadySaved: true, id: existing.id } });
      const opp = computeOpportunityScore({ monetizationScore: trend.monetizationScore, intensity: trend.intensity, urgency: trend.urgency, evergreenScore: trend.evergreenScore, competitionLevel: trend.competitionLevel, freshnessScore: 100 });
      const rarity = computeRarityScore(trend.competitionLevel, trend.evergreenScore, trend.monetizationScore);
      const saved = await prisma.bankedSignal.create({
        data: { emotion: trend.emotion, painPoint: trend.painPoint, description: trend.description, intensity: trend.intensity, monetizationScore: trend.monetizationScore, evergreenScore: trend.evergreenScore, audienceLoyalty: trend.audienceLoyalty, urgency: trend.urgency, platforms: trend.platforms, audienceArchetypes: trend.audienceArchetypes, productOpportunities: trend.productOpportunities, searchVolumeTrend: trend.searchVolumeTrend, competitionLevel: trend.competitionLevel, estimatedAnnualRevenue: trend.estimatedAnnualRevenue, tags: trend.tags, freshnessScore: 100, rarityScore: rarity, opportunityScore: opp, territory: trend.emotion },
      });
      return NextResponse.json({ success: true, data: { saved: true, id: saved.id } });
    }

    if (action === "activate") {
      const { signalId, brandId } = ActivateSchema.parse(body);
      await prisma.bankedSignal.update({
        where: { id: signalId },
        data: { activatedAt: new Date(), connectedBrandId: brandId },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "scan") {
      const { focusArea, count } = ScanSchema.parse(body);
      const report = await discoverEmotionalTrends(focusArea, count);

      const saved = await Promise.all(
        report.trends.map(async (trend) => {
          const freshness = 100;
          const opp = computeOpportunityScore({
            monetizationScore: trend.monetizationScore,
            intensity: trend.intensity,
            urgency: trend.urgency,
            evergreenScore: trend.evergreenScore,
            competitionLevel: trend.competitionLevel,
            freshnessScore: freshness,
          });
          const rarity = computeRarityScore(trend.competitionLevel, trend.evergreenScore, trend.monetizationScore);

          const existing = await prisma.bankedSignal.findFirst({
            where: { emotion: trend.emotion, painPoint: trend.painPoint, deletedAt: null },
          });
          if (existing) {
            return prisma.bankedSignal.update({
              where: { id: existing.id },
              data: { freshnessScore: freshness, opportunityScore: opp, updatedAt: new Date() },
            });
          }
          return prisma.bankedSignal.create({
            data: {
              emotion: trend.emotion,
              painPoint: trend.painPoint,
              description: trend.description,
              intensity: trend.intensity,
              monetizationScore: trend.monetizationScore,
              evergreenScore: trend.evergreenScore,
              audienceLoyalty: trend.audienceLoyalty,
              urgency: trend.urgency,
              platforms: trend.platforms,
              audienceArchetypes: trend.audienceArchetypes,
              productOpportunities: trend.productOpportunities,
              searchVolumeTrend: trend.searchVolumeTrend,
              competitionLevel: trend.competitionLevel,
              estimatedAnnualRevenue: trend.estimatedAnnualRevenue,
              tags: trend.tags,
              freshnessScore: freshness,
              rarityScore: rarity,
              opportunityScore: opp,
              territory: trend.emotion,
            },
          });
        })
      );

      return NextResponse.json({ success: true, data: { report, saved: saved.length } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    console.error("Signals API error:", error);
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    await prisma.bankedSignal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
