const deny=()=>{throw Object.assign(Error('Esta conta ou movimentação é particular de outro usuário.'),{status:403})};
export const canSee=(row,user)=>!row?.ownerUserId||row.ownerUserId===user.id;
export const transferAccountDelta=(data,id)=>(data.transfers||[]).reduce((sum,t)=>sum+(t.toAccountId===id?t.cents:0)-(t.fromAccountId===id?t.cents:0),0);
export function privacyCutoff(data,user){return (data.accounts||[]).filter(a=>!canSee(a,user)).reduce((last,a)=>a.privateSince>last?a.privateSince:last,'');}
export function visibleData(data,user){
 const next=structuredClone(data),accounts=new Set((data.accounts||[]).filter(a=>canSee(a,user)).map(a=>a.id)),investments=new Set((data.investments||[]).filter(i=>canSee(i,user)).map(i=>i.id));
 next.accounts=(data.accounts||[]).filter(a=>canSee(a,user));
 next.entries=(data.entries||[]).filter(e=>!e.accountId||accounts.has(e.accountId));
 if(data.investments)next.investments=data.investments.filter(i=>canSee(i,user));
 if(data.investmentMovements)next.investmentMovements=data.investmentMovements.filter(m=>investments.has(m.investmentId)&&(!m.accountId||accounts.has(m.accountId)));
 if(data.transfers)next.transfers=data.transfers.filter(t=>accounts.has(t.fromAccountId)||accounts.has(t.toAccountId));
 if(data.budgetAlerts)next.budgetAlerts=data.budgetAlerts.filter(a=>a.ownerUserId?a.ownerUserId===user.id:!(data.accounts||[]).some(a=>a.ownerUserId));
 if((data.accounts||[]).some(a=>a.ownerUserId)||data.transfers)next.transferTargets=(data.accounts||[]).filter(a=>!a.deleted).map(a=>({id:a.id,name:a.name,ownerName:a.ownerName||null,private:!!a.ownerUserId}));
 return next;
}
export function guardPrivacy(data,p,user){
 const account=id=>{const row=(data.accounts||[]).find(a=>a.id===id);if(row&&!canSee(row,user))deny();return row;};
 if(p.action==='account'){
  const row=account(p.id);if(p.visibility!==undefined&&!['shared','private'].includes(p.visibility))throw Error('Escolha uma conta compartilhada ou particular.');
  if(row&&p.visibility!==undefined&&(p.visibility==='private')!==!!row.ownerUserId){
   if(!row.ownerUserId&&(row.createdById?row.createdById!==user.id:!user.isOwner))deny();
   if((data.entries||[]).some(e=>e.accountId===row.id&&e.cardId)||(data.investmentMovements||[]).some(m=>m.accountId===row.id))throw Error('Esta conta já tem pagamentos de faturas ou aplicações compartilhadas. Mantenha-a compartilhada e cadastre uma nova conta particular para preservar esse histórico.');
  }
 }
 if(p.action==='entry'){
  const e=(data.entries||[]).find(e=>e.id===p.id);if(e?.accountId)account(e.accountId);
  if(p.entry?.accountId)account(p.entry.accountId);
 }
 if(['deleteEntry','restoreEntry','settleEntry'].includes(p.action)){const e=(data.entries||[]).find(e=>e.id===p.id);if(e?.accountId)account(e.accountId);if(p.accountId)account(p.accountId);}
 if(p.action.startsWith('invoice')){const b=(data.invoices||[]).find(b=>b.id===p.id);if(b?.accountId)account(b.accountId);if(p.accountId&&account(p.accountId)?.ownerUserId)throw Error('Para pagar uma fatura compartilhada, use uma conta compartilhada. Você pode transferir da sua conta particular para a conta da casa.');}
 if(p.action.startsWith('investment')){
  const i=(data.investments||[]).find(i=>i.id===(p.investmentId||p.id));if(i&&!canSee(i,user))deny();if(p.action==='investmentCreate'&&i&&p.visibility!==undefined&&(p.visibility==='private')!==!!i.ownerUserId)throw Object.assign(Error('Esta aplicação já foi cadastrada com outra privacidade.'),{status:409});
  const m=(data.investmentMovements||[]).find(m=>m.id===p.id);if(m){const previous=(data.investments||[]).find(i=>i.id===m.investmentId);if(previous&&!canSee(previous,user))deny();}
  if(p.accountId){const a=account(p.accountId);if(a&&i&&(a.ownerUserId||null)!==(i.ownerUserId||null))throw Error('Use uma conta e uma aplicação com a mesma privacidade: ambas particulares suas ou ambas compartilhadas.');}
  if(p.visibility!==undefined&&!['shared','private'].includes(p.visibility))throw Error('Confira a privacidade da aplicação.');
 }
 if(p.action==='budgetResponse'){const a=(data.budgetAlerts||[]).find(a=>a.id===p.id);if(a?.ownerUserId&&a.ownerUserId!==user.id)deny();if(a&&!a.ownerUserId&&(data.accounts||[]).some(a=>a.ownerUserId))deny();}
}
export function stampPrivacy(next,previous,p,user,stamp){
 const key=p.action==='account'?'accounts':p.action==='investmentCreate'?'investments':null;
 if(!key)return next;
 const row=next[key]?.find(a=>a.id===p.id),old=previous[key]?.find(a=>a.id===p.id);if(!row)return next;
 if(!old)row.createdById=user.id;
 if(p.visibility==='private'&&!old?.ownerUserId){row.ownerUserId=user.id;row.ownerName=user.name;row.privateSince=stamp;}
 if(p.visibility==='shared'&&old?.ownerUserId){delete row.ownerUserId;delete row.ownerName;delete row.privateSince;}
 return next;
}
export function mutateTransfer(state,p,user,stamp){
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 if(!uuid(p.id)||!Number.isSafeInteger(p.cents)||p.cents<=0||p.cents>100000000000||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||isNaN(Date.parse(p.date+'T12:00:00Z'))||new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)!==p.date)throw Error('Confira o valor e a data da transferência.');
 const source=state.accounts.find(a=>a.id===p.fromAccountId&&!a.deleted),target=state.accounts.find(a=>a.id===p.toAccountId&&!a.deleted);
 if(!source||!target||source.id===target.id)throw Error('Escolha duas contas diferentes deste financeiro.');
 if(!canSee(source,user))deny();
 const old=(state.transfers||[]).find(t=>t.id===p.id);
 if(old){if(old.createdById===user.id&&old.fromAccountId===source.id&&old.toAccountId===target.id&&old.cents===p.cents&&old.date===p.date)return state;throw Object.assign(Error('Esta transferência já foi confirmada. Atualize a lista.'),{status:409});}
 const data=structuredClone(state);data.transfers||=[];data.transfers.push({id:p.id,fromAccountId:source.id,toAccountId:target.id,fromName:source.name,toName:target.name,cents:p.cents,date:p.date,createdById:user.id,createdBy:user.name,createdAt:stamp});return data;
}
