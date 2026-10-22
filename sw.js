const CACHE = 'modarribi-shell-v2';
const ROOT = new URL('./', self.registration.scope).pathname;
const SHELL = [ROOT, `${ROOT}manifest.webmanifest`, `${ROOT}icon.svg`, `${ROOT}assets/ichigo-reference.jpg`];
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
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(ROOT)));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
self.addEventListener('push', event => {
  let data = { title: 'مدرّبي', body: 'عندك خطوة جديدة مستنياك.' };
  try { data = { ...data, ...(event.data?.json() || {}) }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: `${ROOT}icon.svg`,
    badge: `${ROOT}icon.svg`,
    tag: data.tag || 'modarribi-reminder',
    data: { url: data.url || ROOT },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || ROOT, self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const open = windows.find(client => client.url.startsWith(self.location.origin + ROOT));
    return open ? open.focus() : clients.openWindow(destination);
  }));
});
