(function(root){
'use strict';
const endpoint='https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-eventos-sync',key='sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y',C=root.FichasCore,S=root.FichasStore;
root.createFichasSync=function({getState,setState,onStatus=()=>{},onChange=()=>{},canRun=()=>true}){
 let busy=false,nextTry=0,delay=12000,stopped=false,forceAgain=false;
 async function request(body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'}),data=await r.json();if(!r.ok)throw Error(data.message||'Sem conexão com a nuvem.');return data;}finally{clearTimeout(timer);}}
 async function apply(remote,ack,spaceId){for(let attempt=0;attempt<3;attempt++){const local=await S.load();if(local.cloud.spaceId!==spaceId)throw Error('Conexão alterada.');try{const r=await S.update(local.revision,s=>C.mergeRemote(s,remote,ack),true);setState(r.state);onChange();return;}catch(e){if(!e.conflict)throw e;}}throw Error('Os dados estão sendo salvos. Tentarei novamente.');}
 async function run(force=false){
  if(busy){if(force)forceAgain=true;return;}
  if(stopped||!canRun()||!getState()?.cloud||(!force&&Date.now()<nextTry))return;
  if(navigator.onLine===false){onStatus('offline');return;}busy=true;onStatus('syncing');
  try{
   const start=getState(),auth={spaceId:start.cloud.spaceId,secret:start.cloud.secret};
   const listing=await request({...auth,action:'list'}),remoteMap=new Map((listing.events||[]).map(e=>[e.id,e]));
   const ids=[...new Set([start.activeEventId,...(start.outbox||[]).map(o=>o.eventId),...(listing.events||[]).map(e=>e.id)])].filter(Boolean);
   for(const id of ids){
    if(stopped||!canRun())break;
    for(let batch=0;batch<50;batch++){
     const current=getState();if(current.cloud.spaceId!==auth.spaceId)throw Error('Conexão alterada.');
     const ops=(current.outbox||[]).filter(o=>o.eventId===id).slice(0,20),known=current.eventRevisions?.[id]||0,remote=remoteMap.get(id);
     if(!ops.length&&remote&&known===remote.revision)break;if(!ops.length&&!remote)break;
     const response=await request({...auth,action:'sync',eventId:id,revision:known,operations:ops});
     if(response.notModified)break;await apply(response,response.ack||[],auth.spaceId);remoteMap.set(id,{revision:response.revision});
     if(!(getState().outbox||[]).some(o=>o.eventId===id))break;
     await new Promise(r=>setTimeout(r,0));
    }
   }
   delay=12000;nextTry=Date.now()+delay;onStatus((getState().outbox||[]).length?'pending':'synced');
  }catch(e){nextTry=Date.now()+delay;delay=Math.min(delay*2,120000);onStatus('offline',e.message);}finally{busy=false;if(forceAgain&&!stopped){forceAgain=false;setTimeout(()=>void run(true),0);}}
 }
 const online=()=>{nextTry=0;void run(true);},visible=()=>{if(!document.hidden)void run();};window.addEventListener('online',online);document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>{if(!document.hidden)void run();},15000);
 return {run,stop(){stopped=true;clearInterval(timer);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visible);},get busy(){return busy;}};
};
})(window);
