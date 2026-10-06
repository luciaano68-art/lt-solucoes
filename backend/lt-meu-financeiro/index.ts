import {mutate} from './ledger.js';
import {chatRows,chatQuery,chatPage} from './chat.js';
const base=Deno.env.get('SUPABASE_URL')+'/rest/v1/',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const heads={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json',Prefer:'return=representation'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
async function db(table:string,q:string,method='GET',body?:unknown,prefer?:string){const r=await fetch(base+table+q,{method,headers:prefer?{...heads,Prefer:prefer}:heads,body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Object.assign(Error('Não foi possível salvar no servidor. Tente novamente.'),{status:503});return r.json()}
const reply=(v:any,s=200)=>new Response(JSON.stringify(v),{status:s,headers:cors});
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a)).map(n=>n.toString(16).padStart(2,'0')).join('');
async function hash(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
async function passwordHash(p:string,s:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(s),iterations:210000},key,256))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
async function identity(req:Request){const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Object.assign(Error('Entre com seu login.'),{status:401});const digest=await hash(token),rows=await db('lt_pf_tokens_internal','?token_hash=eq.'+digest+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));if(!rows.length)throw Object.assign(Error('Seu acesso expirou. Entre novamente.'),{status:401});const users=await db('lt_pf_users_internal','?id=eq.'+rows[0].user_id+'&active=eq.true');if(!users.length)throw Object.assign(Error('Acesso indisponível.'),{status:401});return {id:users[0].id,name:users[0].display_name,space:users[0].space_id,digest}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply({message:'Método inválido.'},405);
 try{
  const raw=await req.text();if(raw.length>60000)return reply({message:'Solicitação muito grande.'},413);let p;try{p=JSON.parse(raw)}catch{return reply({message:'Solicitação inválida.'},400)}
  if(p.action==='login'){
   const username=String(p.username||'').trim().toLowerCase(),password=String(p.password||'');if(username.length>100||password.length>200||!password)return reply({message:'Login ou senha incorretos.'},401);
   const rows=await db('lt_pf_users_internal','?username=eq.'+encodeURIComponent(username)+'&active=eq.true'),a=rows[0];if(!a){await passwordHash(password,'unknown');return reply({message:'Login ou senha incorretos.'},401)}
   if(a.locked_until&&Date.parse(a.locked_until)>Date.now())return reply({message:'Muitas tentativas. Aguarde 15 minutos.'},429);
   const failures=a.locked_until?0:a.failed_attempts;
   const claim=await db('lt_pf_users_internal','?id=eq.'+a.id+'&failed_attempts=eq.'+a.failed_attempts,'PATCH',{failed_attempts:failures+1,locked_until:failures+1>=8?new Date(Date.now()+900000).toISOString():null});if(!claim.length)return reply({message:'Tente entrar novamente.'},409);
   if(!equal(await passwordHash(password,a.password_salt),a.password_hash))return reply({message:'Login ou senha incorretos.'},401);
   await db('lt_pf_users_internal','?id=eq.'+a.id,'PATCH',{failed_attempts:0,locked_until:null});
   const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');await db('lt_pf_tokens_internal','','POST',{token_hash:await hash(token),user_id:a.id,expires_at:new Date(Date.now()+90*86400000).toISOString()});return reply({token,user:{id:a.id,name:a.display_name}});
  }
  const user=await identity(req);
  if(p.spaceId&&p.spaceId!==user.space)return reply({message:'Você não tem acesso a este financeiro.'},403);
  if(p.action==='chatState')return reply(chatPage(await db('lt_pf_chat_internal',chatQuery(user,p.before))));
  if(p.action==='chatAppend'){await db('lt_pf_chat_internal','?on_conflict=user_id,message_id','POST',chatRows(p.messages,user),'resolution=ignore-duplicates,return=representation');return reply({ok:true})}
  if(p.action==='logout'){await db('lt_pf_tokens_internal','?token_hash=eq.'+user.digest,'DELETE');return reply({ok:true})}
  if(p.action==='state'){const spaces=await db('lt_pf_spaces_internal','?id=eq.'+user.space);if(!spaces.length)return reply({message:'Financeiro indisponível.'},404);const people=await db('lt_pf_users_internal','?space_id=eq.'+user.space+'&active=eq.true&select=id,display_name');return reply({space:{id:user.space,name:spaces[0].name},revision:spaces[0].revision,data:spaces[0].data,user:{id:user.id,name:user.name},people})}
  for(let retry=0;retry<6;retry++){
   const rows=await db('lt_pf_spaces_internal','?id=eq.'+user.space),space=rows[0];if(!space)throw Object.assign(Error('Financeiro indisponível.'),{status:404});
   const next=mutate(space.data,p,user,new Date().toISOString());
   const saved=await db('lt_pf_spaces_internal','?id=eq.'+user.space+'&revision=eq.'+space.revision,'PATCH',{data:next,revision:space.revision+1});if(saved.length)return reply({ok:true,revision:saved[0].revision,data:saved[0].data});
  }
  return reply({message:'Outro aparelho está salvando. Tente novamente.'},409);
 }catch(e){return reply({message:e.message||'Não foi possível concluir.'},e.status||400)}
});
