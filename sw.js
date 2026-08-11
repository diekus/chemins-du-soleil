const CACHE_NAME = 'chemins-du-soleil-v15';

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
  '/src/blob-bg.js',
  '/src/graph.js',
  '/src/pathfinder.js',
  '/src/weather.js',
  '/src/conditions.js',
  '/src/geo.js',
  '/src/format.js',
  '/src/countries.js',
  '/src/icons.js',
  '/src/animate-height.js',
  '/src/components/difficulty-selector.js',
  '/src/components/preference-selector.js',
  '/src/components/route-result.js',
  '/src/components/station-input.js',
  '/src/components/tab-bar.js',
  '/src/components/location-gate.js',
  '/src/components/weather-hero.js',
  '/src/components/avalanche-banner.js',
  '/src/components/resort-conditions-list.js',
  '/data/network.json',
  '/data/resorts.json',
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

// Live-conditions data origins: always hit the network. Caching these here would
// let a stale response be served transparently and stamped as "current" by the
// app — the app's own localStorage cache already handles the offline case
// honestly (with a real "last updated" time), so the SW must stay out of the way.
const NETWORK_ONLY_ORIGINS = [
  'https://api.open-meteo.com',
  'https://open-piste.raed.workers.dev',
];

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (NETWORK_ONLY_ORIGINS.some(origin => event.request.url.startsWith(origin))) {
    event.respondWith(fetch(event.request));
    return;
  }

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
