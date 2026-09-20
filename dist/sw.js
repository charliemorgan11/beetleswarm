// Bump this version whenever any cached game file changes.
const CACHE_NAME = 'beetle-swarm-offline-v1';
const ASSETS = [
  '/index.html', '/game.mjs', '/engine.mjs', '/style.css', '/offline.js',
  '/manifest.webmanifest', '/assets/beetle-swarm-icon.png',
  '/assets/chart.png', '/assets/beetle.png', '/assets/menu-scroll.png',
  '/assets/fonts/pirata-one.ttf', '/assets/fonts/im-fell-english.ttf',
  '/assets/fonts/im-fell-english-italic.ttf'
];

async function downloadGame() {
  const cache = await caches.open(CACHE_NAME);
  // addAll is atomic: a failed download must not leave a half-installed game.
  await cache.addAll(ASSETS.map(path => new Request(path, { cache: 'reload' })));
}

self.addEventListener('install', event => {
  event.waitUntil(downloadGame());
  // Updates wait for old game windows to close; never interrupt an active run.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('beetle-swarm-offline-') && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!ASSETS.includes(path)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(path)) || fetch(request);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'PREPARE_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const complete = (await Promise.all(ASSETS.map(path => cache.match(path)))).every(Boolean);
      // Recover missing browser cache while online, without claiming a partial download is ready.
      if (!complete) await downloadGame();
      event.ports[0].postMessage({ ready: true });
    } catch {
      event.ports[0].postMessage({ ready: false });
    }
  })());
});
