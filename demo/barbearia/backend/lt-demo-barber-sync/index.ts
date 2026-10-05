import { createEngine } from './engine.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey, authorization','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const endpoint=Deno.env.get('SUPABASE_URL')+'/rest/v1/lt_demo_barber_sessions_internal';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'return=representation'};
async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function database(query:string,method='GET',body?:unknown){const r=await fetch(endpoint+query,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Não foi possível sincronizar a demonstração.');return r.json()}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({message:'Método inválido.'},405);
 try{
  const raw=await req.text();if(raw.length>1500000)return reply({message:'Dados de teste muito grandes.'},413);const p=JSON.parse(raw);
  if(p.action==='create'){
   const id=crypto.randomUUID(),admin=crypto.randomUUID();const engine=createEngine(null);
   if(p.seed&&p.seed.version===3&&Array.isArray(p.seed.bookings)&&Array.isArray(p.seed.hours)&&p.seed.catalog&&Array.isArray(p.seed.catalog.barbers))engine.api.replaceState(p.seed);
   await database('','POST',{id,admin_hash:await digest(admin),revision:0,data:engine.data});
   return reply({session:id,admin,state:engine.data});
  }
  if(!uuid.test(p.session||''))return reply({message:'Abra o link de agendamento enviado pelo painel da demonstração.'},400);
  for(let attempt=0;attempt<8;attempt++){
   const rows=await database('?id=eq.'+p.session+'&select=id,admin_hash,revision,data');const row=rows[0];if(!row)return reply({message:'Demonstração não encontrada. Peça um novo link pelo painel.'},404);
   const isAdmin=uuid.test(p.admin||'')&&await digest(p.admin)===row.admin_hash;
   if(p.action==='state'){if(!isAdmin)return reply({message:'Acesso restrito ao painel desta demonstração.'},403);return reply({state:row.data})}
   const engine=createEngine(row.data);let result:Response;
   if(p.action==='config'){
    if(!isAdmin)return reply({message:'Acesso restrito ao painel.'},403);
    if(!p.config||!Array.isArray(p.config.barbers)||!Array.isArray(p.config.services))return reply({message:'Cadastro inválido.'},400);
    engine.api.updateCatalog(p.config);result=reply({ok:true});
   }else if(p.action==='reset'){
    if(!isAdmin)return reply({message:'Acesso restrito ao painel.'},403);
    engine.api.replaceState(createEngine(null).data);result=reply({ok:true});
   }else{
    const u=new URL(p.path||'',engine.api.baseURL),method=String(p.method||'GET').toUpperCase();
    if(u.origin!==engine.api.baseURL)return reply({message:'Destino inválido.'},400);
    if(!isAdmin){
     const available=u.pathname==='/rest/v1/barbershop_public_bookings'&&method==='GET'&&u.searchParams.get('select')==='start_time,duration_minutes,status'&&/^eq\.\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('booking_date')||'')&&/^eq\.\d+$/.test(u.searchParams.get('barber_id')||'');
     const hours=u.pathname==='/rest/v1/barbershop_public_hours'&&method==='GET';
     const booking=u.pathname==='/rest/v1/barbershop_public_bookings'&&method==='POST';
     const notice=u.pathname==='/functions/v1/demo-notification';
     if(!(available||hours||booking||notice))return reply({message:'Acesso restrito ao painel.'},403);
     if(booking){
      const b=p.body||{},data=engine.data,bid=+b.barber_id,date=b.booking_date;
      const h=data.hours.find((x:any)=>x.barber_id==bid),cat=h?.catalog||engine.api.catalogForDemo(data,bid),s=cat.services.find((x:any)=>x.id==b.service_id&&x.active);
      if(!cat.barber.active||!s)return reply({message:'Serviço indisponível. Atualize a página.'},400);
      const w=engine.api.schedule(bid,date,h?.weekly||{});
      if(!engine.api.within(w,b.start_time,+s.duration)||engine.api.blocked(data,{...b,duration_minutes:+s.duration}))return reply({message:'outside_barbershop_hours'},409);
      if(+b.price!==+s.price||+b.duration_minutes!==+s.duration||b.service_name!==s.name)return reply({message:'Este serviço foi atualizado. Confira o preço e a duração e escolha novamente.'},400);
      if(date===engine.api.today()&&new Date(date+'T'+b.start_time+':00-03:00')<=new Date())return reply({message:'outside_barbershop_hours'},409);
      p.body={barber_id:bid,service_id:s.id,client_name:String(b.client_name||'').slice(0,150),client_phone:String(b.client_phone||'').slice(0,30),service_name:s.name,barber_name:cat.barber.name,booking_date:date,start_time:b.start_time,duration_minutes:+s.duration,price:+s.price,status:'Agendado'};
     }
    }
    result=await engine.api.fetch(u.href,{method,body:method==='GET'?undefined:JSON.stringify(p.body||{})});
    if(!isAdmin&&u.pathname==='/rest/v1/barbershop_public_hours'&&method==='GET'&&u.searchParams.has('demo_date')){
     const date=u.searchParams.get('demo_date')!;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply({message:'Data inválida.'},400);
     const hours=await result.json(),day=new Date(date+'T12:00:00').getDay(),bid=+(u.searchParams.get('barber_id')||'').slice(3);
     for(const h of hours)if(h.weekly)h.weekly={...h.weekly,[day]:engine.api.schedule(bid,date,h.weekly)};
     result=new Response(JSON.stringify(hours),{status:result.status});
    }
   }
   const body=await result.json();if(!result.ok)return reply(body,result.status);
   if(!engine.written)return reply(body,result.status);
   const updated=await database('?id=eq.'+p.session+'&revision=eq.'+row.revision,'PATCH',{revision:row.revision+1,data:engine.data});
   if(updated.length)return reply(body,result.status);
  }
  return reply({message:'A agenda está sendo atualizada. Confira os horários e tente novamente.'},409);
 }catch(e){console.error(e);return reply({message:'Não foi possível sincronizar a demonstração. Confira sua conexão e tente novamente.'},503)}
});
