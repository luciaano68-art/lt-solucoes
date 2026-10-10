import {visibleData} from './privacy.js';
const bucket='lt-financeiro-teste-comprovantes',maxBytes=3*1024*1024;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function receiptFile(p){
 if(typeof p.base64!=='string'||p.base64.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.base64))fail('Escolha uma foto de até 3 MB.');
 let bytes;try{bytes=Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0));}catch{fail('Foto inválida.');}
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n),webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 const mime=jpeg?'image/jpeg':png?'image/png':webp?'image/webp':null;
 if(!mime||mime!==p.mime||bytes.length>maxBytes)fail('Envie uma foto JPG, PNG ou WebP de até 3 MB.');
 return {bytes,mime,extension:jpeg?'jpg':png?'png':'webp'};
}
export function receiptEntry(data,id,user){const row=visibleData(data,user).entries?.find(e=>e.id===id&&!e.deleted);if(!row)fail('Lançamento indisponível neste financeiro.',404);return row;}
export async function manageReceipt(p,user,{db,storage,stamp=new Date().toISOString()}){
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 if(!uuid(p.id))fail('Lançamento inválido.');
 const file=p.action==='receiptUpload'?receiptFile(p):null;
 let uploaded=null;
 const validPath=path=>typeof path==='string'&&new RegExp('^'+user.space+'/'+p.id+'/[0-9a-f-]{36}\\.(jpg|png|webp)$').test(path);
 const cleanup=async path=>{if(validPath(path))await storage('/object/'+bucket,{method:'DELETE',json:{prefixes:[path]}}).catch(()=>{});};
 try{
  for(let retry=0;retry<6;retry++){
   const rows=await db('lt_pf_spaces_internal','?id=eq.'+user.space),space=rows[0];if(!space)fail('Financeiro indisponível.',404);
   const entry=receiptEntry(space.data,p.id,user);
   if(p.action==='receiptGet'){
    if(!entry.receipt||!validPath(entry.receipt.path))fail('Este lançamento ainda não tem comprovante.',404);
    const result=await storage('/object/sign/'+bucket+'/'+entry.receipt.path,{method:'POST',json:{expiresIn:60}});
    if(typeof result.signedURL!=='string'||!result.signedURL.startsWith('/object/sign/'+bucket+'/'))fail('Não foi possível abrir o comprovante.',503);
    return {signedPath:result.signedURL};
   }
   if(entry.version!==p.version)fail('O lançamento mudou. Atualize antes de anexar ou remover o comprovante.',409);
   if(file&&!uploaded){
    const existing=await storage('/bucket/'+bucket,{method:'GET',allowMissing:true});
    if(existing===null)await storage('/bucket',{method:'POST',json:{id:bucket,name:bucket,public:false,file_size_limit:maxBytes,allowed_mime_types:['image/jpeg','image/png','image/webp']}});
    else if(existing.public!==false)fail('Armazenamento do comprovante indisponível.',503);
    const path=user.space+'/'+entry.id+'/'+crypto.randomUUID()+'.'+file.extension;
    await storage('/object/'+bucket+'/'+path,{method:'POST',bytes:file.bytes,mime:file.mime});uploaded=path;
   }
   const next=structuredClone(space.data),target=next.entries.find(e=>e.id===entry.id),previous=target.receipt?.path;
   if(file)target.receipt={path:uploaded,mime:file.mime,size:file.bytes.length,uploadedBy:user.id,uploadedAt:stamp};else delete target.receipt;
   target.version++;target.updatedBy=user.name;target.updatedAt=stamp;
   const saved=await db('lt_pf_spaces_internal','?id=eq.'+user.space+'&revision=eq.'+space.revision,'PATCH',{data:next,revision:space.revision+1});
   if(saved.length){uploaded=null;await cleanup(previous);return {ok:true,revision:saved[0].revision,data:visibleData(saved[0].data,user)};}
  }
  fail('Outro aparelho está salvando. Tente novamente.',409);
 }catch(error){if(uploaded)await cleanup(uploaded);throw error;}
}
