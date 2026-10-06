import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

// RENA-048 / RENA-055 (B2a): the shipped public/sw.js, loaded into a fake
// worker scope with a fake Cache Storage, so every assertion runs against the
// exact file browsers receive (no copy, no extraction).
// SW_UNDER_TEST lets the gate prove the suite fails on the previous worker.
const SOURCE = readFileSync(
  process.env.SW_UNDER_TEST ?? join(__dirname, '..', '..', '..', 'public', 'sw.js'),
  'utf8'
);
const ORIGIN = 'https://www.renacleaning.co.uk';

type Handler = (event: unknown) => void;

function fakeCaches(initial: Record<string, Record<string, Response>> = {}) {
  const store = new Map<string, Map<string, Response>>();
  for (const [name, entries] of Object.entries(initial)) {
    store.set(name, new Map(Object.entries(entries)));
  }
  const keyOf = (req: Request | string) =>
    new URL(typeof req === 'string' ? req : req.url, ORIGIN).pathname;
  return {
    store,
    api: {
      async open(name: string) {
        const c = store.get(name) ?? new Map<string, Response>();
        store.set(name, c);
        return {
          async put(req: Request | string, res: Response) {
            c.set(keyOf(req), res);
          },
        };
      },
      async keys() {
        return Array.from(store.keys());
      },
      async delete(name: string) {
        return store.delete(name);
      },
      async match(req: Request | string) {
        const k = keyOf(req);
        for (const c of store.values()) {
          const hit = c.get(k);
          if (hit) return hit.clone();
        }
        return undefined;
      },
    },
  };
}

function loadWorker(opts: {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  caches?: ReturnType<typeof fakeCaches>;
}) {
  const handlers: Record<string, Handler> = {};
  const caches = opts.caches ?? fakeCaches();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: () => undefined,
    clients: { claim: () => undefined },
    registration: {},
  };
  runInNewContext(SOURCE, { self, caches: caches.api, fetch: opts.fetchImpl, URL, Response });
  return { handlers, caches };
}

function fetchEvent(path: string, init: { method?: string; mode?: string; origin?: string } = {}) {
  const url = `${init.origin ?? ORIGIN}${path}`;
  let responded: Promise<Response> | null = null;
  const request = { url, method: init.method ?? 'GET', mode: init.mode ?? 'cors' };
  return {
    event: {
      request,
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
    },
    responded: () => responded,
    response: async (): Promise<Response> => {
      if (!responded) throw new Error(`no respondWith for ${path}`);
      return responded;
    },
  };
}

function cacheOf(caches: ReturnType<typeof fakeCaches>, name: string): Map<string, Response> {
  const c = caches.store.get(name);
  if (!c) throw new Error(`no cache ${name}`);
  return c;
}

const ok = (body = 'ok', type = 'text/plain') =>
  new Response(body, { status: 200, headers: { 'Content-Type': type } });

