/* Sincronização exclusiva da demonstração; não acessa tabelas de salões. */
(function(root){
'use strict';
const local=root.BarberDemo,nativeFetch=root.fetch.bind(root),credentialKey='lt_demo_barber_online_credentials_v1',pendingKey='lt_demo_barber_online_pending_v1';
const endpoint='https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-demo-barber-sync';
const publishable='sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y';
const isCustomer=/\/agendar\.html$/.test(root.location.pathname);
let credentials=null,session=new root.URL(root.location.href).searchParams.get('demo'),pending=null,flushing=null,lastConfig='';
try{credentials=JSON.parse(root.localStorage.getItem(credentialKey)||'null');pending=JSON.parse(root.localStorage.getItem(pendingKey)||'null')}catch(e){}
if(!isCustomer&&credentials)session=credentials.session;
if(isCustomer&&!session&&credentials)session=credentials.session;
function status(message,error){let node=document.getElementById('demoOnlineStatus');if(node){node.textContent=message;node.style.color=error?'#a52828':'#32663d'}}
async function call(payload){let controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await nativeFetch(endpoint,{method:'POST',headers:{apikey:publishable,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.message||'Não foi possível sincronizar a demonstração.'),{status:response.status});return {data,status:response.status}}finally{clearTimeout(timeout)}}
function auth(){return {session,admin:!isCustomer&&credentials?credentials.admin:undefined}}
const ready=(async()=>{
 if(!isCustomer&&!credentials){
  try{const panel=JSON.parse(root.localStorage.getItem(local.panelKey)||'null');if(panel&&panel.barbers&&panel.services)local.updateCatalog(panel)}catch(e){}
  const result=await call({action:'create',seed:local.getState()});
  credentials={session:result.data.session,admin:result.data.admin};session=credentials.session;root.localStorage.setItem(credentialKey,JSON.stringify(credentials));local.replaceState(result.data.state);
 }else if(!isCustomer){const result=await call({...auth(),action:'state'});local.replaceState(result.data.state)}
 else if(!session)throw Error('Use o novo link enviado pelo painel da demonstração para conectar o agendamento à agenda.');
 if(!isCustomer){const state=local.getState();lastConfig=JSON.stringify({...state.catalog,blocks:state.blocks,holidays:state.holidays})}
 status('Agenda online: agendamentos sincronizados entre aparelhos.',false);
 return session;
})();
ready.catch(e=>status(e.message,true));
async function flush(){if(isCustomer||!pending)return;if(flushing)return flushing;flushing=(async()=>{await ready;while(pending){const config=pending;await call({...auth(),action:'config',config});if(pending===config){pending=null;root.localStorage.removeItem(pendingKey)}}status('Agenda online: agendamentos sincronizados entre aparelhos.',false)})();try{await flushing}finally{flushing=null}}
function updateCatalog(db){local.updateCatalog(db);if(isCustomer)return;const config={business:db.business,services:db.services,barbers:db.barbers,blocks:db.blocks||[],holidays:db.holidays||[]},signature=JSON.stringify(config);if(signature===lastConfig)return;lastConfig=signature;pending=JSON.parse(signature);root.localStorage.setItem(pendingKey,JSON.stringify(pending));flush().catch(e=>status('Cadastro aguardando sincronização. '+e.message,true))}
async function onlineFetch(input,options={}){
 try{await ready;await flush();const url=new root.URL(String(input),local.baseURL);if(url.origin!==local.baseURL)return new Response(JSON.stringify({message:'Destino inválido na demonstração.'}),{status:403});const result=await call({...auth(),path:url.pathname+url.search,method:options.method||'GET',body:options.body?JSON.parse(options.body):undefined});
 if(url.pathname==='/rest/v1/barbershop_public_hours'&&(options.method||'GET')==='GET'){const state=local.getState();for(const row of result.data){const old=state.hours.find(h=>h.barber_id==row.barber_id)||state.hours.find(h=>h.barber_id==+(url.searchParams.get('barber_id')||'').slice(3));if(old&&row.weekly)old.weekly=row.weekly;}local.replaceState(state)}
 status('Agenda online: agendamentos sincronizados entre aparelhos.',false);return new Response(JSON.stringify(result.data),{status:result.status,headers:{'Content-Type':'application/json'}})
 }catch(e){status(e.message,true);return new Response(JSON.stringify({message:e.message||'Demonstração sem conexão. Nenhum agendamento foi confirmado.'}),{status:e.status||503,headers:{'Content-Type':'application/json'}})}
}
async function reset(){if(!root.confirm('Limpar os dados de teste desta demonstração em todos os aparelhos conectados a ela?'))return;try{await ready;await call({...auth(),action:'reset'});for(const key of ['lt_demo_barbearia_data_v3',local.panelKey,local.panelKey+'_hours_online_v1',local.panelKey+'_catalog_pending_v1',local.panelKey+'_catalog_local_migrated_v1',local.panelKey+'_owned_catalog_pending_v2',pendingKey])root.localStorage.removeItem(key);root.location.reload()}catch(e){root.alert(e.message)}}
root.BarberDemo=Object.freeze({...local,fetch:onlineFetch,updateCatalog,ready,reset,pushAction:async(payload)=>{await ready;if(isCustomer)throw Error('Avisos disponíveis somente no painel.');return (await call({...auth(),...payload})).data},bookingLink:()=>{if(!session)throw Error('Aguarde a conexão da demonstração.');const u=new root.URL('./agendar.html',root.location.href);u.searchParams.set('demo',session);return u.href}});
})(window);
