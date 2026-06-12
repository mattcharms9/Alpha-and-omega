export const TMP = "/tmp";

export function getPdfPath(productId: string): string {
  return `${TMP}/product-${productId}.pdf`;
}

export function getCoverPath(productId: string): string {
  return `${TMP}/cover-${productId}.jpg`;
}

export function getMockupPath(productId: string, index: number): string {
  return `${TMP}/mockup-${productId}-${index}.jpg`;
}

export function getGalleryPath(productId: string, rank: number): string {
  return `${TMP}/gallery-${productId}-${rank}.jpg`;
}

export function getBlueprintPath(productId: string): string {
  return `${TMP}/blueprint-${productId}.json`;
}
