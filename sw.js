/* SuppVerse BD service worker — deliberately minimal.
   Network-only for everything (no asset caching, so deploys and debugging are never stale);
   the only thing it adds is a friendly offline page when a page navigation fails. */
const OFFLINE_URL = '/offline.html';
const CACHE = 'sv-offline-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE_URL)));
});
