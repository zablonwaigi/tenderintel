/**
 * Tiny in-memory fixed-window rate limiter (Phase 0 / task 0.4).
 *
 * Keyed by client IP. State lives in a module-level Map, so it is *per process /
 * per instance* — fine for the single self-hosted Coolify container, but not a
 * distributed limiter. If TenderIntel ever runs multiple replicas, swap the Map
 * for Redis (the function signature stays the same).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfter: number;
  limit: number;
}

/**
 * Record a hit for `key` and report whether it is within `limit` per `windowMs`.
 * `now` is injectable for deterministic tests.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0, limit };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      limit,
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0, limit };
}

/** Test-only: clear all buckets so cases don't bleed into each other. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
