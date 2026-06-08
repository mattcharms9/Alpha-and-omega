import sharp from "sharp";
import path from "node:path";

// Etsy minimum: 2000px on longest side
// Target: 2700×2025 (4:3 ratio) for best search visibility
const ETSY_MIN = 2000;
const ETSY_W = 2700;
const ETSY_H = 2025;

export interface ResizeResult {
  path: string;
  width: number;
  height: number;
  wasResized: boolean;
}

export async function resizeForEtsy(inputPath: string): Promise<ResizeResult> {
  const meta = await sharp(inputPath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  if (Math.max(w, h) >= ETSY_MIN) {
    return { path: inputPath, width: w, height: h, wasResized: false };
  }

  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const outPath = path.join(dir, `${base}-etsy${ext}`);

  await sharp(inputPath)
    .resize(ETSY_W, ETSY_H, { fit: "cover", position: "center", kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 92 })
    .toFile(outPath);

  return { path: outPath, width: ETSY_W, height: ETSY_H, wasResized: true };
}
