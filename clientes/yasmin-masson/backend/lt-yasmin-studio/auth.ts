const api=Deno.env.get('SUPABASE_URL')+'/rest/v1/',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'};
async function db(table:string,query:string,method='GET',body?:unknown){const r=await fetch(api+table+query,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Não foi possível acessar o painel.');return r.json()}
export async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function passwordHash(password:string,salt:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:210000},k,256))).map(x=>x.toString(16).padStart(2,'0')).join('')}
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export async function adminValid(session:string,token:unknown){if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;const rows=await db('lt_yasmin_studio_tokens_internal','?session_id=eq.'+session+'&token_hash=eq.'+await hash(token)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=token_hash');return rows.length===1}
export async function authAction(p:any,reply:any){
 if(p.action==='login'){
  const username=String(p.username||'').trim().toLowerCase(),password=String(p.password||'');
  if(username.length>100||password.length>200||!password)return reply({message:'Login ou senha incorretos.'},401);
  const rows=await db('lt_yasmin_studio_accounts_internal','?username=eq.'+encodeURIComponent(username));const account=rows[0];
  if(!account){await passwordHash(password,'unknown-account');return reply({message:'Login ou senha incorretos.'},401)}
  const now=Date.now();if(account.locked_until&&Date.parse(account.locked_until)>now)return reply({message:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'},429);
  const failures=account.locked_until?0:account.failed_attempts;
  const claimed=await db('lt_yasmin_studio_accounts_internal','?username=eq.'+encodeURIComponent(username)+'&failed_attempts=eq.'+account.failed_attempts,'PATCH',{failed_attempts:failures+1,locked_until:failures+1>=8?new Date(now+15*60000).toISOString():null});
  if(!claimed.length)return reply({message:'Tente entrar novamente.'},409);
  if(!equal(await passwordHash(password,account.password_salt),account.password_hash))return reply({message:'Login ou senha incorretos.'},401);
  await db('lt_yasmin_studio_accounts_internal','?username=eq.'+encodeURIComponent(username),'PATCH',{failed_attempts:0,locked_until:null});
  const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  await db('lt_yasmin_studio_tokens_internal','','POST',{token_hash:await hash(token),session_id:account.session_id,expires_at:new Date(now+30*86400000).toISOString()});
  return reply({session:account.session_id,admin:token});
 }
 if(p.action==='logout'){
  if(typeof p.admin==='string'&&/^[A-Za-z0-9_-]{43}$/.test(p.admin))await db('lt_yasmin_studio_tokens_internal','?token_hash=eq.'+await hash(p.admin),'DELETE');
  return reply({ok:true});
 }
 return null;
}
