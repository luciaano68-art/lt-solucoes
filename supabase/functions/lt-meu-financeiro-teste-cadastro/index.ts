// Five pre-provisioned spaces. Each registration atomically claims its own owner.
import {slots} from './slots.js';
const inviteHash='a724921d48942d93fbbb580ce7cd536e74f6b11f7dcad8e7f79e2e9537748fff';
const adminHash='9bdae1d70b7849371c8b02f91097552271f79ab0f640a70357b3e461ac1c9b12';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,message:unknown)=>new Response(JSON.stringify(message),{status,headers});
const hex=(v:ArrayBuffer)=>Array.from(new Uint8Array(v),b=>b.toString(16).padStart(2,'0')).join('');
export async function handler(req:Request,db=fetch){
 if(req.method==='OPTIONS')return reply(200,{});
 if(req.method!=='POST')return reply(405,{message:'Use POST.'});
 try{
  const raw=await req.text();if(raw.length>4096)return reply(413,{message:'Pedido muito grande.'});
  const p=JSON.parse(raw),admin=['adminList','approve'].includes(p.action),token=admin?p.adminKey:p.invite;
  if((admin||token)&& (typeof token!=='string'||token.length!==43||hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))!==(admin?adminHash:inviteHash)))return reply(403,{message:'Acesso inválido. Use o link correto.'});
  if(!['inviteStatus','register','adminList','approve'].includes(p.action))return reply(400,{message:'Opção inválida.'});
  const base=Deno.env.get('SUPABASE_URL')+'/rest/v1/lt_pf_users_internal',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const h={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  const filterFor=(slot:{owner:string,space:string,placeholder:string})=>'?id=eq.'+slot.owner+'&space_id=eq.'+slot.space+'&is_owner=eq.true&active=eq.false&username=eq.'+encodeURIComponent(slot.placeholder);
  const available=await db(base+'?id=in.('+slots.map(s=>s.owner).join(',')+')&is_owner=eq.true&select=id,space_id,username,display_name,active',{headers:h});
  if(!available.ok)throw Error('database');
  const rows=await available.json(),free=slots.filter(s=>rows.some((r:{id:string,space_id:string,username:string})=>r.id===s.owner&&r.space_id===s.space&&r.username===s.placeholder));
  if(admin){
   const registered=rows.filter((r:{id:string,space_id:string,username:string})=>slots.some(s=>s.owner===r.id&&s.space===r.space_id&&s.placeholder!==r.username));
   if(p.action==='adminList')return reply(200,{limit:slots.length,remaining:free.length,users:registered.map((r:{id:string,username:string,display_name:string,active:boolean})=>({id:r.id,name:r.display_name,username:r.username,active:r.active}))});
   const target=registered.find((r:{id:string})=>r.id===p.userId),slot=slots.find(s=>s.owner===p.userId);
   if(!target||!slot)return reply(404,{message:'Cadastro não encontrado.'});
   const r=await db(base+'?id=eq.'+slot.owner+'&space_id=eq.'+slot.space+'&username=eq.'+encodeURIComponent(target.username),{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({active:true})});
   if(!r.ok||!(await r.json()).length)throw Error('database');return reply(200,{approved:true});
  }
  if(p.action==='inviteStatus'){
   return reply(200,{available:free.length>0,remaining:free.length,limit:slots.length});
  }
  const username=typeof p.username==='string'?p.username.trim().toLowerCase():'',name=typeof p.name==='string'?p.name.trim():'',password=p.password;
  if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(username)||username.startsWith('pending.'))return reply(400,{message:'Login: use de 3 a 60 letras, números, ponto, hífen ou sublinhado.'});
  if(name.length<2||name.length>80)return reply(400,{message:'Informe seu nome.'});
  if(typeof password!=='string'||password.length<8||password.length>100)return reply(400,{message:'Senha: use entre 8 e 100 caracteres.'});
  const salt=crypto.randomUUID(),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:210000},key,256));
  for(const slot of free){
   const r=await db(base+filterFor(slot),{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({username,display_name:name,password_salt:salt,password_hash:hash,active:false,failed_attempts:0,locked_until:null})});
   if(r.status===409)return reply(409,{message:'Este login já está em uso. Escolha outro.'});
   if(!r.ok)throw Error('database');
   if((await r.json()).length)return reply(200,{created:true,username,pending:true});
  }
  return reply(409,{message:'Os cinco acessos de teste já foram cadastrados. Entre com seu login ou fale com quem enviou o convite.'});
 }catch{return reply(500,{message:'Não foi possível concluir. Tente novamente.'})}
}
Deno.serve(req=>handler(req));
