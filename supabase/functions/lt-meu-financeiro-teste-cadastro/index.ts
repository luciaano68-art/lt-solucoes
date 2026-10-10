// Single-use invitation: this function can activate only the Teste owner.
const space='dde8d6a6-cda9-4728-9f1e-8d14ca54e5f1',owner='6a1a605f-aaee-4034-ab40-7be00588c16a';
const inviteHash='a724921d48942d93fbbb580ce7cd536e74f6b11f7dcad8e7f79e2e9537748fff';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,message:unknown)=>new Response(JSON.stringify(message),{status,headers});
const hex=(v:ArrayBuffer)=>Array.from(new Uint8Array(v),b=>b.toString(16).padStart(2,'0')).join('');
export async function handler(req:Request,db=fetch){
 if(req.method==='OPTIONS')return reply(200,{});
 if(req.method!=='POST')return reply(405,{message:'Use POST.'});
 try{
  const raw=await req.text();if(raw.length>4096)return reply(413,{message:'Pedido muito grande.'});
  const p=JSON.parse(raw),token=typeof p.invite==='string'?p.invite:'';
  if(token.length!==43||hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))!==inviteHash)return reply(403,{message:'Convite inválido. Peça o link de cadastro.'});
  if(!['inviteStatus','register'].includes(p.action))return reply(400,{message:'Opção inválida.'});
  const base=Deno.env.get('SUPABASE_URL')+'/rest/v1/lt_pf_users_internal',secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const h={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  const filter='?id=eq.'+owner+'&space_id=eq.'+space+'&is_owner=eq.true&active=eq.false';
  if(p.action==='inviteStatus'){
   const r=await db(base+filter+'&select=id',{headers:h});if(!r.ok)throw Error('database');
   return reply(200,{available:(await r.json()).length===1});
  }
  const username=typeof p.username==='string'?p.username.trim().toLowerCase():'',name=typeof p.name==='string'?p.name.trim():'',password=p.password;
  if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(username))return reply(400,{message:'Login: use de 3 a 60 letras, números, ponto, hífen ou sublinhado.'});
  if(name.length<2||name.length>80)return reply(400,{message:'Informe seu nome.'});
  if(typeof password!=='string'||password.length<8||password.length>100)return reply(400,{message:'Senha: use entre 8 e 100 caracteres.'});
  const salt=crypto.randomUUID(),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:210000},key,256));
  const r=await db(base+filter,{method:'PATCH',headers:{...h,Prefer:'return=representation'},body:JSON.stringify({username,display_name:name,password_salt:salt,password_hash:hash,active:true,failed_attempts:0,locked_until:null})});
  if(r.status===409)return reply(409,{message:'Este login já está em uso. Escolha outro.'});
  if(!r.ok)throw Error('database');
  if(!(await r.json()).length)return reply(409,{message:'Este cadastro já foi feito. Entre com o login e a senha que você criou.'});
  return reply(200,{created:true,username});
 }catch{return reply(500,{message:'Não foi possível concluir. Tente novamente.'})}
}
Deno.serve(req=>handler(req));
