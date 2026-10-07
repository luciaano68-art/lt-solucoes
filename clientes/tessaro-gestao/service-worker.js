const CACHE_PREFIX = 'lt-tessaro-gestao-dev-';
const CACHE_NAME = CACHE_PREFIX + 'v44';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const APP_SCOPE = new URL(self.registration.scope);
const INDEX_URL = new URL('./index.html', APP_SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map(path => new Request(new URL(path, APP_SCOPE), {cache: 'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Este worker cuida exclusivamente dos arquivos do protótipo.
  if (request.method !== 'GET' || url.origin !== APP_SCOPE.origin || !url.pathname.startsWith(APP_SCOPE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isNavigation = request.mode === 'navigate';
    try {
      const response = await fetch(request, {cache: 'no-store'});
      if (response.ok) await cache.put(isNavigation ? INDEX_URL : request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(isNavigation ? INDEX_URL : request);
      return cached || Response.error();
    }
  })());
});
