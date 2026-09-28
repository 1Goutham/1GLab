/**
 * Sliding-window rate limiter. In-memory per server instance — plenty for a
 * single-user app. For multi-region deployments swap the Map for Redis/Upstash
 * behind the same function signature.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterMs: windowMs - (now - hits[0]) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterMs: 0 };
}

export const AI_LIMIT = { limit: Number(process.env.AI_RATE_LIMIT ?? 40), windowMs: 10 * 60_000 };
