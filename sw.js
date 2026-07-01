const CACHE_NAME = 'chemins-du-soleil-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/fonts/nunito-latin.woff2',
  '/fonts/nunito-latin-ext.woff2',
  '/fonts/nunito-cyrillic.woff2',
  '/fonts/nunito-cyrillic-ext.woff2',
  '/fonts/nunito-vietnamese.woff2',
  '/images/logo.png',
  '/images/icon.png',
  '/images/icon-192.png',
  '/images/icon-maskable.png',
  '/src/app.js',
  '/src/graph.js',
  '/src/pathfinder.js',
  '/src/components/difficulty-selector.js',
  '/src/components/preference-selector.js',
  '/src/components/route-result.js',
  '/src/components/station-input.js',
  '/data/network.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
    })
  );
});
