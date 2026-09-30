// R9 (HQ API room): THE metering spine. One row per outbound third-party API
// call, so the HQ can answer "how close are we to a limit" from our own data.
//
// LAW (binding): metering failure is ALWAYS silent and can never affect, delay
// or fail the metered call. Every write here is fire-and-forget behind its own
// try/catch — a database outage costs a data point, never an email, a payment
// or a booking step.
//
// This module is safe to import from ANY file, including ones that client
// components also import (postcode.ts is one): prisma is loaded through a
// server-guarded dynamic import, so a browser bundle never executes it —
// logApiCall is a no-op in the browser by construction. That is also the
// honest boundary of the count: browser-direct postcodes.io lookups never
// touch the server and ride alongside uncounted (the API room says so).

const MAX_ENDPOINT_LEN = 160;

// Strip resource ids so per-endpoint rollups group: Stripe-style prefixed ids
// (pi_…, acct_…), UUIDs, cuids and long hex/numeric segments become {id}.
const ID_SEGMENT =
  /\b(?:[a-z]{2,8}_[A-Za-z0-9]{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,}|[0-9a-f]{16,}|\d{6,})\b/g;

export function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(ID_SEGMENT, '{id}').slice(0, MAX_ENDPOINT_LEN);
}

export interface ApiCallInfo {
  status: 'ok' | 'error';
  httpStatus?: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

/** Fire-and-forget: writes an ApiCallLog row, never throws, no-op in browser. */
export function logApiCall(provider: string, endpoint: string, info: ApiCallInfo): void {
  if (typeof window !== 'undefined') return;
  try {
    void import('@/lib/db/prisma')
      .then(({ default: prisma }) =>
        prisma.apiCallLog.create({
          data: {
            provider,
            endpoint: normalizeEndpoint(endpoint),
            status: info.status,
            httpStatus: info.httpStatus ?? null,
            durationMs: info.durationMs ?? null,
            meta: info.meta ? JSON.parse(JSON.stringify(info.meta)) : undefined,
          },
        })
      )
      .catch(() => {});
  } catch {
    // The law: never let metering surface to the caller.
  }
}

/**
 * Wrap one outbound call. The wrapped promise's outcome is passed through
 * untouched — resolve and reject both reach the caller exactly as the
 * provider produced them; the log rides alongside.
 */
export async function countedCall<T>(
  provider: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    logApiCall(provider, endpoint, { status: 'ok', durationMs: Date.now() - t0 });
    return out;
  } catch (err) {
    logApiCall(provider, endpoint, {
      status: 'error',
      durationMs: Date.now() - t0,
      meta: { message: err instanceof Error ? err.message.slice(0, 300) : 'unknown error' },
    });
    throw err;
  }
}

/**
 * Stripe is counted via the SDK's own 'response' event on the singleton — the
 * census's zero-call-site-rewrite path: every SDK request emits one event with
 * method, path, HTTP status and elapsed ms. Attached once in src/lib/stripe.ts.
 */
export function attachStripeMetering(stripe: {
  on: (event: 'response', handler: (res: unknown) => void) => unknown;
}): void {
  try {
    stripe.on('response', (res) => {
      const r = res as { method?: string; path?: string; status?: number; elapsed?: number };
      if (!r || !r.path) return;
      logApiCall('stripe', `${(r.method || 'GET').toUpperCase()} ${r.path}`, {
        status: typeof r.status === 'number' && r.status < 400 ? 'ok' : 'error',
        httpStatus: r.status,
        durationMs: r.elapsed,
      });
    });
  } catch {
    // Metering must never break the Stripe singleton.
  }
}
