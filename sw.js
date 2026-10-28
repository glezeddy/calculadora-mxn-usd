// Cambiar VERSION en cada entrega que cambie cualquier archivo de SHELL.
const VERSION = '1.4.0-dev.1';
const PREFIX = `cuenta-clara:${self.registration.scope}:`;
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = ['./', './index.html', './styles.css', './app.js', './money.js', './rates.js', './rate-store.js', './pwa.js', './keypad.js', './summary.js', './icons.js', './ui.js', './change-engine.js', './cash-ledger.js', './cash-ui.js', './change-worker.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const urls = SHELL.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls.map(url => new Request(url, { cache: 'reload' })))));
  // Se espera al cierre de las pestañas o a la aceptación explícita de la actualización.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // La API externa nunca se guarda ni se sustituye por una cotización cacheada.
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const canonical = `${url.origin}${url.pathname}`;
  if (!urls.includes(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(canonical)) || fetch(event.request);
  })());
});
