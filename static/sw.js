const CACHE_NAME = 'desqta-static-v1';
const STATIC_ASSETS = [
  '/',
  '/favicon.png',
  '/icon.png',
  '/svelte.svg',
  '/tauri.svg',
  '/vite.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for GET requests to same-origin static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only cache assets under root and static file types
  const isAsset = /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff2?|ttf|eot)$/.test(url.pathname) || url.pathname === '/';
  if (!isAsset) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/')); // Fallback to app shell when offline
    })
  );
});


