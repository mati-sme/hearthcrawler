/* Hearthcrawler service worker: cache-first, network fallback, versioned cache */
const VERSION = '1.2.1';
const CACHE = 'hearthcrawler-v' + VERSION;
const ASSETS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/data.js', 'js/state.js', 'js/audio.js', 'js/icons.js', 'js/world.js', 'js/caravan.js', 'js/entities.js',
  'js/quests.js', 'js/render.js', 'js/input.js', 'js/ui.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hearthcrawler-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
