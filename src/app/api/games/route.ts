import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";
import { generateGameProduct, generateGameCalendar, generateGameNiches } from "@/lib/ai/games-engine";
import type { EventCategory, GameType, ProductFormat } from "@/lib/ai/mix-types";
import type { Prisma } from "@prisma/client";

function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}

const GenerateSchema = z.object({
  eventCategory: z.string(),
  gameType: z.string(),
  format: z.string(),
  names: z.array(z.string()).optional(),
  theme: z.string().optional(),
  guestCount: z.number().optional(),
});

const NichesSchema = z.object({
  eventCategory: z.string(),
});

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") ?? "calendar";
  try {
    if (action === "calendar") {
      const calendar = await generateGameCalendar();
      return NextResponse.json({ success: true, data: calendar });
    }
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const action = req.nextUrl.searchParams.get("action") ?? "generate";
  const body = await req.json() as unknown;

  try {
    if (action === "generate") {
      const { eventCategory, gameType, format, names, theme, guestCount } = GenerateSchema.parse(body);
      const blueprint = await generateGameProduct(
        eventCategory as EventCategory,
        gameType as GameType,
        format as ProductFormat,
        { names, theme, guestCount }
      );

      const saved = await prisma.product.create({
        data: {
          title: blueprint.etsyTitle,
          subtitle: blueprint.subtitle,
          tagline: `${blueprint.gameType} for ${blueprint.eventCategory}`,
          type: blueprint.format,
          targetEmotion: "party_excitement",
          targetAudience: blueprint.eventCategory,
          audienceArchetype: "Party Host",
          pageCount: blueprint.itemCount,
          sections: toJson([]),
          psychologicalFramework: "Social Occasion / Party Readiness",
          transformationPromise: blueprint.etsyDescription.slice(0, 200),
          emotionalHooks: toJson([]),
          coverConcept: toJson({ description: blueprint.coverConceptDescription }),
          marketingAngles: blueprint.etsyTags as unknown as Prisma.InputJsonValue,
          pricingStrategy: toJson({ digitalPrice: blueprint.price, printPrice: 0, bundlePrice: 0, reasoning: "" }),
          platforms: ["etsy"] as unknown as Prisma.InputJsonValue,
          estimatedMonthlyRevenue: "",
          competitiveAdvantage: `${blueprint.gameType} game for ${blueprint.eventCategory}`,
          keywords: blueprint.etsyTags as unknown as Prisma.InputJsonValue,
          descriptionShort: blueprint.subtitle,
          descriptionLong: blueprint.etsyDescription,
          status: "draft",
        },
      });

      return NextResponse.json({ success: true, data: { blueprint, savedId: saved.id } });
    }

    if (action === "niches") {
      const { eventCategory } = NichesSchema.parse(body);
      const niches = await generateGameNiches(eventCategory as EventCategory);
      return NextResponse.json({ success: true, data: niches });
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
