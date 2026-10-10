import {validDate} from './ledger.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
export const brazilDate=stamp=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(stamp));
export function monthShift(month,n){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7)}
export function monthDay(month,day){const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();return month+'-'+String(Math.min(day,last)).padStart(2,'0')}
export function invoiceDates(card,cycle){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle))fail('Confira o mês da fatura.');return {closeDate:monthDay(cycle,card.closingDay),dueDate:monthDay(monthShift(cycle,card.dueDay>card.closingDay?0:1),card.dueDay)}}
export const invoiceId=(cardId,cycle)=>cardId+'_'+cycle;
export function purchaseCycle(date,card,invoices=[]){let cycle=date.slice(0,7),close=monthDay(cycle,card.closingDay);if(date>close)cycle=monthShift(cycle,1);const bill=invoices.find(b=>b.id===invoiceId(card.id,cycle));if(bill&&bill.status!=='open'&&date>=(bill.closedAt?([bill.closeDate,brazilDate(bill.closedAt)].sort()[0]):bill.closeDate))cycle=monthShift(cycle,1);return cycle}
export function invoiceItems(data,id){return data.entries.filter(e=>!e.deleted&&e.cardId&&e.invoiceId===id)}
export const invoiceTotal=(data,id)=>invoiceItems(data,id).reduce((v,e)=>v+e.cents,0);
export function ensureInvoice(data,card,cycle,stamp){data.invoices||=[];const id=invoiceId(card.id,cycle);let bill=data.invoices.find(b=>b.id===id);if(!bill){bill={id,cardId:card.id,cycle,...invoiceDates(card,cycle),status:'open',version:1,createdAt:stamp,bankCents:null};data.invoices.push(bill)}return bill}
export function creditFields(p,data){const card=(data.cards||[]).find(c=>c.id===p.cardId);if(!card)fail('Escolha um cartão deste financeiro.');if(p.kind!=='expense')fail('No cartão de crédito, registre uma despesa.');let cycle=p.invoiceId?.slice(card.id.length+1)||purchaseCycle(p.date,card,data.invoices);if(p.invoiceId&&p.invoiceId!==invoiceId(card.id,cycle))fail('Esta fatura não pertence ao cartão escolhido.');const dates=(data.invoices||[]).find(b=>b.id===invoiceId(card.id,cycle))||invoiceDates(card,cycle);return {cardId:card.id,invoiceId:invoiceId(card.id,cycle),accountId:null,status:'pending',paidDate:null,dueDate:dates.dueDate}}
export function unlockedInvoice(data,id){const bill=data.invoices?.find(b=>b.id===id);if(bill&&bill.status!=='open')fail(bill.status==='paid'?'Esta fatura já foi paga. Desfaça o pagamento antes de alterar suas compras.':'Esta fatura está fechada. Reabra para corrigir uma compra.',409)}
export function mutateCredit(data,p,user,stamp){data.cards||=[];data.invoices||=[];const today=brazilDate(stamp),uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
 if(p.action==='card'){
  if(!uuid(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Number.isInteger(p.closingDay)||p.closingDay<1||p.closingDay>31||!Number.isInteger(p.dueDay)||p.dueDay<1||p.dueDay>31)fail('Confira o nome e os dias de fechamento e vencimento.');
  if(p.limitCents!==undefined&&p.limitCents!==null&&(!Number.isSafeInteger(p.limitCents)||p.limitCents<0||p.limitCents>100000000000))fail('Informe um limite válido em reais.');
  if(data.cards.some(c=>c.id!==p.id&&c.name.trim().toLowerCase()===p.name.trim().toLowerCase()))fail('Já existe um cartão com esse nome.');const card=data.cards.find(c=>c.id===p.id);
  if(card){if(card.version!==p.version)fail('Este cartão mudou em outro aparelho. Atualize antes de editar.',409);Object.assign(card,{name:p.name.trim(),closingDay:p.closingDay,dueDay:p.dueDay,...(p.limitCents!==undefined?{limitCents:p.limitCents}:{}),version:card.version+1,updatedBy:user.name,updatedAt:stamp})}
  else data.cards.push({id:p.id,name:p.name.trim(),closingDay:p.closingDay,dueDay:p.dueDay,limitCents:p.limitCents??null,version:1,createdBy:user.name,createdAt:stamp});
  const c=data.cards.find(c=>c.id===p.id);ensureInvoice(data,c,purchaseCycle(today,c,data.invoices),stamp);return data;
 }
 if(p.action==='ensureInvoices'){for(const c of data.cards)ensureInvoice(data,c,purchaseCycle(today,c,data.invoices),stamp);return data}
 const bill=data.invoices.find(b=>b.id===p.id);if(!bill)fail('Fatura não encontrada neste financeiro.',404);
 if(p.version!==bill.version)fail('A fatura mudou em outro aparelho. Confira o total atualizado.',409);
 const total=invoiceTotal(data,bill.id),items=invoiceItems(data,bill.id);
 if(p.action==='invoiceCheck'){
  if(bill.status!=='open')fail('Reabra a fatura antes de conferir.');if(!Number.isSafeInteger(p.bankCents)||p.bankCents<0||p.bankCents>100000000000)fail('Informe o total que aparece na fatura do banco.');bill.bankCents=p.bankCents;
 }else if(p.action==='invoiceClose'){
  if(bill.status!=='open')fail('Esta fatura já foi fechada.');if(p.confirmedCents!==total)fail('O total mudou. Confira as compras antes de fechar.',409);if(bill.bankCents!==null&&bill.bankCents!==undefined&&bill.bankCents!==total)fail('Ainda existe uma diferença com a fatura do banco. Confira as compras antes de fechar.');Object.assign(bill,{status:total===0?'paid':'closed',...(total===0?{paidDate:today,accountId:null,paidBy:user.name,paidAt:stamp}:{}),remindAfter:null,closedTotal:total,closedAt:stamp,closedBy:user.name,bankCents:total});
 }else if(p.action==='invoicePay'){
  if(bill.status!=='closed')fail('Primeiro confira e feche a fatura.');if(p.confirmedCents!==total||bill.closedTotal!==total)fail('Confira o total da fatura antes de pagar.',409);if(!data.accounts.some(a=>a.id===p.accountId&&!a.deleted))fail('Escolha a conta deste financeiro que pagou a fatura.');if(!validDate(p.paidDate))fail('Informe a data do pagamento.');
  Object.assign(bill,{status:'paid',paidDate:p.paidDate,accountId:p.accountId,paidBy:user.name,paidAt:stamp});for(const e of items)Object.assign(e,{status:'paid',accountId:p.accountId,paidDate:p.paidDate,version:e.version+1,updatedAt:stamp,updatedBy:user.name});
 }else if(p.action==='invoiceReopen'){
  if(bill.status!=='closed')fail('Só uma fatura fechada e ainda não paga pode ser reaberta.');bill.status='open';bill.closedTotal=null;bill.bankCents=null;
 }else if(p.action==='invoiceUndoPay'){
  if(bill.status!=='paid')fail('Esta fatura não está paga.');bill.status='closed';bill.previousPayment={accountId:bill.accountId,paidDate:bill.paidDate,undoneAt:stamp,undoneBy:user.name};bill.accountId=null;bill.paidDate=null;for(const e of items)Object.assign(e,{status:'pending',accountId:null,paidDate:null,version:e.version+1,updatedAt:stamp,updatedBy:user.name});
 }else if(p.action==='invoiceSnooze'){
  if(!validDate(p.remindAfter)||p.remindAfter<=today)fail('Escolha uma data futura para lembrar.');bill.remindAfter=p.remindAfter;
 }else fail('Ação da fatura não reconhecida.');
 bill.version++;bill.updatedBy=user.name;bill.updatedAt=stamp;return data;
}

export function cardLimit(data,card){const used=data.entries.filter(e=>!e.deleted&&e.cardId===card.id&&e.status!=='paid').reduce((total,e)=>total+e.cents,0);return {limit:card.limitCents??null,used,available:card.limitCents===null||card.limitCents===undefined?null:card.limitCents-used}}

