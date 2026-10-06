const CACHE='lt-demo-barbearia-v8',scope=self.registration.scope;
const files=['./','./index.html','./agendar.html','./demo-data.js','./demo-online.js','./demo-push.js','./manifest.json','./logo-demo.svg','./icon-192.svg','./icon-512.svg'].map(p=>new URL(p,scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(files)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lt-demo-barbearia-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==new URL(scope).origin||!u.href.startsWith(scope)||!files.includes(u.origin+u.pathname))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const cloned=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,cloned)))}return response}).catch(()=>caches.match(event.request,{ignoreSearch:true})))});


self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{}}catch(e){}
 const title=data.title||'Novo agendamento — Demonstração';
 event.waitUntil(self.registration.showNotification(title,{body:data.body||'Você recebeu um novo agendamento na demonstração.',icon:new URL('./icon-192.svg',scope).href,tag:data.tag||'demo-booking',data:{url:scope}}).then(()=>{if(self.navigator.setAppBadge)return self.navigator.setAppBadge(1)}).catch(e=>console.error('Aviso da demonstração:',e)));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  for(const win of windows){const u=new URL(win.url);if(u.origin===new URL(scope).origin&&u.href.startsWith(scope)&&!u.pathname.endsWith('/agendar.html'))return win.focus()}
  return self.clients.openWindow(scope);
 }));
});
