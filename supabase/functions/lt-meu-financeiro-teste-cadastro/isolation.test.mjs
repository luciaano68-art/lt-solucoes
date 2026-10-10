import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {slots} from './slots.js';
let apiHandler;
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://example.invalid':'server-only'},serve:f=>apiHandler=f};
const invite='x'.repeat(43),adminKey='y'.repeat(43),hash=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
const source=readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace("import {slots} from './slots.js';",'const slots='+JSON.stringify(slots)+';').replace(/const inviteHash='[^']+'/,`const inviteHash='${await hash(invite)}'`).replace(/const adminHash='[^']+'/,`const adminHash='${await hash(adminKey)}'`);
const {handler}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const empty=()=>({accounts:[],entries:[],cards:[],invoices:[],budgets:[],budgetAlerts:[],budgetSettings:{enabled:false}});
const tables={lt_pf_users_internal:slots.map(s=>({id:s.owner,space_id:s.space,username:s.placeholder,display_name:'Test',active:false,is_owner:true,permissions:{view:true,entries:true,invoices:true,accounts:true,cards:true,budgets:true},failed_attempts:0})),lt_pf_spaces_internal:slots.map(s=>({id:s.space,name:'Test',revision:0,data:empty()})),lt_pf_tokens_internal:[],lt_pf_chat_internal:[]};
let writes=0;
async function db(url,options={}){
 const u=new URL(url),table=tables[u.pathname.split('/').at(-1)],params=u.searchParams;
 const rows=table.filter(row=>[...params].every(([k,v])=>v.startsWith('eq.')?String(row[k])===v.slice(3):v.startsWith('gt.')?row[k]>v.slice(3):v.startsWith('in.(')?v.slice(4,-1).split(',').includes(row[k]):true));
 const method=options.method||'GET';if(method==='GET')return Response.json(structuredClone(rows));
 const body=options.body?JSON.parse(options.body):null;writes++;
 if(method==='PATCH'){
  if(body.username&&table.some(r=>r.username===body.username&&!rows.includes(r)))return Response.json({}, {status:409});
  rows.forEach(r=>Object.assign(r,body));return Response.json(structuredClone(rows));
 }
 if(method==='POST'){const incoming=Array.isArray(body)?body:[body];for(const row of incoming){if(params.get('on_conflict')==='user_id,message_id'&&table.some(r=>r.user_id===row.user_id&&r.message_id===row.message_id))continue;table.push(row)}return Response.json(body)}
 if(method==='DELETE'){for(const r of rows)table.splice(table.indexOf(r),1);return Response.json([])}
 throw Error('unexpected method');
}
globalThis.fetch=db;
await import(existsSync(new URL('../api/index.ts',import.meta.url))?'../api/index.ts':'../lt-meu-financeiro-teste-api/index.ts');
const registration=p=>handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify({invite,action:'register',name:'Test',password:'Test12345',...p})}),db);
const api=async(body,token)=>{const r=await apiHandler(new Request('https://example.invalid',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()}};
test('five independent registrations; approval required; sixth blocked; data and chats isolated',async()=>{
 assert.equal((await registration({invite:'wrong',username:'wrong'})).status,403);assert.equal(writes,0);
 assert.equal((await registration({username:'bad',password:'short'})).status,400);assert.equal(writes,0);
 // Duplicate username must not consume another slot.
 assert.equal((await registration({invite:null,username:'person0'})).status,200);
 assert.equal((await registration({username:'person0'})).status,409);
 const results=await Promise.all(Array.from({length:4},(_,i)=>registration({username:'person'+(i+1),spaceId:'someone-else',is_owner:false})));
 assert.deepEqual(results.map(r=>r.status),[200,200,200,200]);
 assert.equal(new Set(tables.lt_pf_users_internal.map(u=>u.space_id)).size,5);
 assert.equal(tables.lt_pf_users_internal.every(u=>!u.active),true);
 assert.equal((await registration({username:'sixth'})).status,409);
 assert.equal((await registration({action:'approve',adminKey:invite,userId:slots[0].owner})).status,403);
 assert.equal((await registration({action:'approve',adminKey,userId:'outside'})).status,404);
 const tokens=[];
 for(let i=0;i<5;i++){
  const pending=await api({action:'login',username:'person'+i,password:'Test12345'});assert.equal(pending.status,403);assert.match(pending.body.message,/aguardando autorização/);
  assert.equal(tables.lt_pf_tokens_internal.length,i);
  const member=tables.lt_pf_users_internal.find(u=>u.username==='person'+i);
  assert.equal((await registration({action:'approve',adminKey,userId:member.id})).status,200);
  const login=await api({action:'login',username:'person'+i,password:'Test12345'});assert.equal(login.status,200);tokens.push(login.body.token);
  const own=await api({action:'state'},login.body.token);assert.equal(own.status,200);assert.equal(own.body.people.length,1);assert.deepEqual(own.body.data,empty());
  assert.equal((await api({action:'greet'},login.body.token)).status,200);assert.equal((await api({action:'greet'},login.body.token)).status,200);
  const greetings=tables.lt_pf_chat_internal.filter(m=>m.user_id===member.id);assert.equal(greetings.length,1);assert.match(greetings[0].text,/Bem-vindo/);
  const other=slots.find(s=>s.space!==member.space_id);
  assert.equal((await api({action:'state',spaceId:other.space},login.body.token)).status,403);
  assert.equal((await api({action:'userCreate'},login.body.token)).status,403);
 }
 const id=crypto.randomUUID();assert.equal((await api({action:'account',id,name:'Private account',openingCents:5000},tokens[0])).status,200);
 for(let i=0;i<5;i++){const own=await api({action:'state'},tokens[i]);assert.equal(own.body.data.accounts.length,i===0?1:0);}
 assert.equal((await api({action:'chatAppend',messages:[{id:crypto.randomUUID(),role:'me',text:'Private message',time:new Date().toISOString()}]},tokens[0])).status,200);
 for(let i=1;i<5;i++){const r=await api({action:'chatState'},tokens[i]);assert.equal(r.status,200);assert.equal(JSON.stringify(r.body).includes('Private message'),false);}
 const outsider={...tables.lt_pf_users_internal[0],id:crypto.randomUUID(),username:'outsider',space_id:'outside'};tables.lt_pf_users_internal.push(outsider);
 assert.equal((await api({action:'login',username:'outsider',password:'Test12345'})).status,401);
 const member=tables.lt_pf_users_internal.find(u=>u.username==='person0');member.active=false;assert.equal((await api({action:'state'},tokens[0])).status,401);
 const list=await registration({action:'adminList',adminKey});const json=await list.json();assert.equal(json.users.length,5);assert.equal(JSON.stringify(json).includes('password_hash'),false);
});
