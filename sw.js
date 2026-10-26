// Offline support. Network first (so updates always arrive when online),
// falling back to the cached copy when there's no connection.
const CACHE = 'mechwars-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'src/styles.css',
  'src/ui/app.js', 'src/ui/art.js', 'src/ui/store.js', 'src/ui/tower.js', 'src/ai-worker.js',
  'src/engine/data.js', 'src/engine/game.js', 'src/engine/ai.js', 'src/engine/rng.js',
  'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png',
  'fonts/lilita-one.woff2', 'fonts/rubik-500.woff2', 'fonts/rubik-600.woff2', 'fonts/rubik-700.woff2', 'fonts/rubik-800.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
