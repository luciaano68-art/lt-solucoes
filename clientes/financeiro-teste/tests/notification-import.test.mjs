import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createImportService} from '../../../supabase/functions/lt-meu-financeiro-teste-import/service.js';
import {parseNotification} from '../../../supabase/functions/lt-meu-financeiro-teste-import/parse.js';
import {createNotificationImportUI} from '../notification-import-ui.js';
const now='2026-10-22T21:00:00.000Z',sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const a=crypto.randomUUID(),b=crypto.randomUUID(),spouse=crypto.randomUUID(),space=crypto.randomUUID(),foreign=crypto.randomUUID(),card=crypto.randomUUID();
 const tables={lt_pf_users_internal:[{id:a,space_id:space,display_name:'A',active:true,is_owner:true},{id:b,space_id:foreign,display_name:'B',active:true,is_owner:true},{id:spouse,space_id:space,display_name:'Spouse',active:true,is_owner:false,permissions:{view:true,entries:true}}],lt_pf_tokens_internal:[{token_hash:sha('A'.repeat(43)),user_id:a,expires_at:'2027-01-01'},{token_hash:sha('B'.repeat(43)),user_id:b,expires_at:'2027-01-01'},{token_hash:sha('S'.repeat(43)),user_id:spouse,expires_at:'2027-01-01'}],lt_pf_spaces_internal:[{id:space,data:{accounts:[],entries:[],cards:[{id:card,name:'Sicredi'}]}},{id:foreign,data:{accounts:[],entries:[],cards:[]}}],lt_pf_notification_connections:[],lt_pf_notification_inbox:[]};
 const calls=[];
 async function db(table,q,method='GET',body,prefer){
  calls.push({table,q,method,body});const params=new URLSearchParams(q.replace(/^\?/,''));let rows=tables[table].filter(row=>[...params].every(([k,v])=>{if(['select','order','limit','on_conflict'].includes(k))return true;const dot=v.indexOf('.'),op=v.slice(0,dot),val=v.slice(dot+1);if(op==='eq')return String(row[k])===val;if(op==='gt')return row[k]>val;if(op==='is'&&val==='null')return row[k]==null;throw Error('Unsupported '+v);}));
  if(method==='POST'){if(table==='lt_pf_notification_inbox'&&tables[table].some(r=>r.user_id===body.user_id&&r.fingerprint===body.fingerprint)&&prefer?.includes('ignore-duplicates'))return [];const row={id:crypto.randomUUID(),active:true,created_at:now,status:'pending',...structuredClone(body)};tables[table].push(row);return [structuredClone(row)];}
  if(method==='PATCH'){rows.forEach(r=>Object.assign(r,structuredClone(body)));return structuredClone(rows);}
  if(params.get('order'))rows=rows.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));if(params.has('limit'))rows=rows.slice(0,Number(params.get('limit')));
  if(params.has('select'))return rows.map(r=>Object.fromEntries(params.get('select').split(',').map(k=>[k,r[k]])));return structuredClone(rows);
 }
 let seq=0;const handle=createImportService({db,hash:async s=>sha(s),randomToken:()=>String(++seq).padStart(43,'K'),allowedSpaces:new Set([space,foreign]),now:()=>now});
 return {handle,tables,a,b,spouse,space,foreign,card,calls,tokenA:'A'.repeat(43),tokenB:'B'.repeat(43),tokenS:'S'.repeat(43)};
}
const pair=async f=>f.handle({action:'pair',name:'Sicredi · iPhone',cardId:f.card},f.tokenA);
const notice={action:'capture',title:'Auto Posto Nossa Senhora Lourdes, Erval Velho',body:'R$ 27,96',receivedAt:'2026-10-20T20:23:00.000Z'};
test('screenshot notification and Wallet structured values preserve merchant, BRL cents and original day',()=>{
 const p=parseNotification(notice,now);assert.equal(p.proposal.cents,2796);assert.equal(p.proposal.date,'2026-10-20');assert.equal(p.proposal.category,'Combustível');
 const b=parseNotification({merchant:'jim.com 45019351 Gizeli P. Erval Velho, SC',amount:35,receivedAt:'2026-10-20T19:30:00Z'},now);assert.equal(b.proposal.cents,3500);assert.match(b.proposal.description,/Gizeli/);
});
test('refuses sensitive, declined, balance, transfer, ambiguous amounts and unsupported currency notices',()=>{
 for(const p of [{body:'Código de segurança 123456 R$ 1,00'},{body:'Saldo R$ 50,00'},{body:'Compra negada R$ 50,00'},{body:'Pix de R$ 50,00'},{body:'R$ 1,00 e R$ 2,00'},{amount:10,currency:'USD',merchant:'X'},{body:'Sem valor'},{...notice,receivedAt:'not a date'},{...notice,date:'2026-02-30'}])assert.throws(()=>parseNotification(p,now));
});
test('pairing stores only hash; capture credential cannot consult, pair or confirm',async()=>{
 const f=fixture(),p=await pair(f);assert.notEqual(f.tables.lt_pf_notification_connections[0].token_hash,p.key);
 for(const action of ['status','pair','complete'])await assert.rejects(()=>f.handle({action},p.key),e=>e.status===401);
 const view=await f.handle({action:'status'},f.tokenA);assert.equal(JSON.stringify(view).includes(p.key),false);assert.equal(JSON.stringify(view).includes('token_hash'),false);
});
test('capture only creates a private suggestion, never a ledger mutation',async()=>{
 const f=fixture(),p=await pair(f),before=JSON.stringify(f.tables.lt_pf_spaces_internal);
 assert.deepEqual(await f.handle(notice,p.key),{ok:true,duplicate:false});const status=await f.handle({action:'status'},f.tokenA);
 assert.equal(status.pending.length,1);assert.equal(status.pending[0].proposal.cardId,f.card);assert.equal(status.pending[0].proposal.cents,2796);assert.equal(JSON.stringify(f.tables.lt_pf_spaces_internal),before);
});
test('all Teste clients may pair, but another client and spouse see none of the private inbox',async()=>{
 const f=fixture(),p=await pair(f);await f.handle({...notice,userId:f.b,spaceId:f.foreign},p.key);
 for(const token of [f.tokenB,f.tokenS]){const s=await f.handle({action:'status'},token);assert.equal(s.pending.length,0);assert.equal(s.connections.length,0);}
 await f.handle({action:'pair',name:'Outro cliente'},f.tokenB);assert.equal(f.tables.lt_pf_notification_connections.length,2);
});
test('same event retry is idempotent while separate same-price purchases remain reviewable with a warning',async()=>{
 const f=fixture(),p=await pair(f);await f.handle(notice,p.key);assert.equal((await f.handle(notice,p.key)).duplicate,true);assert.equal(f.tables.lt_pf_notification_inbox.length,1);
 await f.handle({...notice,receivedAt:'2026-10-20T20:24:00Z'},p.key);const s=await f.handle({action:'status'},f.tokenA);assert.equal(s.pending.length,2);assert.ok(s.pending.every(x=>x.possibleDuplicate));
});
test('revoked, expired, paused and permission-revoked connections reject captures',async()=>{
 for(const change of ['revoked','expired','paused','permission']){const f=fixture(),p=await pair(f),connection=f.tables.lt_pf_notification_connections[0];if(change==='revoked')await f.handle({action:'revoke',id:p.id},f.tokenA);if(change==='expired')connection.expires_at='2020-01-01';if(change==='paused')f.tables.lt_pf_users_internal[0].active=false;if(change==='permission'){f.tables.lt_pf_users_internal[0].is_owner=false;f.tables.lt_pf_users_internal[0].permissions={view:true,entries:false};}await assert.rejects(()=>f.handle(notice,p.key));assert.equal(f.tables.lt_pf_notification_inbox.length,0);}
});
test('foreign cards and foreign suggestion identifiers are rejected; complete cannot create an expense',async()=>{
 const f=fixture();await assert.rejects(()=>f.handle({action:'pair',name:'Foreign',cardId:crypto.randomUUID()},f.tokenA));const p=await pair(f);await f.handle(notice,p.key);const id=f.tables.lt_pf_notification_inbox[0].id;
 await assert.rejects(()=>f.handle({action:'discard',id},f.tokenB),e=>e.status===404);await assert.rejects(()=>f.handle({action:'complete',id},f.tokenA),e=>e.status===409);assert.equal(f.tables.lt_pf_spaces_internal[0].data.entries.length,0);
});
test('successful expense is hidden from inbox after a lost marker response, without creating another entry',async()=>{
 const f=fixture(),p=await pair(f);await f.handle(notice,p.key);const row=f.tables.lt_pf_notification_inbox[0];f.tables.lt_pf_spaces_internal[0].data.entries.push({id:row.id,kind:'expense',cents:2796,date:'2026-10-20',cardId:f.card});
 const s=await f.handle({action:'status'},f.tokenA);assert.equal(s.pending.length,0);assert.equal(row.status,'confirmed');assert.equal(f.tables.lt_pf_spaces_internal[0].data.entries.length,1);
});
test('duplicate hint cannot disclose spouse private spending',async()=>{
 const f=fixture(),p=await pair(f),account=crypto.randomUUID();f.tables.lt_pf_spaces_internal[0].data.accounts.push({id:account,ownerUserId:f.spouse});f.tables.lt_pf_spaces_internal[0].data.entries.push({id:crypto.randomUUID(),kind:'expense',cents:2796,date:'2026-10-20',accountId:account,description:'Privada'});
 await f.handle(notice,p.key);assert.equal((await f.handle({action:'status'},f.tokenA)).pending[0].possibleDuplicate,false);
});
test('capture daily cap and pair cap prevent unbounded inbox/credential growth',async()=>{
 const f=fixture(),p=await pair(f);for(let i=0;i<100;i++)f.tables.lt_pf_notification_inbox.push({id:crypto.randomUUID(),connection_id:p.id,user_id:f.a,fingerprint:'old'+i,created_at:now,proposal:{}});
 await assert.rejects(()=>f.handle(notice,p.key),e=>e.status===429);
 for(let i=0;i<9;i++)await pair(f);await assert.rejects(()=>pair(f));
});
test('frontend clears previous user suggestions and ignores stale results after account switch',async()=>{
 let user={id:'a'},resolve;const ui=createNotificationImportUI({token:()=>'',getUser:()=>user,getState:()=>({}),can:()=>true,render:()=>{},toast:()=>{},openReview:()=>{},escape:s=>s,money:s=>s,document:{},fetcher:()=>new Promise(r=>resolve=r)});
 const promise=ui.load();user={id:'b'};assert.equal(ui.count,0);resolve({ok:true,json:async()=>({connections:[],pending:[{id:'old'}]})});await promise;assert.equal(ui.count,0);
});
test('frontend leaves card selection manual when unmatched and escapes notification content',async()=>{
 const row={id:crypto.randomUUID(),proposal:{description:'<img src=x>',cents:3500,source:'Sicredi',date:'2026-10-20'},possibleDuplicate:true};
 const ui=createNotificationImportUI({token:()=>'',getUser:()=>({id:'a'}),getState:()=>({cards:[]}),can:()=>true,render:()=>{},toast:()=>{},openReview:()=>{},escape:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),money:s=>String(s),document:{},fetcher:async()=>({ok:true,json:async()=>({connections:[],pending:[row]})})});
 await ui.load();assert.equal(ui.count,1);assert.match(ui.view(),/Escolha o cartão ao revisar/);assert.match(ui.view(),/Possível duplicata/);assert.doesNotMatch(ui.view(),/<img/);
});
