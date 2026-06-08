import { prisma } from "./prisma";

type SoftDeletableModel = "product" | "brand" | "bankedSignal" | "contentPiece" | "emotionalTrend";

export function notDeleted() {
  return { deletedAt: null };
}

export async function softDelete(model: SoftDeletableModel, id: string): Promise<void> {
  const now = new Date();
  switch (model) {
    case "product":
      await prisma.product.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "brand":
      await prisma.brand.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "bankedSignal":
      await prisma.bankedSignal.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "contentPiece":
      await prisma.contentPiece.update({ where: { id }, data: { deletedAt: now } });
      break;
    case "emotionalTrend":
      await prisma.emotionalTrend.update({ where: { id }, data: { deletedAt: now } });
      break;
  }
}

export async function restore(model: SoftDeletableModel, id: string): Promise<void> {
  const data = { deletedAt: null };
  switch (model) {
    case "product":
      await prisma.product.update({ where: { id }, data });
      break;
    case "brand":
      await prisma.brand.update({ where: { id }, data });
      break;
    case "bankedSignal":
      await prisma.bankedSignal.update({ where: { id }, data });
      break;
    case "contentPiece":
      await prisma.contentPiece.update({ where: { id }, data });
      break;
    case "emotionalTrend":
      await prisma.emotionalTrend.update({ where: { id }, data });
      break;
  }
}
