const VERSION='marcio-push-v5';
self.addEventListener('install',event=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let d={};try{d=event.data?event.data.json():{}}catch(e){}
 const title=d.title||'🔔 Novo pedido — Marcio Bebidas';
 const options={
  body:d.body||'Você recebeu um novo pedido. Toque para abrir.',
  tag:'marcio-pedido-'+(d.orderId||Date.now()),
  renotify:true,
  requireInteraction:true,
  silent:false,
  vibrate:[400,150,400,150,600],
  timestamp:Date.now(),
  data:{url:d.url||'./distribui.html',orderId:d.orderId||null},
  actions:[{action:'open',title:'Ver pedido'}]
 };
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=event.notification.data?.url||'./distribui.html';
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}
  return clients.openWindow(url);
 }));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SHOW_TEST_NOTIFICATION'){
  event.waitUntil(self.registration.showNotification('🔔 Teste — Marcio Bebidas',{body:'Notificação visual do Marcio Bebidas funcionando.',tag:'marcio-visual-test',renotify:true,requireInteraction:true,silent:false,vibrate:[400,150,400],data:{url:'./distribui.html'}}));
 }
});