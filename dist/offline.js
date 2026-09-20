(() => {
  const status = document.getElementById('offline-status');
  if (!status) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = 'For offline play, open in Safari and add to your Home Screen.';
    return;
  }
  let busy = false;
  async function prepare() {
    if (busy) return;
    busy = true;
    status.textContent = 'Downloading for offline play…';
    let timer, replyPort;
    try {
      const ready = await Promise.race([
        (async () => {
          const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
          await navigator.serviceWorker.ready;
          const worker = navigator.serviceWorker.controller || registration.active;
          if (!worker) throw new Error('Offline worker not active');
          return new Promise(resolve => {
            const channel = new MessageChannel();
            replyPort = channel.port1;
            channel.port1.onmessage = event => {
              channel.port1.close();
              resolve(event.data?.ready === true);
            };
            worker.postMessage({ type: 'PREPARE_OFFLINE' }, [channel.port2]);
          });
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Download timed out')), 60000); })
      ]);
      status.textContent = ready ? 'Ready to play offline' : 'Not saved offline yet. Reconnect and reopen the game.';
    } catch {
      status.textContent = 'Not saved offline yet. Open in Safari with a connection and try again.';
    } finally {
      clearTimeout(timer); replyPort?.close(); busy = false;
    }
  }
  window.addEventListener('online', prepare);
  navigator.serviceWorker.addEventListener('controllerchange', prepare);
  prepare();
})();
