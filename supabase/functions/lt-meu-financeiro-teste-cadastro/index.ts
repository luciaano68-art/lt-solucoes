// Five pre-provisioned spaces. Each registration atomically claims its own owner.
import {slots} from './slots.js';
import {normalizePhone} from './phone.js';
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
  const p=JSON.parse(raw),admin=['adminList','approve','resetPassword','setPhone'].includes(p.action),token=admin?p.adminKey:p.invite;
  if((admin||token)&& (typeof token!=='string'||token.length!==43||hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))!==(admin?adminHash:inviteHash)))return reply(403,{message:'Acesso inválido. Use o link correto.'});
  if(!['inviteStatus','register','adminList','approve','requestReset','resetPassword','setPhone'].includes(p.action))return reply(400,{message:'Opção inválida.'});
  const base=Deno.env.get('SUPABASE_URL')+'/rest/v1/lt_pf_users_internal',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const h={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  const filterFor=(slot:{owner:string,space:string,placeholder:string})=>'?id=eq.'+slot.owner+'&space_id=eq.'+slot.space+'&is_owner=eq.true&active=eq.false&username=eq.'+encodeURIComponent(slot.placeholder);
  const available=await db(base+'?id=in.('+slots.map(s=>s.owner).join(',')+')&is_owner=eq.true&select=id,space_id,username,display_name,active,teste_phone',{headers:h});
  if(!available.ok)throw Error('database');
  const rows=await available.json(),free=slots.filter(s=>rows.some((r:{id:string,space_id:string,username:string})=>r.id===s.owner&&r.space_id===s.space&&r.username===s.placeholder));
  const registered=rows.filter((r:{id:string,space_id:string,username:string})=>slots.some(s=>s.owner===r.id&&s.space===r.space_id&&s.placeholder!==r.username));
  const recovery=Deno.env.get('SUPABASE_URL')+'/rest/v1/lt_pf_teste_recovery_internal';
  if(p.action==='requestReset'){
   const phone=normalizePhone(p.phone);if(!phone)return reply(400,{message:'Informe um telefone válido com DDD.'});
   const targets=registered.filter((r:{teste_phone:string})=>r.teste_phone===phone);
   for(const target of targets){
    const existing=await db(recovery+'?user_id=eq.'+target.id+'&resolved_at=is.null',{headers:h});if(!existing.ok)throw Error('database');
    if(!(await existing.json()).length){const r=await db(recovery+'?on_conflict=user_id',{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:target.id,requested_at:new Date().toISOString(),resolved_at:null})});if(!r.ok)throw Error('database');}
   }
   return reply(200,{message:'Se este telefone estiver cadastrado, o pedido ficará aguardando autorização do responsável. Ele confirmará sua identidade antes de redefinir a senha.'});
  }
  if(admin){
   if(p.action==='adminList'){
    const pending=await db(recovery+'?user_id=in.('+slots.map(s=>s.owner).join(',')+')&resolved_at=is.null&select=user_id,requested_at',{headers:h});if(!pending.ok)throw Error('database');const requests=await pending.json();
    return reply(200,{limit:slots.length,remaining:free.length,users:registered.map((r:{id:string,username:string,display_name:string,active:boolean,teste_phone:string})=>({id:r.id,name:r.display_name,username:r.username,active:r.active,phone:r.teste_phone||null,resetRequested:requests.some((q:{user_id:string})=>q.user_id===r.id)}))});
   }
   const target=registered.find((r:{id:string})=>r.id===p.userId),slot=slots.find(s=>s.owner===p.userId);
   if(!target||!slot)return reply(404,{message:'Cadastro não encontrado.'});
   if(p.action==='setPhone'){
    const phone=normalizePhone(p.phone);if(!phone)return reply(400,{message:'Informe um telefone válido com DDD.'});
    const r=await db(base+'?id=eq.'+slot.owner+'&space_id=eq.'+slot.space,{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({teste_phone:phone})});
    if(!r.ok||!(await r.json()).length)throw Error('database');return reply(200,{saved:true});
   }
   if(p.action==='resetPassword'){
    if(p.confirmedIdentity!==true)return reply(400,{message:'Confirme a identidade do cliente antes de autorizar a redefinição.'});
    if(typeof p.password!=='string'||p.password.length<8||p.password.length>100)return reply(400,{message:'Senha: use entre 8 e 100 caracteres.'});
    const salt=crypto.randomUUID(),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p.password),'PBKDF2',false,['deriveBits']);
    const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:210000},key,256));
    const r=await db(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/lt_pf_teste_reset_password_internal',{method:'POST',headers:h,body:JSON.stringify({p_user_id:target.id,p_salt:salt,p_hash:hash})});
    if(!r.ok||!(await r.json()))throw Error('database');return reply(200,{reset:true});
   }
   const r=await db(base+'?id=eq.'+slot.owner+'&space_id=eq.'+slot.space+'&username=eq.'+encodeURIComponent(target.username),{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({active:true})});
   if(!r.ok||!(await r.json()).length)throw Error('database');return reply(200,{approved:true});
  }
  if(p.action==='inviteStatus'){
   return reply(200,{available:free.length>0,remaining:free.length,limit:slots.length});
  }
  const username=typeof p.username==='string'?p.username.trim().toLowerCase():'',name=typeof p.name==='string'?p.name.trim():'',password=p.password,phone=normalizePhone(p.phone);
  if(!phone)return reply(400,{message:'Informe um telefone válido com DDD.'});
  if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(username)||username.startsWith('pending.'))return reply(400,{message:'Login: use de 3 a 60 letras, números, ponto, hífen ou sublinhado.'});
  if(name.length<2||name.length>80)return reply(400,{message:'Informe seu nome.'});
  if(typeof password!=='string'||password.length<8||password.length>100)return reply(400,{message:'Senha: use entre 8 e 100 caracteres.'});
  const salt=crypto.randomUUID(),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:210000},key,256));
  for(const slot of free){
   const r=await db(base+filterFor(slot),{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({username,display_name:name,teste_phone:phone,password_salt:salt,password_hash:hash,active:false,failed_attempts:0,locked_until:null})});
   if(r.status===409)return reply(409,{message:'Este login já está em uso. Escolha outro.'});
   if(!r.ok)throw Error('database');
   if((await r.json()).length)return reply(200,{created:true,username,pending:true});
  }
  return reply(409,{message:'Os cinco acessos de teste já foram cadastrados. Entre com seu login ou fale com quem enviou o convite.'});
 }catch{return reply(500,{message:'Não foi possível concluir. Tente novamente.'})}
}
Deno.serve(req=>handler(req));
