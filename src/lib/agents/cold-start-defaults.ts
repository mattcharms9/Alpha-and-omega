import type { PerformingPatternAgent } from "./agent-types";

// Default patterns for accounts with no sales data.
// Based on statistically highest-converting digital product formats on Etsy.
// Replaced by real performance data once products are in the catalog.

export const COLD_START_PERFORMANCE_PATTERNS: PerformingPatternAgent[] = [
  { dimension: "format", value: "knowledge_guide", avgRevenue: 45, productCount: 0 },
  { dimension: "format", value: "journal", avgRevenue: 35, productCount: 0 },
  { dimension: "format", value: "planner", avgRevenue: 28, productCount: 0 },
  { dimension: "emotion", value: "anxiety", avgRevenue: 38, productCount: 0 },
  { dimension: "emotion", value: "grief", avgRevenue: 42, productCount: 0 },
  { dimension: "emotion", value: "self_improvement", avgRevenue: 32, productCount: 0 },
  { dimension: "pricePoint", value: "$9.99-$14.99", avgRevenue: 12, productCount: 0 },
];

export const COLD_START_TOP_CATEGORIES = [
  "anxiety journals",
  "grief journals",
  "self-care planners",
  "budget planners",
  "manifestation journals",
  "sobriety journals",
];

export const COLD_START_MANAGER_NOTE =
  "Note: This seller has no catalog history yet. Prioritize conservative, proven opportunities — knowledge guides, journals, evergreen emotional themes (anxiety, grief, self-improvement). Avoid niche bets on first run.";

export function isColdStart(productCount: number, patternCount: number): boolean {
  return productCount === 0 && patternCount === 0;
}
