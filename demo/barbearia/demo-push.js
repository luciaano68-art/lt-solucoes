/* Avisos reais somente para o painel da demonstração instalada. */
(function(root){
'use strict';
let busy=false,keyReady=null;
const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=()=>root.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function message(text,error){const n=document.getElementById('demoPushStatus');if(n){n.textContent=text;n.style.color=error?'#ffc1b4':'#c5e8cf'}}
function decode(s){const data=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(data,c=>c.charCodeAt(0))}
function active(on){const b=document.getElementById('barberPush'),t=document.getElementById('demoPushTest');if(b){b.textContent=on?'🔔 Notificações ativadas':'🔔 Ativar notificações';b.classList.toggle('on',on)}if(t)t.hidden=!on}
function publicKey(){if(!keyReady)keyReady=BarberDemo.pushAction({action:'pushPublicKey'}).then(r=>r.publicKey).catch(e=>{keyReady=null;throw e});return keyReady}
async function subscribe(sub){await BarberDemo.pushAction({action:'pushSubscribe',subscription:sub.toJSON()});active(true);message('Avisos de novos agendamentos ativados neste aparelho.',false)}
async function enable(){
 if(busy)return;
 if(ios()&&!standalone()){message('No iPhone, abra pelo ícone instalado na tela inicial para ativar os avisos.',true);root.alert('Abra a demonstração pelo ícone na tela inicial. Se ainda não instalou: Safari → Compartilhar → Adicionar à Tela de Início.');return}
 if(!('Notification'in root)||!('serviceWorker'in navigator)||!('PushManager'in root)){message('Este aparelho precisa de um navegador com notificações. No iPhone: iOS 16.4 ou mais recente e app instalado.',true);return}
 if(Notification.permission==='denied'){message('Avisos bloqueados. Libere as notificações deste app nos Ajustes do iPhone ou nas configurações do navegador.',true);root.alert('As notificações estão bloqueadas. No iPhone, abra Ajustes → Notificações → Barbearia Demonstração e permita os avisos. Depois volte ao app.');return}
 busy=true;
 // A solicitação ocorre diretamente no toque, antes de consultas à internet.
 const permission=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
 try{
  if(await permission!=='granted'){message('Permissão não concedida. A agenda continua funcionando.',true);return}
  const key=decode(await publicKey()),reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(sub&&sub.options.applicationServerKey){const previous=new Uint8Array(sub.options.applicationServerKey);if(previous.length!==key.length||previous.some((v,i)=>v!==key[i])){await sub.unsubscribe();sub=null}}
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await subscribe(sub);
 }catch(e){active(false);message(e.message||'Não foi possível ativar os avisos. Confira a conexão e tente novamente.',true)}finally{busy=false}
}
async function test(){if(busy)return;busy=true;try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(!sub){message('Ative as notificações neste aparelho primeiro.',true);return}const result=await BarberDemo.pushAction({action:'pushTest',subscription:sub.toJSON()});message(result.sent?'Aviso de teste enviado. Confira a notificação do aparelho.':'O aviso não foi entregue. Ative novamente as notificações.',!result.sent)}catch(e){message(e.message,true)}finally{busy=false}}
async function init(){publicKey().catch(e=>message(e.message,true));if(!('Notification'in root)||Notification.permission!=='granted'||!('serviceWorker'in navigator))return;try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub)await subscribe(sub)}catch(e){message(e.message,true)}}
root.BarberDemoPush=Object.freeze({enable,test});
root.addEventListener('load',init);
})(window);
