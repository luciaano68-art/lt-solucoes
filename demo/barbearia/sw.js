const CACHE='lt-demo-barbearia-v6',scope=self.registration.scope;
const files=['./','./index.html','./agendar.html','./demo-data.js','./manifest.json','./logo-demo.svg','./icon-192.svg','./icon-512.svg'].map(p=>new URL(p,scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(files)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lt-demo-barbearia-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==new URL(scope).origin||!u.href.startsWith(scope)||!files.includes(u.origin+u.pathname))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const cloned=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,cloned)))}return response}).catch(()=>caches.match(event.request,{ignoreSearch:true})))});

