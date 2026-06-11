import "dotenv/config";
import { publishProductToEtsy } from "../lib/services/etsy-publish-service";
import { prisma } from "../lib/db/prisma";

// Most recent product with PDF + cover that isn't yet on Etsy
async function main() {
  const product = await prisma.product.findFirst({
    where: {
      pdfPath: { not: null },
      coverImagePath: { not: null },
      status: { not: "published_etsy" },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, type: true, pdfPath: true, coverImagePath: true, status: true },
  });

  if (!product) {
    console.error("No eligible product found (need PDF + cover + not yet on Etsy)");
    process.exit(1);
  }

  console.log("── Test: publishProductToEtsy ───────────────────────");
  console.log("  Product ID:", product.id);
  console.log("  Title:", product.title.slice(0, 80));
  console.log("  Type:", product.type);
  console.log("  PDF:", product.pdfPath);
  console.log("  Cover:", product.coverImagePath);
  console.log("─────────────────────────────────────────────────────");

  const result = await publishProductToEtsy(product.id);

  console.log("\n✅ PUBLISHED TO ETSY");
  console.log("  listingId:", result.listingId);
  console.log("  listingUrl:", result.listingUrl);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n❌ Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
