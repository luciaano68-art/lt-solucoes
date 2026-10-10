import {mutate,validDate} from './ledger.js';
import {purchaseCycle,monthShift,monthDay,invoiceId,invoiceDates} from './credit.js';
export function installmentPlan(p,state){
 const card=(state.cards||[]).find(c=>c.id===p.cardId);
 if(!card)throw Error('Escolha um cartão deste financeiro.');
 if(!Number.isSafeInteger(p.cents)||p.cents<2||p.cents>100000000000||!Number.isInteger(p.count)||p.count<2||p.count>60||p.cents<p.count)throw Error('Informe o valor total e de 2 a 60 parcelas.');
 if(!validDate(p.date))throw Error('Informe uma data válida para a compra.');
 const cycle=purchaseCycle(p.date,card,state.invoices||[]),base=Math.floor(p.cents/p.count),extra=p.cents%p.count;
 return Array.from({length:p.count},(_,i)=>({cents:base+(i<extra?1:0),date:monthDay(monthShift(p.date.slice(0,7),i),Number(p.date.slice(8))),invoiceId:invoiceId(card.id,monthShift(cycle,i)),dueDate:invoiceDates(card,monthShift(cycle,i)).dueDate}));
}
export function mutateInstallmentPurchase(state,p,user,stamp){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id||''))throw Error('Identificador inválido.');
 const signature=JSON.stringify([p.cardId,p.cents,p.count,p.date,p.description,p.category,p.scope]);
 const known=state.entries.filter(e=>e.installmentPurchaseId===p.id);
 if(known.length){if(known.length!==p.count||known.some(e=>e.installmentSignature!==signature))throw Object.assign(Error('Esta compra já foi confirmada com outros dados.'),{status:409});return state;}
 const plan=installmentPlan(p,state);
 if(p.firstInvoiceId!==plan[0].invoiceId)throw Object.assign(Error('A primeira fatura mudou. Confira o parcelamento novamente.'),{status:409});
 let next=state;
 for(let i=0;i<plan.length;i++){
  const id=p.id.slice(0,30)+(i+1).toString(16).padStart(6,'0');
  if(state.entries.some(e=>e.id===id))throw Object.assign(Error('Identificador já utilizado. Tente novamente.'),{status:409});
  next=mutate(next,{action:'entry',id,createOnly:true,entry:{...plan[i],kind:'expense',cardId:p.cardId,description:p.description,category:p.category,scope:p.scope,status:'pending',accountId:null}},user,stamp);
  Object.assign(next.entries.find(e=>e.id===id),{installmentPurchaseId:p.id,installmentSignature:signature,installmentNumber:i+1,installmentTotal:p.count,originalPurchaseDate:p.date});
 }
 return next;
}
