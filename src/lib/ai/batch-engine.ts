import { generateJSON } from "./claude";
import { PRICING_TIERS } from "./mix-types";
import type { BatchSlot, BatchPlan } from "./mix-types";
import type { ProductBlueprint } from "./product-engine";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface BatchGenerationRequest {
  emotionalTheme: string;
  targetAudience: string;
  batchPlan: BatchPlan;
  parallelGenerate: boolean;
  nicheKeywords?: string[];
  audienceLanguage?: string[];
  activeSavedNicheId?: string;
}

export interface BatchProductResult {
  slot: BatchSlot;
  blueprint: ProductBlueprint;
  savedId: string;
  status: "complete" | "failed";
  error?: string;
}

export interface BatchGenerationResult {
  batchId: string;
  products: BatchProductResult[];
  completedAt: string;
  totalGenerationMs: number;
  failedCount: number;
  successCount: number;
}

function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}

const SLOT_SYSTEM_PROMPT = `You are the Product Psychology Engine for Alpha & Omega. Design a single emotionally precise transformation product for a specific sub-audience. Avoid generic titles — be surgically specific to the audience focus and transformation angle provided.`;

export async function generateSingleProductForSlot(
  slot: BatchSlot,
  emotionalTheme: string,
  targetAudience: string,
  constituentTitles?: string[],
  nicheKeywords?: string[],
  audienceLanguage?: string[],
  activeSavedNicheId?: string
): Promise<{ blueprint: ProductBlueprint; savedId: string }> {
  const isBundle = slot.format === "bundle";

  const prompt = isBundle
    ? `Create a BUNDLE listing that combines these products: ${(constituentTitles ?? []).join(", ")}

Emotional Theme: "${emotionalTheme}" · Audience: "${targetAudience}"
Bundle Strategy: ${slot.positioningNote}

Design a compelling bundle product page. The bundle is perceived as a complete system.
Use format "bundle" in the type field.

Return JSON with the same ProductBlueprint schema.`
    : `Design a premium ${slot.format.replace("_", " ")} for this specific audience:

Emotional Theme: "${emotionalTheme}"
Audience Focus: "${slot.audienceFocus}"
Transformation Angle: "${slot.transformationAngle}"
Positioning: "${slot.positioningNote}"${nicheKeywords?.length ? `

Primary Etsy keywords for this niche (use in product title and keywords field):
${nicheKeywords.slice(0, 5).join(", ")}` : ""}${audienceLanguage?.length ? `
Audience language to use naturally in hooks and description:
${audienceLanguage.slice(0, 4).join(", ")}` : ""}

Return JSON:
{
  "id": "kebab-case-id",
  "title": "string (emotionally precise, not generic)",
  "subtitle": "string",
  "tagline": "string (under 10 words)",
  "type": "${slot.format}",
  "targetEmotion": "string",
  "targetAudience": "${slot.audienceFocus}",
  "audienceArchetype": "string",
  "pageCount": number,
  "sections": [{ "name": "string", "purpose": "string", "pageCount": number, "prompts": ["string"], "psychologicalMechanism": "string" }],
  "psychologicalFramework": "string",
  "transformationPromise": "string",
  "emotionalHooks": ["string"],
  "coverConcept": { "colorPalette": ["string"], "visualTheme": "string", "typography": "string", "mood": "string", "symbols": ["string"] },
  "marketingAngles": ["string"],
  "pricingStrategy": { "printPrice": number, "digitalPrice": number, "bundlePrice": number, "reasoning": "string" },
  "platforms": ["string"],
  "estimatedMonthlyRevenue": "string",
  "competitiveAdvantage": "string",
  "keywords": ["string"],
  "descriptionShort": "string",
  "descriptionLong": "string"
}`;

  const blueprint = await generateJSON<ProductBlueprint>(SLOT_SYSTEM_PROMPT, prompt, 6000, "batch-engine");

  // Override AI-generated prices with hardcoded tier pricing
  blueprint.pricingStrategy.digitalPrice = slot.pricing.recommendedPrice;

  const saved = await prisma.product.create({
    data: {
      title: blueprint.title,
      subtitle: blueprint.subtitle,
      tagline: blueprint.tagline,
      type: blueprint.type,
      targetEmotion: blueprint.targetEmotion,
      targetAudience: blueprint.targetAudience,
      audienceArchetype: blueprint.audienceArchetype,
      pageCount: blueprint.pageCount,
      sections: toJson(blueprint.sections),
      psychologicalFramework: blueprint.psychologicalFramework,
      transformationPromise: blueprint.transformationPromise,
      emotionalHooks: blueprint.emotionalHooks,
      coverConcept: toJson(blueprint.coverConcept),
      marketingAngles: blueprint.marketingAngles,
      pricingStrategy: toJson(blueprint.pricingStrategy),
      platforms: blueprint.platforms,
      estimatedMonthlyRevenue: blueprint.estimatedMonthlyRevenue,
      competitiveAdvantage: blueprint.competitiveAdvantage,
      keywords: blueprint.keywords,
      descriptionShort: blueprint.descriptionShort,
      descriptionLong: blueprint.descriptionLong,
      status: "draft",
      ...(activeSavedNicheId ? { nicheId: activeSavedNicheId } : {}),
    },
  });

  return { blueprint, savedId: saved.id };
}

export async function generateProductBatch(
  request: BatchGenerationRequest
): Promise<BatchGenerationResult> {
  const batchId = crypto.randomUUID();
  const startTime = Date.now();
  const { slots } = request.batchPlan;

  const nonBundleSlots = slots.filter((s) => s.format !== "bundle");
  const bundleSlot = slots.find((s) => s.format === "bundle");

  const nonBundleResults = await Promise.allSettled(
    nonBundleSlots.map((slot) =>
      generateSingleProductForSlot(
        slot,
        request.emotionalTheme,
        request.targetAudience,
        undefined,
        request.nicheKeywords,
        request.audienceLanguage,
        request.activeSavedNicheId
      )
    )
  );

  const constituentTitles = nonBundleResults
    .filter((r): r is PromiseFulfilledResult<{ blueprint: ProductBlueprint; savedId: string }> => r.status === "fulfilled")
    .map((r) => r.value.blueprint.title);

  const bundleResult = bundleSlot
    ? await Promise.allSettled([
        generateSingleProductForSlot(
          bundleSlot,
          request.emotionalTheme,
          request.targetAudience,
          constituentTitles,
          request.nicheKeywords,
          request.audienceLanguage,
          request.activeSavedNicheId
        ),
      ])
    : [];

  const allResults = [...nonBundleResults, ...bundleResult];
  const allSlots = [...nonBundleSlots, ...(bundleSlot ? [bundleSlot] : [])];

  const products: BatchProductResult[] = allResults.map((result, i) => {
    const slot = allSlots[i]!;
    if (result.status === "fulfilled") {
      return { slot, blueprint: result.value.blueprint, savedId: result.value.savedId, status: "complete" as const };
    }
    return { slot, blueprint: null as unknown as ProductBlueprint, savedId: "", status: "failed" as const, error: result.reason instanceof Error ? result.reason.message : "Generation failed" };
  });

  return {
    batchId,
    products,
    completedAt: new Date().toISOString(),
    totalGenerationMs: Date.now() - startTime,
    failedCount: products.filter((p) => p.status === "failed").length,
    successCount: products.filter((p) => p.status === "complete").length,
  };
}
