// Same-origin session persistence. Passwords are never stored.
export function createSessionStore({key,local,session,indexedDB}){
 const valid=value=>value&&typeof value.token==='string'&&value.token.length>0&&value.user&&typeof value.user.id==='string';
 const read=storage=>{try{const value=JSON.parse(storage?.getItem(key)||'null');return valid(value)?value:null}catch{return null}};
 let queue=Promise.resolve();
 const database=()=>new Promise(resolve=>{if(!indexedDB){resolve(null);return}let request;try{request=indexedDB.open('lt-finance-lucas-session-v1',1)}catch{resolve(null);return}request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('session'))request.result.createObjectStore('session')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);});
 const disk=async(mode,value)=>{const db=await database();if(!db)return null;return new Promise(resolve=>{let result=null;try{const tx=db.transaction('session',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('session');const req=mode==='read'?store.get(key):mode==='clear'?store.delete(key):store.put(value,key);req.onsuccess=()=>{result=mode==='read'?req.result:true};tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=tx.onabort=()=>{db.close();resolve(null)}}catch{db.close();resolve(null)}})};
 const serial=fn=>{const next=queue.then(fn,fn);queue=next.catch(()=>{});return next};
 return {
  readSync:()=>read(local)||read(session),
  load:()=>serial(async()=>{const saved=read(local)||read(session);if(saved)return saved;const savedDisk=await disk('read');return valid(savedDisk)?savedDisk:null}),
  save:value=>serial(async()=>{if(!valid(value))throw Error('Sessão inválida.');let saved=false;for(const storage of [local,session])try{if(storage){storage.setItem(key,JSON.stringify(value));saved=true}}catch{}return (await disk('write',value))===true||saved}),
  clear:()=>serial(async()=>{for(const storage of [local,session])try{storage?.removeItem(key)}catch{}await disk('clear');})
 };
}
