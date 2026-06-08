import { NextRequest } from "next/server";
import { generateSingleProductForSlot } from "@/lib/ai/batch-engine";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { BatchSlot } from "@/lib/ai/mix-types";
import type { Prisma } from "@prisma/client";

const BatchGenerateSchema = z.object({
  emotionalTheme: z.string().min(1),
  targetAudience: z.string().min(1),
  batchPlan: z.object({
    emotionalTheme: z.string(),
    batchSize: z.number(),
    slots: z.array(z.record(z.string(), z.unknown())),
    bundleStrategy: z.string(),
    totalBatchRevenuePotential: z.number(),
    collectionName: z.string(),
    etsyCollectionNote: z.string(),
  }),
  nicheKeywords: z.array(z.string()).optional(),
  audienceLanguage: z.array(z.string()).optional(),
  activeSavedNicheId: z.string().optional(),
});

async function upsertDailyLog(successCount: number, theme: string) {
  const date = new Date().toISOString().slice(0, 10);
  try {
    await prisma.dailyBatchLog.upsert({
      where: { date },
      update: {
        batchesRun: { increment: 1 },
        productsGenerated: { increment: successCount },
        emotionalThemes: [theme] as unknown as Prisma.InputJsonValue,
      },
      create: {
        date,
        batchesRun: 1,
        productsGenerated: successCount,
        emotionalThemes: [theme] as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Non-fatal — never block response for tracking
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 3, windowMs: 60_000 });
  if (!rl.success) {
    return new Response(JSON.stringify({ success: false, error: "Too many requests." }), { status: 429 });
  }

  const body = await req.json() as unknown;
  const parsed = BatchGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ success: false, error: "Invalid request" }), { status: 400 });
  }

  const { emotionalTheme, targetAudience, batchPlan, nicheKeywords, audienceLanguage, activeSavedNicheId } = parsed.data;
  const slots = batchPlan.slots as unknown as BatchSlot[];
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  void (async () => {
    const constituentTitles: string[] = [];
    let successCount = 0;

    try {
      await send({ type: "started", batchSize: slots.length });

      const nonBundleSlots = slots.filter((s) => s.format !== "bundle");
      const bundleSlot = slots.find((s) => s.format === "bundle");

      const nonBundleResults = await Promise.allSettled(
        nonBundleSlots.map(async (slot, index) => {
          const result = await generateSingleProductForSlot(slot, emotionalTheme, targetAudience, undefined, nicheKeywords, audienceLanguage, activeSavedNicheId);
          constituentTitles.push(result.blueprint.title);
          await send({ type: "product_complete", index, slot, savedId: result.savedId, title: result.blueprint.title });
          return result;
        })
      );

      const nonBundleIds = nonBundleResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ savedId: string }>).value.savedId);
      successCount = nonBundleIds.length;

      if (bundleSlot) {
        const bundleResult = await generateSingleProductForSlot(bundleSlot, emotionalTheme, targetAudience, constituentTitles, nicheKeywords, audienceLanguage, activeSavedNicheId)
          .catch((err: unknown) => ({ error: err instanceof Error ? err.message : "Bundle failed" }));

        if ("savedId" in bundleResult) {
          successCount += 1;
          await send({ type: "product_complete", index: slots.length - 1, slot: bundleSlot, savedId: bundleResult.savedId, title: bundleResult.blueprint.title });
          await prisma.product.update({ where: { id: bundleResult.savedId }, data: { bundleProductIds: nonBundleIds } }).catch(() => {});
        } else {
          await send({ type: "product_failed", index: slots.length - 1, slot: bundleSlot, error: bundleResult.error });
        }
      }

      await send({ type: "batch_complete", successCount, failedCount: slots.length - successCount });
      await upsertDailyLog(successCount, emotionalTheme);
    } catch {
      await send({ type: "error", message: "Batch generation failed" });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
