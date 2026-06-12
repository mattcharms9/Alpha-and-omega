export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateCoverImagePlan } from "@/lib/ai/image-engine";
import { generateMockupConcepts } from "@/lib/ai/mockup-engine";
import type { ProductBlueprint } from "@/lib/ai/product-engine";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import type { Prisma } from "@prisma/client";

const PlanSchema = z.object({ productId: z.string().min(1) });

const GenerateSchema = z.object({
  productId: z.string().min(1),
  variant: z.enum(["primary", "mockup", "thumbnail"]),
  prompt: z.object({
    dallePrompt: z.string(),
    dimensions: z.enum(["1024x1024", "1536x1024", "1024x1536"]),
    textOverlay: z.string(),
    styleDirection: z.string(),
    colorPalette: z.array(z.string()),
  }),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const body = await req.json() as unknown;

    if (action === "plan") {
      const { productId } = PlanSchema.parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const blueprint = product as unknown as ProductBlueprint;
      const plan = await generateCoverImagePlan(blueprint);
      return NextResponse.json({ success: true, data: plan });
    }

    if (action === "generate") {
      const { productId, variant, prompt } = GenerateSchema.parse(body);

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured — add it to .env to enable image generation");

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: openaiKey });

      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt.dallePrompt,
        n: 1,
        size: prompt.dimensions,
        quality: "high",
      });

      const b64 = image.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image data returned from OpenAI");
      const buffer = Buffer.from(b64, "base64");

      const filename = `${productId}-${variant}.png`;
      const savePath = path.join(process.cwd(), "public", "product-images", filename);
      await fs.mkdir(path.dirname(savePath), { recursive: true });
      await fs.writeFile(savePath, buffer);

      const publicPath = `/product-images/${filename}`;
      await prisma.product.update({ where: { id: productId }, data: { coverImagePath: publicPath } });

      return NextResponse.json({ success: true, data: { path: publicPath, variant } });
    }

    if (action === "mockup") {
      const { productId } = z.object({ productId: z.string().min(1) }).parse(body);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const blueprint = product as unknown as ProductBlueprint;
      const concepts = await generateMockupConcepts(blueprint, 3);

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        // Return concepts without images if no API key
        return NextResponse.json({ success: true, data: { concepts, paths: [] } });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: openaiKey });

      const results = await Promise.allSettled(
        concepts.map(async (concept, i) => {
          const image = await openai.images.generate({
            model: "gpt-image-1",
            prompt: concept.dallePrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
          });
          const b64 = image.data?.[0]?.b64_json;
          if (!b64) throw new Error("No image data");
          const buffer = Buffer.from(b64, "base64");
          const filename = `${productId}-mockup-${i}.png`;
          const savePath = path.join(process.cwd(), "public", "product-mockups", filename);
          await fs.mkdir(path.dirname(savePath), { recursive: true });
          await fs.writeFile(savePath, buffer);
          return { path: `/product-mockups/${filename}`, type: concept.mockupType };
        })
      );

      const paths = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ path: string; type: string }>).value);

      const existing = (product.mockupPaths ?? []) as { path: string; type: string }[];
      const merged = [...existing, ...paths];
      await prisma.product.update({
        where: { id: productId },
        data: { mockupPaths: merged as unknown as Prisma.InputJsonValue },
      });

      return NextResponse.json({ success: true, data: { concepts, paths } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
