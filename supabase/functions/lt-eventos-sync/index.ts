import './core.js';
const C=(globalThis as any).FichasCore;
const base=Deno.env.get('SUPABASE_URL')+'/rest/v1/',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function db(table:string,query:string,method='GET',body?:unknown,prefer?:string){const r=await fetch(base+table+query,{method,headers:{...headers,...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('A sincronização não respondeu. As vendas continuam salvas no aparelho.');return r.status===204?null:r.json();}
async function digest(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function equal(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return reply({message:'Método inválido.'},405);
 try{
  const raw=await req.text();if(raw.length>1200000)return reply({message:'Lote muito grande. Reduza a sincronização.'},413);const p=JSON.parse(raw);
  if(!uuid.test(p.spaceId||'')||!/^[a-f0-9]{64}$/.test(p.secret||''))return reply({message:'Código de conexão inválido.'},401);
  const hash=await digest(p.secret);let spaces=await db('lt_eventos_spaces','?id=eq.'+p.spaceId+'&select=id,key_hash');
  if(!spaces.length){await db('lt_eventos_spaces','?on_conflict=id','POST',{id:p.spaceId,key_hash:hash},'resolution=ignore-duplicates,return=representation');spaces=await db('lt_eventos_spaces','?id=eq.'+p.spaceId+'&select=id,key_hash');}
  if(!spaces.length||!equal(spaces[0].key_hash,hash))return reply({message:'Código de conexão não autorizado.'},401);
  if(p.action==='list'){const rows=await db('lt_eventos_events','?space_id=eq.'+p.spaceId+'&select=id,revision,event:data->event&order=updated_at.desc&limit=200');return reply({events:rows.map((r:any)=>({id:r.id,revision:r.revision,event:r.event}))});}
  if(p.action!=='sync'||!uuid.test(p.eventId||'')||!Array.isArray(p.operations)||p.operations.length>30)return reply({message:'Lote de sincronização inválido.'},400);
  for(let attempt=0;attempt<6;attempt++){
   const query='?space_id=eq.'+p.spaceId+'&id=eq.'+p.eventId;const rows=await db('lt_eventos_events',query+'&select=revision,data'),old=rows[0];
   if(old&&p.operations.length===0&&p.revision===old.revision)return reply({notModified:true,revision:old.revision,ack:[]});
   const merged=C.mergeCloud(old?.data,p.operations,p.eventId),rev=(old?.revision||0)+1;
   if(!old){const created=await db('lt_eventos_events','?on_conflict=space_id,id','POST',{space_id:p.spaceId,id:p.eventId,revision:rev,data:merged.data},'resolution=ignore-duplicates,return=representation');if(!created.length)continue;}
   else if(p.operations.length){const saved=await db('lt_eventos_events',query+'&revision=eq.'+old.revision,'PATCH',{data:merged.data,revision:rev,updated_at:new Date().toISOString()});if(!saved.length)continue;}
   const revision=p.operations.length||!old?rev:old.revision;return reply({revision,ack:merged.ack,event:merged.data.event,sectors:merged.data.sectors,products:merged.data.products,sales:merged.data.sales});
  }
  return reply({message:'Outro caixa está sincronizando. Tentarei novamente sem interromper as vendas.'},409);
 }catch(e){return reply({message:e instanceof Error?e.message:'Sincronização indisponível.'},400);}
});
