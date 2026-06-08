import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n}`;
  }
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "…";
}

export const EMOTION_COLORS: Record<string, string> = {
  anxiety: "#f43f5e",
  loneliness: "#8b5cf6",
  burnout: "#f59e0b",
  insecurity: "#ec4899",
  overwhelm: "#06b6d4",
  stagnation: "#6366f1",
  grief: "#a78bfa",
  purpose: "#10b981",
  discipline: "#c9a84c",
  identity: "#3b82f6",
};

export const PLATFORM_COLORS: Record<string, string> = {
  "Amazon KDP": "#f59e0b",
  "Etsy": "#f97316",
  "Gumroad": "#10b981",
  "Shopify": "#22c55e",
  "TikTok Shop": "#ec4899",
  "Notion": "#6366f1",
};
