/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, replace with Redis-backed solution.
 */

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
 * Get the client IP from request headers.
 *
 * SECURITY: X-Forwarded-For is a comma-separated chain "client, proxy1, proxy2…"
 * where each proxy APPENDS the address it received the connection from. The
 * LEFTMOST entry is fully attacker-controlled (a client can send any value), so
 * keying rate limits on it lets an attacker mint unlimited buckets by rotating
 * the header. We take the RIGHTMOST entry instead — the address our trusted edge
 * proxy (Railway) actually observed, which the client cannot forge.
 *
 * NOTE: assumes exactly one trusted proxy hop. If the deployment topology gains
 * additional trusted proxies, index `TRUSTED_PROXY_HOPS` from the right.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
