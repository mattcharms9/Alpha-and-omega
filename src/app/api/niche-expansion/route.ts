import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";
import { expandEmotion, drillDeeper } from "@/lib/ai/niche-expansion-engine";
import type { SubNiche } from "@/lib/ai/niche-types";
import type { Prisma } from "@prisma/client";

function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}

const ExpandSchema = z.object({
  emotion: z.string().min(2).max(100),
  avoidExisting: z.boolean().optional().default(true),
});

const DrillSchema = z.object({
  parentNicheId: z.string().min(1),
});

const SaveSchema = z.object({
  niche: z.record(z.string(), z.unknown()),
  notes: z.string().optional().default(""),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["researched", "in_progress", "producing", "saturated"]).optional(),
  notes: z.string().optional(),
  isFavorited: z.boolean().optional(),
});

const DeleteSchema = z.object({ id: z.string().min(1) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const action = new URL(req.url).searchParams.get("action") ?? "expand";
  const body: unknown = await req.json();

  try {
    if (action === "expand") {
      const { emotion, avoidExisting } = ExpandSchema.parse(body);

      let existingNames: string[] = [];
      if (avoidExisting) {
        const existing = await prisma.nicheResearch.findMany({
          where: { parentEmotion: { contains: emotion } },
          select: { nicheName: true },
        });
        existingNames = existing.map((n) => n.nicheName);
      }

      const report = await expandEmotion(emotion, existingNames, new Date().getMonth() + 1);
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "drill") {
      const { parentNicheId } = DrillSchema.parse(body);

      const parent = await prisma.nicheResearch.findUnique({ where: { id: parentNicheId } });
      if (!parent) {
        return NextResponse.json({ success: false, error: "Niche not found" }, { status: 404 });
      }

      const parentNiche: SubNiche = {
        id: parent.id,
        parentEmotion: parent.parentEmotion,
        nicheName: parent.nicheName,
        nicheSlug: parent.nicheSlug,
        oneLiner: parent.oneLiner,
        opportunityScore: parent.opportunityScore,
        marketSize: "medium",
        competitionLevel: parent.competitionLevel as SubNiche["competitionLevel"],
        evergreenScore: parent.evergreenScore,
        trendingScore: parent.trendingScore,
        monetizationScore: parent.monetizationScore,
        peakMonths: parent.peakMonths as number[],
        currentSeasonalRelevance: parent.currentSeasonalRelevance,
        urgency: parent.urgency as SubNiche["urgency"],
        audience: parent.audience as unknown as SubNiche["audience"],
        topProductRecommendation: parent.topProduct as unknown as SubNiche["topProductRecommendation"],
        allProductFormats: parent.allFormats as unknown as SubNiche["allProductFormats"],
        etsyIntel: parent.etsyIntel as unknown as SubNiche["etsyIntel"],
        contentAngles: parent.contentAngles as unknown as SubNiche["contentAngles"],
        relatedNiches: parent.relatedNiches as unknown as string[],
        competitorGaps: parent.competitorGaps as unknown as string[],
        whyNowRationale: parent.whyNowRationale,
      };

      const report = await drillDeeper(parentNiche, new Date().getMonth() + 1);
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "save") {
      const { niche, notes } = SaveSchema.parse(body);
      const n = niche as unknown as SubNiche;

      const saved = await prisma.nicheResearch.create({
        data: {
          parentEmotion: n.parentEmotion,
          nicheName: n.nicheName,
          nicheSlug: n.nicheSlug || n.nicheName.toLowerCase().replace(/\s+/g, "-"),
          oneLiner: n.oneLiner,
          opportunityScore: n.opportunityScore,
          competitionLevel: n.competitionLevel,
          evergreenScore: n.evergreenScore,
          trendingScore: n.trendingScore,
          monetizationScore: n.monetizationScore,
          peakMonths: toJson(n.peakMonths),
          currentSeasonalRelevance: n.currentSeasonalRelevance,
          urgency: n.urgency,
          audience: toJson(n.audience),
          topProduct: toJson(n.topProductRecommendation),
          allFormats: toJson(n.allProductFormats),
          etsyIntel: toJson(n.etsyIntel),
          contentAngles: toJson(n.contentAngles),
          relatedNiches: toJson(n.relatedNiches),
          competitorGaps: toJson(n.competitorGaps),
          whyNowRationale: n.whyNowRationale,
          notes,
        },
      });

      return NextResponse.json({ success: true, data: saved });
    }

    if (action === "update") {
      const { id, ...updates } = UpdateSchema.parse(body);
      const updated = await prisma.nicheResearch.update({
        where: { id },
        data: {
          ...updates,
          ...(updates.status === "in_progress" ? { lastUsedAt: new Date() } : {}),
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "delete") {
      const { id } = DeleteSchema.parse(body);
      await prisma.nicheResearch.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  try {
    if (action === "list") {
      const emotion = url.searchParams.get("emotion");
      const status = url.searchParams.get("status");
      const favoritedOnly = url.searchParams.get("favorited") === "true";

      const niches = await prisma.nicheResearch.findMany({
        where: {
          // SQLite doesn't support mode: "insensitive" — use contains (case-sensitive)
          ...(emotion ? { parentEmotion: { contains: emotion } } : {}),
          ...(status ? { status } : {}),
          ...(favoritedOnly ? { isFavorited: true } : {}),
        },
        orderBy: [{ isFavorited: "desc" }, { opportunityScore: "desc" }],
        take: 100,
      });

      return NextResponse.json({ success: true, data: niches });
    }

    if (action === "get") {
      const id = url.searchParams.get("id");
      if (!id) {
        return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
      }
      const niche = await prisma.nicheResearch.findUnique({ where: { id } });
      if (!niche) {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: niche });
    }

    if (action === "stats") {
      const [total, byStatus, byEmotion, topScored] = await Promise.all([
        prisma.nicheResearch.count(),
        prisma.nicheResearch.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        prisma.nicheResearch.groupBy({
          by: ["parentEmotion"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
        prisma.nicheResearch.findMany({
          orderBy: { opportunityScore: "desc" },
          take: 5,
          select: { nicheName: true, opportunityScore: true, status: true },
        }),
      ]);

      return NextResponse.json({ success: true, data: { total, byStatus, byEmotion, topScored } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
