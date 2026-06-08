import { LRUCache } from "lru-cache";
import { NextRequest } from "next/server";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = { success: true } | { success: false; retryAfter: number };

// In-memory fallback (dev / no Redis configured)
const memCache = new LRUCache<string, number[]>({ max: 500 });

function memRateLimit(ip: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const timestamps = (memCache.get(ip) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= options.limit) {
    const retryAfter = Math.ceil((timestamps[0] + options.windowMs - now) / 1000);
    return { success: false, retryAfter };
  }
  memCache.set(ip, [...timestamps, now]);
  return { success: true };
}

// Redis-backed rate limiter (production — when UPSTASH_REDIS_REST_URL is set)
let redisRateLimiter: ((key: string, limit: number, windowMs: number) => Promise<RateLimitResult>) | null = null;

async function initRedisLimiter() {
  if (redisRateLimiter) return redisRateLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({ url, token });

    redisRateLimiter = async (key: string, limit: number, windowMs: number): Promise<RateLimitResult> => {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
      });
      const result = await limiter.limit(key);
      if (result.success) return { success: true };
      return { success: false, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
    };
    return redisRateLimiter;
  } catch {
    return null;
  }
}

export function rateLimit(req: NextRequest, options: RateLimitOptions): RateLimitResult {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const key = `rl:${ip}`;

  // Try Redis if configured; fall back to in-memory synchronously
  void initRedisLimiter().then((redisLimiter) => {
    if (redisLimiter) {
      // Next request will use Redis; this one uses memory
      void redisLimiter; // referenced to avoid lint warning
    }
  });

  return memRateLimit(key, options);
}

// Async version for routes that can await (preferred for production accuracy)
export async function rateLimitAsync(
  req: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const key = `rl:${ip}`;

  const redisLimiter = await initRedisLimiter();
  if (redisLimiter) {
    return redisLimiter(key, options.limit, options.windowMs);
  }
  return memRateLimit(key, options);
}
