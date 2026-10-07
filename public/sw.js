// RENA-048 / RENA-055 (B2a, James-ruled D-j): service worker v6.
//
// The SW caches NO /api/* response, ever. Every API request, every non-GET
// request and every cross-origin request passes straight through to the
// network (no respondWith), so a route's own auth is the only gate and no
// account's data can survive in origin-scoped Cache Storage for the next
// account on the same device. What the SW still does:
//   - content-hashed build assets under /_next/static/ are served cache-first
//     (immutable by construction);
//   - a document navigation that fails twice (R11's one honest retry kept)
//     falls back to the precached /offline page; a document is never served
//     from cache otherwise;
//   - the push and notificationclick handlers.
//
// History: v3 → v4 (H44) purged decrypted dispute evidence; v4 → v5
// (Home-after-login) purged authed API bodies written before the routes sent
// private, no-store. v5 → v6 removes the dynamic cache entirely; the activate
// handler deletes every cache that is not the current static cache, so
// rena-dynamic-v3/v4/v5 and rena-static-v5 are purged from every installed
// client on the first load after deploy.
const STATIC_CACHE = 'rena-static-v6';
const OFFLINE_URL = '/offline';

// Install never fails over one asset (James-ruled amendment): the offline page
// and each build asset it references are cached independently and every
// failure is swallowed. A worker that cannot precache still installs; the
// offline fallback then degrades to the minimal inline page below.
self.addEventListener('install', (event) => {
  event.waitUntil(precacheOffline());
  self.skipWaiting();
});

async function precacheOffline() {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const res = await fetch(OFFLINE_URL, { cache: 'no-store', credentials: 'omit' });
    if (!res || !res.ok) return;
    const html = await res.clone().text();
    await cache.put(OFFLINE_URL, res);
    const assets = offlineAssetPaths(html);
    await Promise.all(
      assets.map((path) =>
        fetch(path)
          .then((r) => (r && r.ok ? cache.put(path, r) : undefined))
          .catch(() => undefined)
      )
    );
  } catch {
    // Precache is best effort by design: never reject install.
  }
}

// Same-origin /_next/static/ paths referenced by the offline page's HTML
// (stylesheets, scripts, fonts). Plain string scanning, no regex escapes.
function offlineAssetPaths(html) {
  const found = new Set();
  const marker = '/_next/static/';
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at === -1) break;
    let end = at;
    while (end < html.length && !'"\' <>)'.includes(html[end])) end += 1;
    const path = html.slice(at, end).split('?')[0].split('#')[0];
    if (path.length > marker.length) found.add(path);
    from = end;
  }
  return Array.from(found);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Mutations, cross-origin requests (Stripe, fonts, Sentry) and the whole
  // API surface are never touched: pure passthrough, no respondWith.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigateWithOfflineFallback(request));
  }
  // Everything else (icons, images, fonts, manifest, ?v= stamped assets):
  // passthrough to the browser HTTP cache, which honours the server headers.
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function navigateWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    // R11 (first-landing defect): one honest retry before any fallback, so a
    // single transient failure never paints the offline screen on a healthy
    // network. A navigate-mode Request cannot be reconstructed, so the retry
    // is a plain GET of the same URL.
    try {
      return await fetch(request.url, { cache: 'no-store', credentials: 'include' });
    } catch {
      const offline = await caches.match(OFFLINE_URL);
      return offline || minimalOfflineResponse();
    }
  }
}

function minimalOfflineResponse() {
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:4rem 1rem"><h1>You are offline</h1><p>Check your connection and try again.</p><button onclick="location.reload()">Try again</button></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Rena Cleaning', options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url === url);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
