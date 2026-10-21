const BASE_URL = new URL('.', self.registration.scope);
const BASE = BASE_URL.pathname;
const CACHE = 'modarribi-shell-v2';
const SHELL = [BASE, new URL('manifest.webmanifest', BASE_URL).pathname, new URL('icon.svg', BASE_URL).pathname];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith(BASE + 'api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(BASE)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});

