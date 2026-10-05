/* Sincronização exclusiva da estética; não acessa tabelas de salões. */
(function(root){
'use strict';
const local=root.StudioApp,nativeFetch=root.fetch.bind(root),credentialKey='lt_yasmin_studio_online_credentials_v1',pendingKey='lt_yasmin_studio_online_pending_v1';
const endpoint='https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-yasmin-studio';
const publishable='sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y';
const isCustomer=/\/agendar\.html$/.test(root.location.pathname);
let credentials=null,session=new root.URL(root.location.href).searchParams.get('studio'),pending=null,flushing=null,lastConfig='';
try{credentials=JSON.parse(root.localStorage.getItem(credentialKey)||'null');pending=JSON.parse(root.localStorage.getItem(pendingKey)||'null')}catch(e){}
if(!isCustomer&&credentials)session=credentials.session;

function status(message,error){let node=document.getElementById('demoOnlineStatus');if(node){node.textContent=message;node.style.color=error?'#a52828':'#32663d'}}
async function call(payload){let controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await nativeFetch(endpoint,{method:'POST',headers:{apikey:publishable,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});const data=await response.json();if(response.status===401&&!isCustomer){root.localStorage.removeItem(credentialKey);root.location.replace('./');}if(!response.ok)throw Object.assign(Error(data.message||'Não foi possível sincronizar o aplicativo.'),{status:response.status});return {data,status:response.status}}finally{clearTimeout(timeout)}}
function auth(){return {session,admin:!isCustomer&&credentials?credentials.admin:undefined}}
const ready=(async()=>{
 if(!isCustomer){if(!credentials)throw Error('Entre com seu login para abrir o painel.');const result=await call({...auth(),action:'state'});local.replaceState(result.data.state);const state=result.data.state;let panel;try{panel=JSON.parse(root.localStorage.getItem(local.panelKey)||'null')}catch(e){}if(!panel)panel={clients:[],appointments:[],products:[],productSales:[]};let ownedPending={};try{ownedPending=JSON.parse(root.localStorage.getItem(local.panelKey+'_owned_catalog_pending_v2')||'{}')}catch(e){}if(!pending&&!Object.keys(ownedPending).length){panel.business=state.catalog.business;panel.services=state.catalog.services;panel.barbers=state.catalog.barbers.map(b=>({...b,weekly:(state.hours.find(h=>h.barber_id==b.id)||{}).weekly}));panel.blocks=state.blocks||[];panel.holidays=state.holidays||[];root.localStorage.setItem(local.panelKey,JSON.stringify(panel))}}
 else if(!session)throw Error('Use o novo link enviado pelo painel da estética para conectar o agendamento à agenda.');
 if(!isCustomer){const state=local.getState();lastConfig=JSON.stringify({...state.catalog,blocks:state.blocks,holidays:state.holidays})}
 status('Agenda online: agendamentos sincronizados entre aparelhos.',false);
 return session;
})();
ready.catch(e=>status(e.message,true));
async function flush(){if(isCustomer||!pending)return;if(flushing)return flushing;flushing=(async()=>{await ready;while(pending){const config=pending;await call({...auth(),action:'config',config});if(pending===config){pending=null;root.localStorage.removeItem(pendingKey)}}status('Agenda online: agendamentos sincronizados entre aparelhos.',false)})();try{await flushing}finally{flushing=null}}
function updateCatalog(db){local.updateCatalog(db);if(isCustomer)return;const config={business:db.business,services:db.services,barbers:db.barbers,blocks:db.blocks||[],holidays:db.holidays||[]},signature=JSON.stringify(config);if(signature===lastConfig)return;lastConfig=signature;pending=JSON.parse(signature);root.localStorage.setItem(pendingKey,JSON.stringify(pending));flush().catch(e=>status('Cadastro aguardando sincronização. '+e.message,true))}
async function onlineFetch(input,options={}){
 try{await ready;await flush();const url=new root.URL(String(input),local.baseURL);if(url.origin!==local.baseURL)return new Response(JSON.stringify({message:'Destino inválido na estética.'}),{status:403});const result=await call({...auth(),path:url.pathname+url.search,method:options.method||'GET',body:options.body?JSON.parse(options.body):undefined});
 if(url.pathname==='/rest/v1/barbershop_public_hours'&&(options.method||'GET')==='GET'){const state=local.getState();for(const row of result.data){const old=state.hours.find(h=>h.barber_id==row.barber_id)||state.hours.find(h=>h.barber_id==+(url.searchParams.get('barber_id')||'').slice(3));if(old&&row.weekly)old.weekly=row.weekly;}local.replaceState(state)}
 status('Agenda online: agendamentos sincronizados entre aparelhos.',false);return new Response(JSON.stringify(result.data),{status:result.status,headers:{'Content-Type':'application/json'}})
 }catch(e){status(e.message,true);return new Response(JSON.stringify({message:e.message||'Demonstração sem conexão. Nenhum agendamento foi confirmado.'}),{status:e.status||503,headers:{'Content-Type':'application/json'}})}
}
async function reset(){if(!root.confirm('Limpar os dados de teste desta estética em todos os aparelhos conectados a ela?'))return;try{await ready;await call({...auth(),action:'reset'});for(const key of ['lt_yasmin_masson_data_v3',local.panelKey,local.panelKey+'_hours_online_v1',local.panelKey+'_catalog_pending_v1',local.panelKey+'_catalog_local_migrated_v1',local.panelKey+'_owned_catalog_pending_v2',pendingKey])root.localStorage.removeItem(key);root.location.reload()}catch(e){root.alert(e.message)}}
root.StudioApp=Object.freeze({...local,fetch:onlineFetch,updateCatalog,ready,reset,pushAction:async(payload)=>{await ready;if(isCustomer)throw Error('Avisos disponíveis somente no painel.');return (await call({...auth(),...payload})).data},bookingLink:()=>{if(!session)throw Error('Aguarde a conexão da estética.');const u=new root.URL('./agendar.html',root.location.href);u.searchParams.set('studio',session);return u.href}});
})(window);

