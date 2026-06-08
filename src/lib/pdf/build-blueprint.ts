import type { ProductBlueprint, ProductSection, CoverConcept, PricingStrategy } from "@/lib/ai/product-engine";
import type { Product } from "@prisma/client";

function toTyped<T>(json: unknown): T {
  return json as T;
}

export function buildBlueprintFromProduct(product: Product): ProductBlueprint {
  const sections = toTyped<ProductSection[]>(product.sections);
  const coverConcept = toTyped<CoverConcept>(product.coverConcept) ?? {
    colorPalette: ["#1A1917", "#F7F7F5"],
    visualTheme: "minimal",
    typography: "elegant",
    mood: "calm",
    symbols: [],
  };
  const pricingStrategy = toTyped<PricingStrategy>(product.pricingStrategy) ?? {
    printPrice: 0,
    digitalPrice: 9,
    bundlePrice: 0,
    reasoning: "",
  };

  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle,
    tagline: product.tagline,
    type: product.type as ProductBlueprint["type"],
    targetEmotion: product.targetEmotion,
    targetAudience: product.targetAudience,
    audienceArchetype: product.audienceArchetype,
    pageCount: product.pageCount,
    sections: Array.isArray(sections) ? sections : [],
    psychologicalFramework: product.psychologicalFramework,
    transformationPromise: product.transformationPromise,
    emotionalHooks: toTyped<string[]>(product.emotionalHooks) ?? [],
    coverConcept,
    marketingAngles: toTyped<string[]>(product.marketingAngles) ?? [],
    pricingStrategy,
    platforms: toTyped<string[]>(product.platforms) ?? [],
    estimatedMonthlyRevenue: product.estimatedMonthlyRevenue,
    competitiveAdvantage: product.competitiveAdvantage,
    keywords: toTyped<string[]>(product.keywords) ?? [],
    descriptionShort: product.descriptionShort,
    descriptionLong: product.descriptionLong,
  };
}
