import type { EmotionalIntelligenceReport } from "@/lib/ai/intelligence-engine";

const CACHE_KEY = "ao:intelligence:lastScan";
const CACHE_TTL_HOURS = 24;
const NICHE_EXPAND_PREFIX = "ao:niche-expand:";
const NICHE_EXPAND_TTL_HOURS = 48;

export interface CachedScan {
  result: EmotionalIntelligenceReport;
  timestamp: number;
  expiresAt: number;
  scanType: string;
}

export function saveScanToCache(
  result: EmotionalIntelligenceReport,
  scanType = "full"
): void {
  try {
    const cached: CachedScan = {
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000,
      scanType,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage unavailable (SSR, incognito quota) — silently skip
  }
}

export function loadScanFromCache(): CachedScan | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedScan;
    if (Date.now() > cached.expiresAt) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export function clearScanCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function getScanAge(cached: Pick<CachedScan, "timestamp">): string {
  const diffMs = Date.now() - cached.timestamp;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/** Returns the cache staleness tier for UI coloring. */
export function getStaleTier(
  timestamp: number
): "fresh" | "stale" | "very-stale" {
  const ageMs = Date.now() - timestamp;
  if (ageMs < 24 * 60 * 60 * 1000) return "fresh";
  if (ageMs < 72 * 60 * 60 * 1000) return "stale";
  return "very-stale";
}

// ── Niche expansion cache ─────────────────────────────────────────────────────

export function saveNicheExpansionToCache(
  emotion: string,
  data: unknown
): void {
  try {
    localStorage.setItem(
      `${NICHE_EXPAND_PREFIX}${emotion}`,
      JSON.stringify({
        data,
        expiresAt: Date.now() + NICHE_EXPAND_TTL_HOURS * 60 * 60 * 1000,
      })
    );
  } catch {}
}

export function loadNicheExpansionFromCache(emotion: string): unknown | null {
  try {
    const raw = localStorage.getItem(`${NICHE_EXPAND_PREFIX}${emotion}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: unknown; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(`${NICHE_EXPAND_PREFIX}${emotion}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
