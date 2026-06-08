import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";
import { scanAudienceGaps, scanCapabilityGaps, generateKnowledgeProduct } from "@/lib/ai/knowledge-engine";
import type { KnowledgeCategory, ProductFormat } from "@/lib/ai/mix-types";
import type { CapabilityGap } from "@/lib/ai/knowledge-types";
import type { Prisma } from "@prisma/client";

function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}

const ScanSchema = z.object({
  targetAudience: z.string().min(3).max(200),
  category: z.string(),
  avoidExisting: z.boolean().optional().default(true),
});

const GenerateSchema = z.object({
  gap: z.record(z.string(), z.unknown()),
  format: z.string(),
});

const AudienceScanSchema = z.object({
  targetAudience: z.string().min(3).max(300),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const action = req.nextUrl.searchParams.get("action") ?? "scan";
  const body = await req.json() as unknown;

  try {
    if (action === "scan") {
      const { targetAudience, category, avoidExisting } = ScanSchema.parse(body);
      let existingTitles: string[] = [];
      if (avoidExisting) {
        const existing = await prisma.product.findMany({
          where: { type: { in: ["knowledge_guide", "knowledge_workbook", "checklist", "template_pack"] } },
          select: { title: true },
          take: 100,
        });
        existingTitles = existing.map((p) => p.title);
      }
      const report = await scanCapabilityGaps(targetAudience, category as KnowledgeCategory, existingTitles);
      return NextResponse.json({ success: true, data: report });
    }

    if (action === "generate") {
      const { gap, format } = GenerateSchema.parse(body);
      const typedGap = gap as unknown as CapabilityGap;
      const blueprint = await generateKnowledgeProduct(typedGap, format as ProductFormat);

      const saved = await prisma.product.create({
        data: {
          title: blueprint.title,
          subtitle: blueprint.subtitle,
          tagline: blueprint.targetGap.shameReframe,
          type: blueprint.format,
          targetEmotion: "capability_anxiety",
          targetAudience: blueprint.targetGap.audience,
          audienceArchetype: blueprint.targetGap.audience,
          pageCount: blueprint.pageCount,
          sections: toJson(blueprint.sections),
          psychologicalFramework: "Shame-Reframe / Capability Anxiety",
          transformationPromise: blueprint.learningOutcomes.join(". "),
          emotionalHooks: blueprint.learningOutcomes as unknown as Prisma.InputJsonValue,
          coverConcept: toJson({ description: blueprint.coverConceptDescription }),
          marketingAngles: blueprint.tags as unknown as Prisma.InputJsonValue,
          pricingStrategy: toJson({ digitalPrice: blueprint.price, printPrice: 0, bundlePrice: 0, reasoning: "" }),
          platforms: ["etsy"] as unknown as Prisma.InputJsonValue,
          estimatedMonthlyRevenue: "",
          competitiveAdvantage: blueprint.targetGap.shameReframe,
          keywords: blueprint.tags as unknown as Prisma.InputJsonValue,
          descriptionShort: blueprint.subtitle,
          descriptionLong: blueprint.etsyDescription,
          status: "draft",
        },
      });

      return NextResponse.json({ success: true, data: { blueprint, savedId: saved.id } });
    }

    if (action === "audience-scan") {
      const rlTight = rateLimit(req, { limit: 3, windowMs: 60_000 });
      if (!rlTight.success) {
        return NextResponse.json(
          { success: false, error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(rlTight.retryAfter) } }
        );
      }
      const { targetAudience } = AudienceScanSchema.parse(body);
      const report = await scanAudienceGaps(targetAudience);
      return NextResponse.json({ success: true, data: report });
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
