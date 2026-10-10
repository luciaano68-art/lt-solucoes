import webpush from 'npm:web-push@3.6.7';
export function validSubscription(s:any){try{const u=new URL(s?.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))&&s.endpoint.length<2048&&/^[A-Za-z0-9_-]{86,88}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22,24}$/.test(s.keys?.auth||'')}catch{return false}}
export function createAdminPush(transport=webpush,request=fetch){
 const root=Deno.env.get('SUPABASE_URL')+'/rest/v1/',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const url='https://lt-solucoes.vercel.app/clientes/financeiro-teste/admin/';
 async function db(table:string,query='',method='GET',body?:unknown,prefer='return=representation'){
  const r=await request(root+table+query,{method,headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw Error('Não foi possível configurar os avisos do painel.');return r.json();
 }
 async function config(){let rows=await db('lt_pf_teste_admin_push_config_internal','?id=eq.1');if(!rows.length){const keys=transport.generateVAPIDKeys();await db('lt_pf_teste_admin_push_config_internal','?on_conflict=id','POST',{id:1,vapid_public:keys.publicKey,vapid_private:keys.privateKey},'resolution=ignore-duplicates,return=representation');rows=await db('lt_pf_teste_admin_push_config_internal','?id=eq.1')}return rows[0];}
 async function send(payload:any,endpoint?:string){
  const cfg=await config();transport.setVapidDetails(url,cfg.vapid_public,cfg.vapid_private);
  const rows=await db('lt_pf_teste_admin_push_subscriptions_internal',endpoint?'?endpoint=eq.'+encodeURIComponent(endpoint):'');let sent=0;
  await Promise.all(rows.map(async(row:any)=>{try{await transport.sendNotification(row.subscription,JSON.stringify({...payload,url}),{TTL:86400,urgency:'high',timeout:10000});sent++;}catch(e){if(e.statusCode===404||e.statusCode===410)await db('lt_pf_teste_admin_push_subscriptions_internal','?endpoint=eq.'+encodeURIComponent(row.endpoint),'DELETE');}}));return {sent,attempted:rows.length};
 }
 async function action(p:any){
  if(p.action==='pushPublicKey')return {publicKey:(await config()).vapid_public};
  if(!validSubscription(p.subscription))throw Object.assign(Error('Ative as notificações neste aparelho primeiro.'),{status:400});
  const s={endpoint:p.subscription.endpoint,keys:{p256dh:p.subscription.keys.p256dh,auth:p.subscription.keys.auth}};
  if(p.action==='pushSubscribe'){await db('lt_pf_teste_admin_push_subscriptions_internal','?on_conflict=endpoint','POST',{endpoint:s.endpoint,subscription:s,updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=representation');return {ok:true};}
  if(p.action==='pushUnsubscribe'){await db('lt_pf_teste_admin_push_subscriptions_internal','?endpoint=eq.'+encodeURIComponent(s.endpoint),'DELETE');return {ok:true};}
  const result=await send({title:'Avisos do Meu Financeiro',body:'Este celular está pronto para receber pedidos de autorização.',tag:'financeiro-admin-test'},s.endpoint);return {ok:result.sent>0,...result};
 }
 async function notify(event:string,kind:string){
  const claimed=await db('lt_pf_teste_admin_push_events_internal','?on_conflict=event_key','POST',{event_key:event,status:'pending'},'resolution=ignore-duplicates,return=representation');if(!claimed.length)return;
  const result=await send({title:kind==='cadastro'?'Cliente aguardando autorização':'Pedido de recuperação de senha',body:kind==='cadastro'?'Um cliente criou seu acesso. Abra o painel para conferir e autorizar.':'Abra o painel e confirme a identidade do cliente antes de autorizar o reset.',tag:'financeiro-'+event});
  await db('lt_pf_teste_admin_push_events_internal','?event_key=eq.'+encodeURIComponent(event),'PATCH',{status:result.sent?'sent':result.attempted?'failed':'no_subscribers',sent:result.sent});
 }
 return {action,notify};
}
const push=createAdminPush();
export const adminPushAction=push.action;
export function notifyAdmin(event:string,kind:string){const work=push.notify(event,kind).catch(()=>console.error('Falha no aviso do painel financeiro.'));if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil(work);return work;}
