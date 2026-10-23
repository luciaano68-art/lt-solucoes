import {normalize} from './conversation.js';
import {receiptDate,receiptMoney,receiptDuplicates} from './receipt-reader.js';
import {validateReceiptData} from './receipt-data.js';
import {purchaseCycle,invoiceId,invoiceDates,monthShift} from './credit.js';
export function receiptPaymentOptions(data){
 return [...(data.accounts||[]).filter(a=>!a.deleted).map(a=>({value:'account:'+a.id,label:a.name,credit:false})),...(data.cards||[]).filter(c=>!c.deleted).map(c=>({value:'card:'+c.id,label:c.name,credit:true}))];
}
export function suggestedReceiptPayment(note,data){
 const options=receiptPaymentOptions(data),method=normalize(note.paymentMethod);
 if(note.cardLast4&&/credito/.test(method)){
  const matches=options.filter(o=>o.credit&&(data.cards||[]).find(c=>o.value==='card:'+c.id&&(String(c.last4||'')===note.cardLast4||new RegExp('(?:^|\\D)'+note.cardLast4+'(?:\\D|$)').test(c.name))));
  if(matches.length===1)return {value:matches[0].value,reason:'Final '+note.cardLast4+' reconhecido'};
  // A conflicting printed card ending must never fall back to a different card.
  return {value:'',reason:''};
 }
 const relevant=options.filter(o=>/credito/.test(method)?o.credit:/pix|debito|dinheiro/.test(method)?!o.credit:false);
 return relevant.length===1?{value:relevant[0].value,reason:'Única opção cadastrada para '+note.paymentMethod.toLowerCase()}:{value:'',reason:''};
}
export function receiptPurchase(note,fields,data,id){
 const cents=receiptMoney(fields.total),date=fields.date,merchant=String(fields.merchant||'').trim(),count=Number(fields.count||1);
 if(!cents||cents<0)throw Error('Qual foi o valor total da compra?');
 if(!merchant||merchant.length>300)throw Error('Informe o nome do estabelecimento.');
 if(!receiptDate(date))throw Error('Qual foi a data da compra?');
 const source=receiptPaymentOptions(data).find(o=>o.value===fields.payment);
 if(!source)throw Error('Toque na conta ou no cartão usado.');
 if(!Number.isInteger(count)||count<1||count>60||count>cents)throw Error('Confira a quantidade de parcelas (de 1 a 60).');
 if(count>1&&!source.credit)throw Error('Escolha um cartão de crédito para registrar as parcelas.');
 const receiptData=validateReceiptData({...note,merchant,date,totalCents:cents,installments:count});
 const duplicates=receiptDuplicates(data,receiptData).filter(e=>e.id!==id&&e.installmentPurchaseId!==id);
 if(duplicates.some(e=>e.receiptData?.imageHash===note.imageHash))throw Error('Esta foto já foi lançada. Confira os lançamentos.');
 if(duplicates.length&&!fields.duplicateAck)throw Error('Já existe uma compra parecida. Confira o aviso antes de confirmar.');
 const status=source.credit||fields.unpaid?'pending':'paid',sourceId=source.value.slice(source.value.indexOf(':')+1);
 const entry={kind:'expense',cents,description:merchant,date,dueDate:date,status,paidDate:status==='paid'?date:null,category:fields.category||note.category||'Outros',scope:fields.scope||'casal',accountId:source.credit?null:sourceId,receiptData};
 let rows=[];
 if(source.credit){
  const card=data.cards.find(c=>c.id===sourceId),cycle=purchaseCycle(date,card,data.invoices||[]),base=Math.floor(cents/count),extra=cents%count;
  Object.assign(entry,{cardId:card.id,invoiceId:invoiceId(card.id,cycle),dueDate:invoiceDates(card,cycle).dueDate});
  rows=Array.from({length:count},(_,i)=>({number:i+1,cents:base+(i<extra?1:0),dueDate:invoiceDates(card,monthShift(cycle,i)).dueDate}));
 }
 const request=count>1?{action:'installmentPurchase',id,cardId:sourceId,cents,count,date,description:merchant,category:entry.category,scope:entry.scope,receiptData,firstInvoiceId:entry.invoiceId}:{action:'entry',id,createOnly:true,entry};
 return {request,entry,source,rows};
}
