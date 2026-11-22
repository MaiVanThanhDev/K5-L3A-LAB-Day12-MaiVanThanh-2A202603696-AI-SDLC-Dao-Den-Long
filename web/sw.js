// Service worker (installable app / offline play). Served at /sw.js so its scope is the whole game.
// Network first (the server sends no-store and the game changes often), cache as the offline fallback.
// API calls (/api/*) are never cached: offline, the game already falls back to browser storage.
const CACHE = 'ddl-v1';
const CORE = [
  '/', '/web/main.js', '/web/audio.js', '/web/scenery.js', '/web/may.js', '/web/shop.js',
  '/src/sim/game.js', '/src/sim/maps.js', '/src/sim/rng.js', '/src/sim/bench.js', '/src/leaderboard-rules.js', '/src/shop-rules.js',
  '/node_modules/three/build/three.module.js', '/game.contract.json', '/manifest.webmanifest',
  '/web/icons/icon-192.png', '/web/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && !url.search) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('/'))),
  );
});
