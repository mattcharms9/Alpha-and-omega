import React from "react";
import { prisma } from "@/lib/db/prisma";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { slugify } from "@/lib/pdf/slugify";
import path from "path";
import fs from "fs/promises";
import type { DocumentProps } from "@react-pdf/renderer";

export async function generateProductPdf(productId: string): Promise<{ pdfPath: string; fileName: string }> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const blueprint = buildBlueprintFromProduct(product);

  const { pdf } = await import("@react-pdf/renderer");
  const type = product.type;

  let TemplateComponent: React.FC<{ blueprint: typeof blueprint }>;
  if (type === "journal") {
    const mod = await import("@/lib/pdf/templates/journal-template");
    TemplateComponent = mod.default;
  } else if (type === "planner") {
    const mod = await import("@/lib/pdf/templates/planner-template");
    TemplateComponent = mod.default;
  } else {
    const mod = await import("@/lib/pdf/templates/workbook-template");
    TemplateComponent = mod.default;
  }

  const element = React.createElement(TemplateComponent, { blueprint }) as React.ReactElement<DocumentProps>;
  const pdfBuffer = await pdf(element).toBuffer();

  const fileName = `${slugify(product.title)}-${product.id.slice(-6)}.pdf`;

  // Write to /tmp/ first (writable on Vercel). Also try public/ for local dev serving.
  const tmpPath = path.join("/tmp", "product-pdfs", fileName);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, pdfBuffer);

  const publicPath = path.join(process.cwd(), "public", "product-pdfs", fileName);
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.writeFile(publicPath, pdfBuffer).catch(() => {});

  const pdfPath = `/product-pdfs/${fileName}`;
  await prisma.product.update({ where: { id: productId }, data: { pdfPath } });

  return { pdfPath, fileName };
}
