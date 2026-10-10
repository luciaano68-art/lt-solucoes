import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://test.invalid':'server-secret'}};
const source=readFileSync(new URL('./admin-push.ts',import.meta.url),'utf8').replace("import webpush from 'npm:web-push@3.6.7';",'const webpush={};');
const {createAdminPush,validSubscription}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const subscription={endpoint:'https://fcm.googleapis.com/send/test-only',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};
test('admin push uses only its private tables; notifies once; rejects foreign endpoints; removes expired subscription',async()=>{
 assert.equal(validSubscription(subscription),true);for(const endpoint of ['http://fcm.googleapis.com/test','https://127.0.0.1/test','https://fcm.googleapis.com.evil.invalid/test','https://evil.invalid/test'])assert.equal(validSubscription({...subscription,endpoint}),false);
 const tables={lt_pf_teste_admin_push_config_internal:[],lt_pf_teste_admin_push_subscriptions_internal:[],lt_pf_teste_admin_push_events_internal:[]},sends=[];
 const request=async(url,opts)=>{const u=new URL(url),name=u.pathname.split('/').at(-1);assert.ok(name in tables,name);assert.equal(opts.headers.Authorization,'Bearer server-secret');const table=tables[name],rows=table.filter(row=>[...u.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(row[k])===v.slice(3)));let result=rows;
  if(opts.method==='POST'){const body=JSON.parse(opts.body),key=u.searchParams.get('on_conflict'),old=table.find(r=>r[key]===body[key]);if(old){if(opts.headers.Prefer.includes('ignore-duplicates'))result=[];else{Object.assign(old,body);result=[old];}}else{table.push(body);result=[body];}}
  if(opts.method==='PATCH')rows.forEach(r=>Object.assign(r,JSON.parse(opts.body)));
  if(opts.method==='DELETE')for(const row of rows)table.splice(table.indexOf(row),1);
  return Response.json(structuredClone(result));};
 const transport={generateVAPIDKeys:()=>({publicKey:'public',privateKey:'private'}),setVapidDetails:(url,pub,secret)=>{assert.equal(pub,'public');assert.equal(secret,'private');assert.match(url,/financeiro-teste\/admin\/$/);},sendNotification:async(sub,payload)=>sends.push(JSON.parse(payload))};
 const push=createAdminPush(transport,request);
 assert.deepEqual(await push.action({action:'pushPublicKey'}),{publicKey:'public'});
 await assert.rejects(push.action({action:'pushSubscribe',subscription:{endpoint:'http://localhost'}}),e=>e.status===400);
 await push.action({action:'pushSubscribe',subscription});await push.action({action:'pushSubscribe',subscription});assert.equal(tables.lt_pf_teste_admin_push_subscriptions_internal.length,1);
 await push.notify('cadastro:client-1','cadastro');await push.notify('cadastro:client-1','cadastro');assert.equal(sends.length,1);assert.match(sends[0].title,/aguardando autorização/);assert.equal(sends[0].url,'https://lt-solucoes.vercel.app/clientes/financeiro-teste/admin/');
 await push.notify('reset:client-1:now','reset');assert.equal(sends.length,2);assert.match(sends[1].body,/identidade/);
 const result=await push.action({action:'pushTest',subscription});assert.equal(result.ok,true);assert.equal(sends.length,3);
 transport.sendNotification=async()=>{throw {statusCode:410};};assert.equal((await push.action({action:'pushTest',subscription})).ok,false);assert.equal(tables.lt_pf_teste_admin_push_subscriptions_internal.length,0);
});
test('admin app has its own install identity and cache; push click stays in the admin panel',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../admin/manifest.json',import.meta.url),'utf8'));assert.equal(manifest.id,'/clientes/financeiro-teste/admin/');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
 const events={},shown=[],opened=[],scope='https://lt-solucoes.vercel.app/clientes/financeiro-teste/admin/';
 const self={registration:{scope,showNotification:async(...args)=>shown.push(args)},addEventListener:(name,fn)=>events[name]=fn,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(readFileSync(new URL('../admin/sw.js',import.meta.url),'utf8'),{self,URL});let work;
 events.push({data:{json:()=>({title:'Pedido',body:'Autorize',url:'https://evil.invalid/'})},waitUntil:p=>work=p});await work;assert.equal(shown.length,1);assert.equal(shown[0][1].data.url,scope);
 events.notificationclick({notification:{close(){}},waitUntil:p=>work=p});await work;assert.deepEqual(opened,[scope]);
});
