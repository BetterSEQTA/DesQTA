const CACHE_NAME = 'desqta-static-v2'; // Increment version when significant changes occur
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

// Network-first strategy for SvelteKit files and app routes to prevent stale routing
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SvelteKit generated files - always fetch fresh to prevent routing issues
  const isSvelteKitFile = url.pathname.includes('/.svelte-kit/') || 
                         url.pathname.includes('/src/') ||
                         url.pathname.includes('/app.css') ||
                         url.pathname.startsWith('/@fs/');
  
  // App routes (non-static assets) - use network-first for fresh navigation
  const isAppRoute = !url.pathname.startsWith('/static/') && 
                    !url.pathname.startsWith('/themes/') &&
                    !/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/.test(url.pathname);

  if (isSvelteKitFile || isAppRoute) {
    // Network-first strategy for SvelteKit files and routes
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful responses
          if (res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req)) // Fallback to cache when offline
    );
    return;
  }

  // Only cache static assets (images, fonts, etc.)
  const isStaticAsset = /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/.test(url.pathname);
  if (!isStaticAsset) return;

  // Cache-first for static assets only
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


