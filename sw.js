// Hearthcrawler service worker. Bump VERSION on every release.
const VERSION = '2.0.1';
const CACHE = 'hearthcrawler-v' + VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/hud.css',
  'src/main.js', 'src/data.js', 'src/core.js', 'src/terrain.js', 'src/geo.js', 'src/models.js', 'src/sky.js', 'src/world.js', 'src/caravan.js',
  'src/player.js', 'src/input.js', 'src/viewmodel.js', 'src/fx.js', 'src/enemies.js', 'src/audio.js', 'src/icons.js', 'src/ui.js', 'src/save.js',
  'vendor/three.module.min.js', 'vendor/three.core.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('hearthcrawler-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate' || req.destination === 'document') { // network first, offline fallback
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  // stale-while-revalidate for js / css / vendor / icons
  e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
