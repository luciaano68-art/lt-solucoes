import {createImportService} from './service.js';
import {slots} from './slots.js';
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json',Prefer:'return=representation'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
async function db(table:string,q:string,method='GET',body?:unknown,prefer?:string){const r=await fetch(base+table+q,{method,headers:prefer?{...headers,Prefer:prefer}:headers,body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Object.assign(Error('Não foi possível concluir. Tente novamente.'),{status:503});return r.json();}
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
const handle=createImportService({db,hash,allowedSpaces:new Set(slots.map(s=>s.space)),randomToken:()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return new Response(JSON.stringify({message:'Método inválido.'}),{status:405,headers:cors});
 try{const raw=await req.text();if(raw.length>12000)throw Object.assign(Error('Aviso muito grande.'),{status:413});let p;try{p=JSON.parse(raw)}catch{throw Error('Solicitação inválida.');}
  const result=await handle(p,(req.headers.get('Authorization')||'').replace(/^Bearer /,''));return new Response(JSON.stringify(result),{headers:cors});
 }catch(e){return new Response(JSON.stringify({message:e.message||'Não foi possível concluir.'}),{status:e.status||400,headers:cors});}
});
