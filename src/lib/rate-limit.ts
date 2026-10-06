/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, replace with Redis-backed solution.
 */

import { clientIpOrUnknown } from '@/lib/http/client-ip';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    });
  },
  5 * 60 * 1000
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (e.g. IP address or email).
 * @param key Unique identifier for the rate limit bucket
 * @param maxRequests Maximum requests allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * The client IP for a Request. RENA-002: one chooser for the whole app,
 * src/lib/http/client-ip.ts (Edge-safe, shared with the middleware); this
 * wrapper keeps the Request-taking signature the route limiters use.
 */
export function getClientIp(request: Request): string {
  return clientIpOrUnknown(request.headers);
}

/**
 * Per-IP rate-limit guard for a route. Resolves the client IP, buckets on
 * `${key}:${ip}`, and returns either { ok: true } or { ok: false, retryAfter }
 * (seconds). Callers turn the false case into a 429 with a Retry-After header.
 */
export function rateLimit(
  request: Request,
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const ip = getClientIp(request);
  const result = checkRateLimit(`${key}:${ip}`, maxRequests, windowMs);
  if (result.allowed) return { ok: true };
  return { ok: false, retryAfter: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)) };
}
