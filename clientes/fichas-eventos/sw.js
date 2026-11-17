'use strict';
const CACHE='lt-fichas-eventos-v3',BASE=new URL('./',self.location.href).href;
const FILES=['./','./index.html','./style.css?v=3','./core.js?v=3','./store.js?v=3','./sync.js?v=3','./print.js?v=3','./app.js?v=3','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(p=>new URL(p,BASE).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lt-fichas-eventos-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||!url.href.startsWith(BASE))return;const known=FILES.some(f=>new URL(f,BASE).pathname===url.pathname);if(!known)return;e.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(e.request,{ignoreSearch:true});if(cached)return cached;const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response;})());});
