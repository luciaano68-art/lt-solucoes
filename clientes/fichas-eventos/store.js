(function(root){
'use strict';
const C=root.FichasCore;let dbPromise,cache;
function credentials(){return {spaceId:crypto.randomUUID(),secret:[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('')};}
function open(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(Error('Abra este app no Chrome fora do modo anônimo para salvar as vendas.'));const r=indexedDB.open('lt-fichas-eventos-v1',1);r.onupgradeneeded=()=>{for(const name of ['state','sales','outbox'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>{dbPromise=null;reject(Error('Não foi possível abrir os dados do caixa.'));};r.onblocked=()=>reject(Error('Feche as outras abas deste app.'));});return dbPromise;}
function metadata(s){const {sales,outbox,...meta}=s;return meta;}
async function readAll(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['state','sales','outbox'],'readwrite'),meta=tx.objectStore('state'),r=meta.get('main'),sales=tx.objectStore('sales').getAll(),ops=tx.objectStore('outbox').getAll();let state,error;
 r.onsuccess=()=>{try{state=r.result;if(!state){state=C.empty(crypto.randomUUID());state.cloud=credentials();meta.put(metadata(state),'main');}}catch(e){error=e;tx.abort();}};tx.oncomplete=()=>{state.sales=sales.result;state.outbox=(ops.result||[]).sort((a,b)=>(a.order||0)-(b.order||0));try{C.validate(state);cache=state;resolve(state);}catch(e){reject(e);}};tx.onabort=tx.onerror=()=>reject(error||Error('Não foi possível ler os dados deste aparelho.'));});}
async function load(){if(!cache)return readAll();const db=await open();const revision=await new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly'),r=tx.objectStore('state').get('main');tx.oncomplete=()=>resolve(r.result?.revision);tx.onerror=tx.onabort=()=>reject(Error('Não foi possível conferir os dados locais.'));});return cache?.revision===revision?cache:readAll();}
async function update(expected,reducer,localOnly=false){const db=await open();return new Promise((resolve,reject)=>{let tx;try{tx=db.transaction(['state','sales','outbox'],'readwrite',{durability:'strict'});}catch{tx=db.transaction(['state','sales','outbox'],'readwrite');}const meta=tx.objectStore('state'),r=meta.get('main');let answer,error;
 r.onsuccess=()=>{try{const stored=r.result;if(!stored||stored.revision!==expected||cache?.revision!==expected)throw Object.assign(Error('O caixa foi atualizado em outra aba. Confira e tente novamente.'),{conflict:true});const current=cache,reduced=reducer(current),next=reduced.state||reduced;
 const append=!!(reduced.result?.created&&reduced.result.sale&&next.sales.length===current.sales.length+1&&next.sales[next.sales.length-1]===reduced.result.sale);let appendedOps=[];
 if(!localOnly){const changes=append?[...C.changes({...current,sales:[]},{...next,sales:[]},()=>crypto.randomUUID()),{id:crypto.randomUUID(),entity:'sales',eventId:reduced.result.sale.eventId,record:C.clone(reduced.result.sale)}]:C.changes(current,next,()=>crypto.randomUUID());const base=Math.max(current.opClock||0,Date.now()*100);next.opClock=base+changes.length;appendedOps=changes.map((o,i)=>({...o,order:base+i+1}));next.outbox=[...(current.outbox||[]),...appendedOps];}
 const oldSales=append?null:new Map(current.sales.map(s=>[s.id,s])),changed=append?[reduced.result.sale]:next.sales.filter(s=>oldSales.get(s.id)!==s);C.validate({...next,sales:changed});
 const saleTable=tx.objectStore('sales');for(const sale of changed)saleTable.put(sale,sale.id);if(!append){const ids=new Set(next.sales.map(s=>s.id));for(const old of current.sales)if(!ids.has(old.id))saleTable.delete(old.id);}
 const opTable=tx.objectStore('outbox');
 if(!localOnly){for(const op of appendedOps)opTable.put(op,op.id);}
 else {const oldOps=new Map((current.outbox||[]).map(o=>[o.id,o])),newIds=new Set();for(const op of next.outbox||[]){newIds.add(op.id);if(oldOps.get(op.id)!==op)opTable.put(op,op.id);}for(const id of oldOps.keys())if(!newIds.has(id))opTable.delete(id);}

 next.revision=current.revision+1;meta.put(metadata(next),'main');answer={state:next,result:reduced.result};
 }catch(e){error=e;tx.abort();}};
 tx.oncomplete=()=>{cache=answer.state;resolve(answer);};tx.onerror=tx.onabort=()=>reject(error||Error('Não foi possível gravar. A venda NÃO foi confirmada. Confira o espaço do aparelho.'));});}
root.FichasStore=Object.freeze({load,update,credentials});
})(window);
