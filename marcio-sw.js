const CACHE = 'marcio-app-v1';
const APP = new URL('./distribui.html', self.location).href;
const ASSETS = ['./distribui.html', './marcio.webmanifest', './marcio-icon-192.png', './marcio-icon-512.png'].map(p => new URL(p, self.location).href);
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('marcio-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  // Only Marcio assets: other systems and server data keep their existing behavior.
  const key = u.origin + u.pathname;
  if (!ASSETS.includes(key)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); }
    return r;
  }).catch(() => caches.match(key).then(r => r || Response.error())));
});
