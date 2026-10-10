const valid=m=>m&&['me','bot'].includes(m.role)&&typeof m.text==='string'&&m.text.trim()&&Number.isFinite(Date.parse(m.time));
const order=(a,b)=>a.time.localeCompare(b.time)||a.id.localeCompare(b.id);
export function mergeMessages(local,remote){const map=new Map();for(const m of [...local,...remote])if(valid(m)&&m.id)map.set(m.id,m);return [...map.values()].sort(order);}
async function legacyId(m){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([m.role,m.text,m.time]))));const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);}
export class ChatSync {
 constructor(owner,{request,storage,onChange=()=>{}}){this.owner=owner;this.request=request;this.storage=storage;this.onChange=onChange;this.key='lt_pf_ld_chat_v2_'+owner;this.messages=[];this.pending=new Set();this.status='loading';this.ready=false;this.active=true;this.hasOlder=false;this.before=null;this.flushing=null;this.pulling=null;}
 save(){try{this.storage.setItem(this.key,JSON.stringify({messages:this.messages,pending:[...this.pending]}));}catch{this.status='error';}}
 emit(changed=false){if(this.active)this.onChange(changed);}
 async initialize(){
  let cache=null;try{cache=JSON.parse(this.storage.getItem(this.key)||'null');}catch{}
  if(cache&&Array.isArray(cache.messages)){this.messages=mergeMessages([],cache.messages);this.pending=new Set((cache.pending||[]).filter(id=>this.messages.some(m=>m.id===id)));}
  else{let old=[];try{old=JSON.parse(this.storage.getItem('lt_pf_ld_chat_'+this.owner)||'[]');}catch{}if(Array.isArray(old))for(const m of old.filter(valid)){const item={id:await legacyId(m),role:m.role,text:m.text,time:new Date(m.time).toISOString()};this.messages=mergeMessages(this.messages,[item]);this.pending.add(item.id);}this.save();}
  this.ready=true;await this.flush();await this.pull();this.emit(true);
 }
 add(role,text){const previous=this.messages.at(-1)?.time,stamp=Math.max(Date.now(),previous?Date.parse(previous)+1:0);const m={id:crypto.randomUUID(),role,text,time:new Date(stamp).toISOString()};this.messages.push(m);this.pending.add(m.id);this.status='saving';this.save();this.emit();void this.flush();return m;}
 async flush(){
  if(this.flushing)return this.flushing;if(!this.active||!this.pending.size)return;
  this.flushing=(async()=>{try{this.status='saving';this.emit();while(this.active&&this.pending.size){const items=this.messages.filter(m=>this.pending.has(m.id));let batch=[],size=0;for(const m of items){const length=JSON.stringify(m).length;if(batch.length&&(size+length>55000||batch.length===20))break;batch.push(m);size+=length;}if(!batch.length)break;await this.request({action:'chatAppend',messages:batch});for(const m of batch)this.pending.delete(m.id);this.save();}this.status=this.pending.size?'pending':'synced';}catch{this.status='pending';}finally{this.flushing=null;this.save();this.emit();}})();return this.flushing;
 }
 async pull(older=false){
  if(this.pulling)return this.pulling;if(!this.active)return;
  this.pulling=(async()=>{try{const result=await this.request({action:'chatState',...(older&&this.before?{before:this.before}:{})});if(!this.active)return;const before=JSON.stringify(this.messages);this.messages=mergeMessages(this.messages,result.messages||[]);if(older||!this.before){this.hasOlder=!!result.hasOlder;this.before=result.before;}else if(result.before&&result.before.time<this.before.time){this.before=result.before;this.hasOlder=!!result.hasOlder;}this.status=this.pending.size?'pending':'synced';this.save();this.emit(before!==JSON.stringify(this.messages));}catch{this.status='error';this.emit();}finally{this.pulling=null;}})();return this.pulling;
 }
 stop(){this.active=false;}
}