describe('service worker v6 (RENA-048)', () => {
  it('never handles any /api/* request, for any method', () => {
    const { handlers } = loadWorker({ fetchImpl: async () => ok() });
    const paths = [
      '/api/bookings',
      '/api/auth/session',
      '/api/disputes/x/evidence/y',
      '/api/cleaners?postcode=E4',
      '/api/job-check',
      '/api/unsubscribe?token=t',
      '/api',
    ];
    for (const path of paths) {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        const f = fetchEvent(path, { method });
        handlers.fetch(f.event);
        expect(f.responded(), `${method} ${path}`).toBeNull();
      }
    }
  });

  it('never handles a cross-origin request (Stripe, fonts, Sentry)', () => {
    const { handlers } = loadWorker({ fetchImpl: async () => ok() });
    for (const origin of ['https://js.stripe.com', 'https://o1.ingest.sentry.io']) {
      const f = fetchEvent('/v3/', { origin });
      handlers.fetch(f.event);
      expect(f.responded()).toBeNull();
    }
  });

  it('serves /_next/static/ cache-first and nothing else from cache', async () => {
    let calls = 0;
    const caches = fakeCaches();
    const { handlers } = loadWorker({
      fetchImpl: async () => {
        calls += 1;
        return ok('asset');
      },
      caches,
    });
    const a = fetchEvent('/_next/static/chunks/main-abc.js');
    handlers.fetch(a.event);
    expect(await (await a.response()).text()).toBe('asset');
    const b = fetchEvent('/_next/static/chunks/main-abc.js');
    handlers.fetch(b.event);
    expect(await (await b.response()).text()).toBe('asset');
    expect(calls).toBe(1);

    for (const path of ['/icons/icon-192x192.png', '/manifest.json', '/images/hero.webp?v=3']) {
      const f = fetchEvent(path);
      handlers.fetch(f.event);
      expect(f.responded(), path).toBeNull();
    }
  });

  it('never serves a document from cache while the network answers', async () => {
    const caches = fakeCaches({ 'rena-static-v6': { '/account': ok('cached account A') } });
    const { handlers } = loadWorker({ fetchImpl: async () => ok('fresh'), caches });
    const f = fetchEvent('/account', { mode: 'navigate' });
    handlers.fetch(f.event);
    expect(await (await f.response()).text()).toBe('fresh');
  });

  it('retries a failed navigation once, then falls back to /offline, never to a cached page', async () => {
    let calls = 0;
    const caches = fakeCaches({
      'rena-static-v6': {
        '/offline': ok('offline page', 'text/html'),
        '/account': ok('cached account A'),
      },
    });
    const { handlers } = loadWorker({
      fetchImpl: async () => {
        calls += 1;
        throw new TypeError('network');
      },
      caches,
    });
    const f = fetchEvent('/account', { mode: 'navigate' });
    handlers.fetch(f.event);
    expect(await (await f.response()).text()).toBe('offline page');
    expect(calls).toBe(2);
  });

  it('serves the minimal inline page when /offline was never precached', async () => {
    const { handlers } = loadWorker({
      fetchImpl: async () => {
        throw new TypeError('network');
      },
    });
    const f = fetchEvent('/', { mode: 'navigate' });
    handlers.fetch(f.event);
    const res = await f.response();
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('You are offline');
  });

  it('a navigation the retry recovers is served from the retry', async () => {
    let calls = 0;
    const { handlers } = loadWorker({
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('reset');
        return ok('second try');
      },
    });
    const f = fetchEvent('/services', { mode: 'navigate' });
    handlers.fetch(f.event);
    expect(await (await f.response()).text()).toBe('second try');
  });

  it('activate purges every older cache generation and keeps only rena-static-v6', async () => {
    const caches = fakeCaches({
      'rena-dynamic-v3': {},
      'rena-dynamic-v4': {},
      'rena-dynamic-v5': { '/api/bookings': ok('account A bookings') },
      'rena-static-v5': {},
      'rena-static-v6': {},
    });
    const { handlers } = loadWorker({ fetchImpl: async () => ok(), caches });
    let done: Promise<unknown> = Promise.resolve();
    handlers.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(Array.from(caches.store.keys())).toEqual(['rena-static-v6']);
    expect(await caches.api.match('/api/bookings')).toBeUndefined();
  });

  it('install precaches /offline and the build assets it references', async () => {
    const html =
      '<html><head><link rel="stylesheet" href="/_next/static/css/a.css"><script src="/_next/static/chunks/b.js?x=1" async></script></head></html>';
    const fetched: string[] = [];
    const caches = fakeCaches();
    const { handlers } = loadWorker({
      fetchImpl: async (input) => {
        const path = String(input);
        fetched.push(path);
        return path === '/offline' ? ok(html, 'text/html') : ok('asset');
      },
      caches,
    });
    let done: Promise<unknown> = Promise.resolve();
    handlers.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    const v6 = cacheOf(caches, 'rena-static-v6');
    expect(Array.from(v6.keys()).sort()).toEqual([
      '/_next/static/chunks/b.js',
      '/_next/static/css/a.css',
      '/offline',
    ]);
  });

  it('install never fails over one asset, nor over the offline page itself', async () => {
    const html = '<link href="/_next/static/css/a.css"><link href="/_next/static/css/broken.css">';
    const caches = fakeCaches();
    const { handlers } = loadWorker({
      fetchImpl: async (input) => {
        const path = String(input);
        if (path === '/offline') return ok(html, 'text/html');
        if (path.includes('broken')) throw new TypeError('network');
        return ok('asset');
      },
      caches,
    });
    let done: Promise<unknown> = Promise.resolve();
    handlers.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await expect(done).resolves.toBeUndefined();
    expect(cacheOf(caches, 'rena-static-v6').has('/_next/static/css/a.css')).toBe(true);

    const failing = loadWorker({
      fetchImpl: async () => {
        throw new TypeError('network');
      },
    });
    let done2: Promise<unknown> = Promise.resolve();
    failing.handlers.install({ waitUntil: (p: Promise<unknown>) => (done2 = p) });
    await expect(done2).resolves.toBeUndefined();
  });

  it('keeps the push handler icon paths that exist on disk (RENA-058)', () => {
    expect(SOURCE).toContain("icon: '/icons/icon-192x192.png'");
    expect(SOURCE).toContain("badge: '/icons/icon-72x72.png'");
  });
});
