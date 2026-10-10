export function setupAdminApp(call,onRefresh){
 const $=id=>document.getElementById(id);let installEvent=null,authorized=false;
 const standalone=()=>navigator.standalone||matchMedia('(display-mode: standalone)').matches;
 const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;});
 window.addEventListener('appinstalled',()=>{$('adminInstall').hidden=true;installEvent=null;});
 function help(){let d=$('adminInstallHelp');if(!d){d=document.createElement('dialog');d.id='adminInstallHelp';const h=document.createElement('h2');h.textContent='Instalar painel';const p=document.createElement('p');p.textContent=ios()?'No Safari, toque em Compartilhar → Adicionar à Tela de Início. Depois abra o ícone Autorizar clientes e ative as notificações.':'No Chrome do Android, toque no menu ⋮ → Adicionar à tela inicial → Instalar. Depois abra o ícone Autorizar clientes.';const b=document.createElement('button');b.type='button';b.textContent='Entendi';b.onclick=()=>d.close();d.append(h,p,b);document.body.append(d)}d.showModal();}
 $('adminInstall').hidden=!!standalone();$('adminInstall').onclick=async()=>{if(!installEvent)return help();const event=installEvent;installEvent=null;try{await event.prompt();await event.userChoice;}catch{help()}};
 const ready='serviceWorker' in navigator?navigator.serviceWorker.register(new URL('./sw.js',document.baseURI),{scope:'./'}).then(async r=>{if(!r.active)await new Promise((resolve,reject)=>{const w=r.installing||r.waiting;if(!w)return reject(Error('Não foi possível preparar o painel.'));w.addEventListener('statechange',()=>{if(w.state==='activated')resolve();if(w.state==='redundant')reject(Error('Não foi possível instalar o painel.'));});});return r;}):Promise.reject(Error('Este navegador não permite instalar o painel.'));
 ready.catch(e=>$('notificationStatus').textContent=e.message);
 async function updateStatus(){if(!authorized)return;const r=await ready;const sub=await r.pushManager?.getSubscription();const active=typeof Notification!=='undefined'&&Notification.permission==='granted'&&!!sub;$('adminNotifications').textContent=active?'Notificações ativadas':'Ativar notificações';$('adminPushTest').hidden=!active;$('notificationStatus').textContent=active?'Avisos de novos cadastros e recuperação de senha ativados neste aparelho.':'Ative os avisos neste aparelho para receber novos pedidos.';return sub;}
 function bytes(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
 $('adminNotifications').onclick=async()=>{
  if(!authorized)return;$('adminNotifications').disabled=true;
  try{
   if(ios()&&!standalone()){help();throw Error('No iPhone, instale o painel e abra pelo ícone para ativar os avisos.');}
   if(typeof Notification==='undefined'||!('PushManager' in window))throw Error('Este navegador não oferece notificações. Abra no Chrome ou no app instalado.');
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Permita as notificações nas configurações deste aparelho.');
   const r=await ready;let sub=await r.pushManager.getSubscription();if(!sub){const {publicKey}=await call('pushPublicKey');sub=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(publicKey)});}
   await call('pushSubscribe',{subscription:sub.toJSON()});await updateStatus();
  }catch(e){$('notificationStatus').textContent=e.message;}finally{$('adminNotifications').disabled=false;}
 };
 $('adminPushTest').onclick=async()=>{try{const sub=await updateStatus();if(!sub)throw Error('Ative os avisos primeiro.');const r=await call('pushTest',{subscription:sub.toJSON()});$('notificationStatus').textContent=r.ok?'Aviso enviado. Confira a notificação neste aparelho.':'O aviso não foi entregue. Ative as notificações novamente.';}catch(e){$('notificationStatus').textContent=e.message;}};
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='refresh-registrations')onRefresh();});
 return {async authorize(){authorized=true;$('adminNotifications').disabled=false;try{const sub=await updateStatus();if(sub&&Notification.permission==='granted')await call('pushSubscribe',{subscription:sub.toJSON()});}catch(e){$('notificationStatus').textContent=e.message;}}};
}
