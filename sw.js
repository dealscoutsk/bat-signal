/* Bat Signal — offline service worker (site root scope). */
const CACHE = 'bat-signal-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Live data must NEVER go through the cache: the shared sky
  // (api.restful-api.dev) and address lookups (nominatim) go straight to the
  // network. The old handler cached every GET, so after the first load the
  // 20-second refresh kept serving the first-ever sky and the app never saw
  // other dads' garages or signals — and a stale/poisoned cached API answer
  // could read as "offline". Only the app's own files and map tiles
  // (immutable) are cached.
  const sameOrigin = url.origin === self.location.origin;
  const isTile = url.hostname.endsWith('tile.openstreetmap.org');
  if (!sameOrigin && !isTile) return;
  if (req.mode === 'navigate') {
    // Network first for pages, fall back to the cached app when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Cache first for the app's own assets and map tiles.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
