import {assertPermission} from './permissions.js';
import {parseNotification,possibleDuplicate} from './parse.js';
import {visibleData} from './privacy.js';
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status})};
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const connections='lt_pf_notification_connections',inbox='lt_pf_notification_inbox';
export function createImportService({db,hash,randomToken,allowedSpaces,now=()=>new Date().toISOString()}){
 async function userById(id){
  const rows=await db('lt_pf_users_internal','?id=eq.'+id+'&active=eq.true&teste_deleted_at=is.null'),row=rows[0];
  if(!row||!allowedSpaces.has(row.space_id))fail('Acesso indisponível.',401);
  if(!row.is_owner){const owner=await db('lt_pf_users_internal','?space_id=eq.'+row.space_id+'&is_owner=eq.true&active=eq.true&teste_deleted_at=is.null');if(!owner.length)fail('Este financeiro está pausado.',403);}
  const user={id:row.id,space:row.space_id,name:row.display_name,isOwner:row.is_owner,permissions:row.permissions};assertPermission(user,'entry');return user;
 }
 async function identity(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))fail('Entre no aplicativo para continuar.',401);
  const sessions=await db('lt_pf_tokens_internal','?token_hash=eq.'+await hash(token)+'&expires_at=gt.'+encodeURIComponent(now()));if(!sessions.length)fail('Seu acesso expirou.',401);return userById(sessions[0].user_id);
 }
 async function spaceData(user){const rows=await db('lt_pf_spaces_internal','?id=eq.'+user.space);if(!rows.length)fail('Financeiro indisponível.',404);return rows[0].data;}
 return async function handle(p,token){
  if(!p||typeof p!=='object'||Array.isArray(p))fail('Solicitação inválida.');
  if(p.action==='capture'){
   if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))fail('Conexão inválida.',401);
   const rows=await db(connections,'?token_hash=eq.'+await hash(token)+'&active=eq.true&expires_at=gt.'+encodeURIComponent(now())),connection=rows[0];if(!connection)fail('Conexão desativada ou expirada.',401);
   const user=await userById(connection.user_id),parsed=parseNotification(p,now());
   const fingerprint=await hash(connection.id+'|'+parsed.eventKey),previous=await db(inbox,'?user_id=eq.'+user.id+'&fingerprint=eq.'+fingerprint+'&select=id,status');
   if(previous.length)return {ok:true,duplicate:true};
   const recent=await db(inbox,'?connection_id=eq.'+connection.id+'&created_at=gt.'+encodeURIComponent(new Date(Date.parse(now())-86400000).toISOString())+'&select=id&limit=101');if(recent.length>=100)fail('Limite de 100 avisos por dia nesta conexão.',429);
   const data=await spaceData(user);if(connection.card_id&&!data.cards?.some(c=>c.id===connection.card_id&&!c.deleted))fail('O cartão desta conexão não está disponível. Configure novamente.',409);
   const proposal={...parsed.proposal,cardId:connection.card_id||null,source:connection.name};
   // No ledger mutation: even valid bank messages are only suggestions.
   const saved=await db(inbox,'?on_conflict=user_id,fingerprint','POST',{user_id:user.id,connection_id:connection.id,fingerprint,proposal,received_at:parsed.receivedAt},'resolution=ignore-duplicates,return=representation');
   return {ok:true,duplicate:!saved.length};
  }
  const user=await identity(token);
  if(p.action==='pair'){
   const name=typeof p.name==='string'?p.name.trim():'';if(!name||name.length>80)fail('Informe um nome para a conexão.');
   const data=await spaceData(user);if(p.cardId&&(!uuid(p.cardId)||!data.cards?.some(c=>c.id===p.cardId&&!c.deleted)))fail('Escolha um cartão deste financeiro.');
   const active=await db(connections,'?user_id=eq.'+user.id+'&active=eq.true&select=id&limit=11');if(active.length>=10)fail('Desative uma conexão antes de criar outra.');
   const key=randomToken(),expires=new Date(Date.parse(now())+90*86400000).toISOString();
   const saved=await db(connections,'','POST',{user_id:user.id,token_hash:await hash(key),name,card_id:p.cardId||null,expires_at:expires});
   return {id:saved[0].id,key,expiresAt:expires};
  }
  if(p.action==='status'){
   const own=await db(connections,'?user_id=eq.'+user.id+'&select=id,name,card_id,active,expires_at&order=created_at.desc');
   const rows=await db(inbox,'?user_id=eq.'+user.id+'&status=eq.pending&order=created_at.desc&limit=101');
   const data=visibleData(await spaceData(user),user),entries=data.entries||[];
   // Repair the marker if a previous response was lost after ledger save.
   const savedIds=new Set(entries.map(e=>e.id)),pending=[];
   for(const r of rows){if(savedIds.has(r.id)){await db(inbox,'?id=eq.'+r.id+'&user_id=eq.'+user.id+'&status=eq.pending','PATCH',{status:'confirmed'});}else pending.push({id:r.id,proposal:r.proposal,receivedAt:r.received_at,possibleDuplicate:entries.some(e=>possibleDuplicate(r.proposal,e))||rows.some(e=>e.id!==r.id&&e.proposal.cents===r.proposal.cents&&e.proposal.date===r.proposal.date&&e.proposal.cardId===r.proposal.cardId)});}
   return {connections:own,pending:pending.slice(0,100),hasMore:pending.length>100};
  }
  if(['revoke','discard','complete'].includes(p.action)){
   if(!uuid(p.id))fail('Identificador inválido.');
   if(p.action==='revoke'){await db(connections,'?id=eq.'+p.id+'&user_id=eq.'+user.id,'PATCH',{active:false});return {ok:true};}
   const rows=await db(inbox,'?id=eq.'+p.id+'&user_id=eq.'+user.id);if(!rows.length)fail('Sugestão não encontrada neste usuário.',404);
   if(p.action==='complete'){const data=visibleData(await spaceData(user),user);if(!data.entries?.some(e=>e.id===p.id))fail('Confirme o lançamento primeiro.',409);}
   await db(inbox,'?id=eq.'+p.id+'&user_id=eq.'+user.id+'&status=eq.pending','PATCH',{status:p.action==='complete'?'confirmed':'discarded'});return {ok:true};
  }
  fail('Ação não permitida.');
 };
}
