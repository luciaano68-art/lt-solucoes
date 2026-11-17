import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto as crypto, randomBytes } from 'node:crypto';
const spaces=new Map(),codes=new Map(),rates=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function fetchMock(address,options){
 const u=new URL(address),body=options.body?JSON.parse(options.body):null,method=options.method;
 if(u.pathname.endsWith('/rpc/lt_eventos_allow_pair_attempt')){const count=(rates.get(body.p_bucket)||0)+1;rates.set(body.p_bucket,count);return json(count<=15);}
 if(u.pathname.endsWith('/lt_eventos_spaces')){
  if(method==='POST'){if(!spaces.has(body.id))spaces.set(body.id,body);return json([spaces.get(body.id)]);}
  const row=spaces.get(u.searchParams.get('id')?.slice(3));return json(row?[row]:[]);
 }
 if(u.pathname.endsWith('/lt_eventos_pair_codes')){
  if(method==='POST'){codes.set(body.space_id,body);return json([body]);}
  const hash=u.searchParams.get('code_hash')?.slice(3),expiry=u.searchParams.get('expires_at'),removed=[];
  for(const [id,row]of codes){const matches=(!hash||row.code_hash===hash)&&(!expiry||(expiry.startsWith('gt.')?row.expires_at>expiry.slice(3):row.expires_at<expiry.slice(3)));if(matches){codes.delete(id);removed.push(row);}}
  return json(removed);
 }
 if(u.pathname.endsWith('/lt_eventos_events'))return json([]);
 throw Error('Unexpected database operation: '+u.pathname);
}
let handler;
const context={crypto,Uint8Array,TextEncoder,TextDecoder,Response,console,fetch:fetchMock,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://test.invalid':'server-only-test-secret'},serve:fn=>{handler=fn;}}};
runInNewContext(readFileSync(new URL('./core.js',import.meta.url),'utf8'),context);
runInNewContext(stripTypeScriptTypes(readFileSync(new URL('./index.ts',import.meta.url),'utf8').replace("import './core.js';",'')),context);
const request=async(body,ip='test-client')=>{const response=await handler(new Request('https://test.invalid/functions/v1/lt-eventos-sync',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':ip},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()};};
const auth={spaceId:crypto.randomUUID(),secret:randomBytes(32).toString('hex')};
let r=await request({...auth,action:'create_pair'});assert.equal(r.status,200);assert.match(r.data.code,/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
assert.ok(new Date(r.data.expiresAt)-Date.now()>590000);assert.ok(new Date(r.data.expiresAt)-Date.now()<=600000);
const first=r.data.code,record=codes.get(auth.spaceId);assert.equal(record.code_hash.length,64);assert.ok(!record.encrypted_credentials.includes(auth.secret));assert.ok(!record.encrypted_credentials.includes(first));
r=await request({action:'redeem_pair',code:first.toLowerCase().replace('-',' ')});assert.equal(r.status,200);assert.deepEqual(r.data.cloud,auth);
assert.equal((await request({action:'redeem_pair',code:first})).status,400);
const old=(await request({...auth,action:'create_pair'})).data.code;
const fresh=(await request({...auth,action:'create_pair'})).data.code;
assert.notEqual(old,fresh);assert.equal((await request({action:'redeem_pair',code:old})).status,400);
codes.get(auth.spaceId).expires_at=new Date(Date.now()-1).toISOString();assert.equal((await request({action:'redeem_pair',code:fresh})).status,400);
assert.equal((await request({...auth,secret:'0'.repeat(64),action:'create_pair'})).status,401);
const concurrent=(await request({...auth,action:'create_pair'},'new-client')).data.code;
const replies=await Promise.all([request({action:'redeem_pair',code:concurrent},'new-client'),request({action:'redeem_pair',code:concurrent},'new-client')]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);
for(let i=0;i<15;i++)assert.equal((await request({action:'redeem_pair',code:'2222-2222'},'limited-client')).status,400);
assert.equal((await request({action:'redeem_pair',code:'2222-2222'},'limited-client')).status,429);
assert.equal((await request({...auth,action:'list'})).status,200);
console.log('PASS: encrypted round trip; 8-character code; 10-minute lifetime; one use; renewal; expiry; unauthorized mint; concurrent redemption; rate limit; legacy sync auth.');
