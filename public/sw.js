// H44: version bumped v3 → v4 to PURGE the poisoned dynamic cache. The old
// networkFirst cached decrypted dispute-evidence bytes (and any authed API
// response) into origin-scoped Cache Storage, which ignored the route's
// `no-store` and served the file with no auth consulted on a network failure.
// The activate handler deletes every cache whose name isn't in the current
// set, so the bump wipes rena-dynamic-v3 from every existing client on update.
const STATIC_CACHE = 'rena-static-v4';
const DYNAMIC_CACHE = 'rena-dynamic-v4';

// H44: sensitive authed API surfaces that must NEVER touch the cache — never
// written, never served from cache. Evidence is encrypted-at-rest material in
// an adversarial proceeding; the disputes API carries the same case data. The
// authed party-scoped route is the EXCLUSIVE path, so the SW bypasses these to
// the network entirely (a genuine 401/403 must reach the browser, and no byte
// may survive in a shared origin cache).
const NEVER_CACHE_PATTERNS = [/^\/api\/disputes\//];

function isNeverCache(pathname) {
  return NEVER_CACHE_PATTERNS.some((re) => re.test(pathname));
}

const STATIC_ASSETS = ['/', '/offline', '/manifest.json'];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event with network-first strategy for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip auth and API mutation requests
  if (url.pathname.startsWith('/api/auth')) return;

  // H44: sensitive authed surfaces bypass the SW entirely — pure passthrough
  // to the network so the route's own auth is the ONLY gate and nothing is
  // ever cached. `return` (no respondWith) lets the browser fetch normally.
  if (isNeverCache(url.pathname)) return;

  // API requests: network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Static assets: cache first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Pages: network first with offline fallback
  event.respondWith(networkFirstWithOffline(request));
});

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

// Helper functions
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    // H44: never cache a response the server marked private/no-store. Any
    // authed route that opts out of caching (evidence sets `private, no-store`)
    // is honoured here too — belt-and-braces beside the path allowlist above.
    const cc = response.headers.get('Cache-Control') || '';
    const cacheable = response.ok && !/no-store|private/i.test(cc);
    if (cacheable) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return (
      cached ||
      new Response('{"error":"offline"}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    return new Response('', { status: 503 });
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/.test(pathname);
}
