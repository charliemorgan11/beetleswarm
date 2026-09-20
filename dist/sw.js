// Recovery worker: retire the experimental offline cache and use the network.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      for (const name of await caches.keys()) {
        if (name.startsWith('beetle-swarm-offline-')) await caches.delete(name);
      }
    } catch {}
    await self.clients.claim();
  })());
});
// No fetch handler: cached game resources can no longer intercept requests.
self.addEventListener('message', event => {
  if (event.data?.type === 'PREPARE_OFFLINE') event.ports[0]?.postMessage({ ready: false });
});
