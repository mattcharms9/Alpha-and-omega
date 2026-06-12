import React from "react";
import { prisma } from "@/lib/db/prisma";
import { buildBlueprintFromProduct } from "@/lib/pdf/build-blueprint";
import { getPdfPath } from "@/lib/utils/file-paths";
import path from "path";
import fs from "fs/promises";
import type { DocumentProps } from "@react-pdf/renderer";

async function uploadToBlob(buffer: Buffer, filename: string): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`pdfs/${filename}`, buffer, { access: "public" });
    return blob.url;
  } catch (err) {
    console.warn("[pdf-service] Vercel Blob upload failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

export async function generateProductPdf(productId: string): Promise<{ pdfPath: string; fileName: string; pdfBlobUrl: string | null }> {
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
  const pdfBuffer = (await pdf(element).toBuffer()) as unknown as Buffer;

  // Write to /tmp (the only writable path on Vercel at runtime)
  const tmpPath = getPdfPath(productId);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, pdfBuffer);

  // Verify the file was actually written
  const stat = await fs.stat(tmpPath).catch(() => null);
  if (!stat || stat.size === 0) {
    throw new Error("PDF file was not created — @react-pdf/renderer may have failed silently");
  }
  console.log(`[pdf-service] PDF written to /tmp: ${stat.size} bytes`);

  // Determine filename for Etsy and blob storage
  const { slugify } = await import("@/lib/pdf/slugify");
  const fileName = `${slugify(product.title)}-${product.id.slice(-6)}.pdf`;

  // Upload to Vercel Blob if token is configured (enables cross-invocation persistence)
  const pdfBlobUrl = await uploadToBlob(pdfBuffer, fileName);
  if (pdfBlobUrl) {
    console.log(`[pdf-service] PDF uploaded to Vercel Blob: ${pdfBlobUrl}`);
  } else {
    console.log("[pdf-service] Vercel Blob not configured — PDF available in /tmp for this invocation only");
  }

  const pdfPath = `/product-pdfs/${fileName}`;
  await prisma.product.update({
    where: { id: productId },
    data: { pdfPath, ...(pdfBlobUrl ? { pdfBlobUrl } : {}) },
  });

  return { pdfPath, fileName, pdfBlobUrl };
}
