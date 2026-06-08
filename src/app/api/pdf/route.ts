import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import type { DocumentProps } from "@react-pdf/renderer";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { slugify } from "@/lib/pdf/slugify";

const GenerateSchema = z.object({ productId: z.string().min(1) });
const StatusSchema = z.object({ productId: z.string().min(1) });

async function renderProductPdf(productId: string): Promise<{ pdfPath: string; fileName: string }> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const blueprint = buildBlueprintFromProduct(product);

  // Dynamic import to keep PDF renderer server-only
  const { pdf } = await import("@react-pdf/renderer");

  let TemplateComponent: React.FC<{ blueprint: typeof blueprint }>;
  const type = product.type;
  if (type === "journal") {
    const mod = await import("@/lib/pdf/templates/journal-template");
    TemplateComponent = mod.default;
  } else if (type === "planner") {
    const mod = await import("@/lib/pdf/templates/planner-template");
    TemplateComponent = mod.default;
  } else {
    // workbook, digital-system, hybrid, and any other type → workbook template
    const mod = await import("@/lib/pdf/templates/workbook-template");
    TemplateComponent = mod.default;
  }

  const element = React.createElement(TemplateComponent, { blueprint }) as React.ReactElement<DocumentProps>;
  const pdfBuffer = await pdf(element).toBuffer();

  const fileName = `${slugify(product.title)}-${product.id.slice(-6)}.pdf`;
  const outputPath = path.join(process.cwd(), "public", "product-pdfs", fileName);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdfBuffer);

  const publicPath = `/product-pdfs/${fileName}`;
  await prisma.product.update({ where: { id: productId }, data: { pdfPath: publicPath } });

  return { pdfPath: publicPath, fileName };
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "status") {
    try {
      const { productId } = StatusSchema.parse({ productId: searchParams.get("productId") });
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { pdfPath: true } });
      if (!product) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true, data: { hasPdf: !!product.pdfPath, pdfPath: product.pdfPath ?? null } });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. PDF generation is rate-limited." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "generate";

  if (action !== "generate") {
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }

  try {
    const body = await req.json() as unknown;
    const { productId } = GenerateSchema.parse(body);
    const result = await renderProductPdf(productId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
