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
 * SECURITY / proxy topology — read before changing:
 *  - `cf-connecting-ip` is set by Cloudflare to the true client IP and stripped
 *    from inbound requests, so it is unspoofable *iff* traffic actually flows
 *    through Cloudflare's proxy.
 *  - `X-Forwarded-For` is a chain "client, proxy1, proxy2…" where each hop
 *    APPENDS. The LEFTMOST entry is fully client-controlled (spoofable); the
 *    RIGHTMOST is what our nearest trusted proxy observed — correct for a single
 *    trusted hop (e.g. Railway with no Cloudflare proxy in front).
 *
 * Set `TRUSTED_PROXY` once the topology is known to remove all ambiguity:
 *   'cloudflare' → trust `cf-connecting-ip` only (use when behind CF proxy)
 *   'railway'    → trust rightmost `X-Forwarded-For` only (use when CF is NOT
 *                  proxying — this prevents a spoofed cf-connecting-ip header)
 *
 * If `TRUSTED_PROXY` is unset we best-effort prefer cf-connecting-ip, then
 * rightmost XFF, then x-real-ip. CAVEAT: when NOT behind Cloudflare, an attacker
 * can spoof `cf-connecting-ip`; set TRUSTED_PROXY=railway to close that.
 */
export function getClientIp(request: Request): string {
  const mode = process.env.TRUSTED_PROXY;
  const cf = request.headers.get('cf-connecting-ip')?.trim() || undefined;
  const realIp = request.headers.get('x-real-ip')?.trim() || undefined;

  const rightmostXff = (): string | undefined => {
    const forwarded = request.headers.get('x-forwarded-for');
    if (!forwarded) return undefined;
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : undefined;
  };

  if (mode === 'cloudflare') return cf || realIp || 'unknown';
  if (mode === 'railway') return rightmostXff() || realIp || 'unknown';

  // Topology unknown — best effort (see CAVEAT above).
  return cf || rightmostXff() || realIp || 'unknown';
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
