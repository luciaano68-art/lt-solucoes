import {creditFields,ensureInvoice,unlockedInvoice,mutateCredit} from './credit.js';
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s}
export function validateEntry(p,state){
 if(!p||!['income','expense'].includes(p.kind))throw Error('Escolha entrada ou saída.');
 if(!Number.isSafeInteger(p.cents)||p.cents<=0||p.cents>100000000000)throw Error('Informe um valor válido.');
 if(!validDate(p.date)||!validDate(p.dueDate||p.date))throw Error('Informe uma data válida.');
 if(!['paid','pending'].includes(p.status))throw Error('Informe se foi pago/recebido ou se está pendente.');
 if(!['casal','luciano','yasmin'].includes(p.scope))throw Error('Escolha casal, Luciano ou Yasmin.');
 if(typeof p.description!=='string'||!p.description.trim()||p.description.length>300)throw Error('Informe a descrição (até 300 caracteres).');
 if(typeof p.category!=='string'||!p.category.trim()||p.category.length>80)throw Error('Informe a categoria.');
 if(!p.cardId&&!state.accounts.some(a=>a.id===p.accountId&&!a.deleted))throw Error('Escolha uma conta deste financeiro.');
 if(!p.cardId&&p.status==='paid'&&!validDate(p.paidDate||p.date))throw Error('Informe a data do pagamento.');
 return {kind:p.kind,cents:p.cents,description:p.description.trim(),category:p.category.trim(),accountId:p.accountId,date:p.date,dueDate:p.dueDate||p.date,status:p.status,paidDate:p.status==='paid'?(p.paidDate||p.date):null,scope:p.scope,...(p.cardId?creditFields(p,state):{})};
}
export function summarize(state,month){
 const entries=state.entries.filter(e=>!e.deleted),paid=entries.filter(e=>e.status==='paid');
 const accounts=state.accounts.filter(a=>!a.deleted).map(a=>({...a,balance:a.openingCents+paid.filter(e=>e.accountId===a.id).reduce((v,e)=>v+(e.kind==='income'?e.cents:-e.cents),0)}));
 const period=entries.filter(e=>(e.status==='paid'?e.paidDate:e.dueDate).startsWith(month));
 const sum=(kind,status)=>period.filter(e=>e.kind===kind&&e.status===status).reduce((v,e)=>v+e.cents,0);
 return {balance:accounts.reduce((v,a)=>v+a.balance,0),income:sum('income','paid'),expense:sum('expense','paid'),payable:sum('expense','pending'),receivable:sum('income','pending'),accounts};
}
export function mutate(state,p,user,now){
 const data=structuredClone(state),stamp=now||new Date().toISOString();data.cards||=[];data.invoices||=[];if(p.action==='card'||p.action==='ensureInvoices'||p.action.startsWith('invoice'))return mutateCredit(data,p,user,stamp);
 const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 if(p.action==='account'){
  if(!uuid(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Number.isSafeInteger(p.openingCents)||Math.abs(p.openingCents)>100000000000)throw Error('Confira o nome e o saldo inicial da conta.');
  const existing=data.accounts.find(a=>a.id===p.id);if(existing){if(existing.version!==p.version)throw Object.assign(Error('Esta conta foi alterada em outro aparelho. Atualize antes de editar.'),{status:409});Object.assign(existing,{name:p.name.trim(),openingCents:p.openingCents,version:existing.version+1,updatedBy:user.name,updatedAt:stamp})}
  else{if(data.accounts.some(a=>a.name.toLowerCase()===p.name.trim().toLowerCase()&&!a.deleted))throw Error('Já existe uma conta com esse nome.');data.accounts.push({id:p.id,name:p.name.trim(),openingCents:p.openingCents,version:1,createdBy:user.name,createdAt:stamp})}
 }else if(p.action==='entry'){
  if(!uuid(p.id))throw Error('Identificador inválido.');const existing=data.entries.find(e=>e.id===p.id),fields=validateEntry(existing&&p.createOnly&&p.entry?.cardId&&!p.entry.invoiceId?{...p.entry,invoiceId:existing.invoiceId}:p.entry,data);
  if(existing){if(p.createOnly){if(JSON.stringify(validateEntry(existing,data))!==JSON.stringify(fields))throw Object.assign(Error('Este lançamento já foi confirmado. Atualize a lista.'),{status:409});return state}if(existing.cardId)unlockedInvoice(data,existing.invoiceId);if(fields.cardId)unlockedInvoice(data,fields.invoiceId);if(existing.version!==p.version)throw Object.assign(Error('Este lançamento foi alterado por outra pessoa. Atualize antes de salvar.'),{status:409});if(existing.deleted)throw Error('Restaure o lançamento antes de editar.');if(!fields.cardId){delete existing.cardId;delete existing.invoiceId;}Object.assign(existing,fields,{version:existing.version+1,updatedBy:user.name,updatedAt:stamp})}
  else {if(fields.cardId)unlockedInvoice(data,fields.invoiceId);if(!p.createOnly)throw Object.assign(Error('Lançamento não encontrado.'),{status:404});data.entries.push({...fields,id:p.id,version:1,createdBy:user.name,createdAt:stamp,updatedBy:user.name,updatedAt:stamp,deleted:false})}
 }else if(['deleteEntry','restoreEntry','settleEntry'].includes(p.action)){
  const e=data.entries.find(e=>e.id===p.id);if(!e)throw Object.assign(Error('Lançamento não encontrado neste financeiro.'),{status:404});if(e.cardId){unlockedInvoice(data,e.invoiceId);if(p.action==='settleEntry')throw Error('Registre o pagamento pela fatura do cartão.');}if(e.version!==p.version)throw Object.assign(Error('Este lançamento mudou em outro aparelho. Atualize e tente novamente.'),{status:409});
  if(p.action==='deleteEntry')e.deleted=true;
  if(p.action==='restoreEntry')e.deleted=false;
  if(p.action==='settleEntry'){if(e.deleted)throw Error('Restaure o lançamento primeiro.');if(e.status==='paid')throw Error('Este lançamento já está pago/recebido.');if(!validDate(p.paidDate))throw Error('Confira a data do pagamento.');e.status='paid';e.paidDate=p.paidDate;}
  e.version++;e.updatedBy=user.name;e.updatedAt=stamp;
 }else throw Error('Ação não reconhecida.');
 const old=state.entries.find(e=>e.id===p.id),updated=data.entries.find(e=>e.id===p.id);for(const id of new Set([old?.invoiceId,updated?.invoiceId].filter(Boolean))){let bill=data.invoices.find(b=>b.id===id);if(!bill&&updated?.cardId){const card=data.cards.find(c=>c.id===updated.cardId);bill=ensureInvoice(data,card,id.slice(card.id.length+1),stamp);}if(bill){bill.version++;bill.updatedBy=user.name;bill.updatedAt=stamp;}}
 return data;
}
