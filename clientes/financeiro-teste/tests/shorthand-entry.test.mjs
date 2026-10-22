import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {messageAmount,parseMessage,normalize,moneyCents} from '../conversation.js';
import {purchaseCycle,invoiceId,invoiceDates} from '../credit.js';
import {mutate} from '../ledger.js';
const card={id:crypto.randomUUID(),name:'Sicredi Luciano · final 8111',closingDay:29,dueDay:13},today='2026-10-22';
const examples=[['27,96 em combustível para biz 20/10 cartão de crédito Sicredi',2796,'Combustível'],['35,00 no cabeleireiro dia 20/10 cartão de crédito sicredi',3500,'Outros']];
test('both screenshot phrases extract amount, purchase date and unique card without a spending verb',()=>{
 for(const [text,cents,category] of examples){const p=parseMessage(text,[],today,[card]);assert.equal(p.cents,cents);assert.equal(p.date,'2026-10-20');assert.equal(p.cardId,card.id);assert.equal(p.kind,'expense');assert.equal(p.status,'pending');assert.equal(p.category,category);}
});
test('leading BRL values, integers, currency and date-first shorthand retain cents',()=>{
 for(const [text,cents] of [['1.234,56 em roupas',123456],['35 no cabeleireiro',3500],['27.96 no posto',2796],['20/10 27,96 em combustível',2796],['R$ 27,96 em combustível dia 20/10',2796],['paguei 35,00 no cabeleireiro',3500],['valor de 35,00 dia 20/10',3500]])assert.equal(messageAmount(text),cents,text);
});
test('dates, installment counts and card endings alone are not purchase values',()=>{
 for(const text of ['20/10 cartão Sicredi','20/10/2026','2026-10-20','cartão final 8111','5 vezes','5x','5 parcelas','Sicredi','qual o valor da fatura'])assert.equal(messageAmount(text),null,text);
});
test('existing installment total, income and invalid-date validation are preserved',()=>{
 assert.equal(parseMessage('comprei 1.000,00 de roupas em 5 vezes',[],today,[card]).cents,100000);
 const p=parseMessage('recebi 200,00 de salário dia 20/10',[],today);assert.equal(p.kind,'income');assert.equal(p.cents,20000);
 assert.equal(parseMessage('27,96 combustível 31/02 cartão Sicredi',[],today,[card]).invalidDate,true);
});
test('two Sicredi cards still require a choice without discarding the parsed value or date',()=>{
 const p=parseMessage(examples[0][0],[],today,[card,{...card,id:crypto.randomUUID(),name:'Sicredi Yasmin · final 1234'}]);assert.equal(p.cardId,undefined);assert.equal(p.cents,2796);assert.equal(p.date,'2026-10-20');
});
test('actual chat handler reaches review immediately for both screenshots and never asks value twice',async()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('async function processChatMessage('),source.indexOf('\nfunction summaryView'));
 for(const [text,cents] of examples){
  const messages=[],context={draft:null,state:{accounts:[],entries:[],cards:[card],invoices:[]},crypto,normalize,moneyCents,parseMessage,purchaseCycle,invoiceId,invoiceDates,today:()=>today,cards:()=>[card],invoices:()=>[],findBill:()=>null,can:()=>true,installmentsUI:{handle:async()=>false},transfersUI:{handle:async()=>false},investmentsUI:{handle:async()=>false},budgetReply:()=>null,invoiceValueReply:()=>null,handleInvoiceCommand:()=>false,descriptionSpendingReply:()=>null,accountBalanceReply:()=>null,monthlySpendingReply:()=>null,cardSpendingReply:()=>null,cardLimitReply:()=>null,handleDueReply:async()=>false,handleCreditReply:async()=>false,replyQuery:()=>null,lastDescriptionSubject:null,accountLookupPending:false,limitLookupPending:false,creditFlow:null,render:()=>{},$:()=>null,formatDate:s=>s,addMessage:(_,m)=>messages.push(m),missingPrompt:()=>{throw Error('Unexpected missing information');}};
  context.draftReady=()=>!!(context.draft?.cents&&context.draft?.cardId&&!context.draft?.invalidDate);
  await vm.runInNewContext(code+';processChatMessage('+JSON.stringify(text)+')',context);
  assert.equal(context.draft.cents,cents);assert.equal(context.draft.date,'2026-10-20');assert.equal(context.draft.dueDate,'2026-11-13');assert.equal(context.draft.description,text);assert.match(messages.at(-1),/Conferir e confirmar/);assert.equal(context.state.entries.length,0);
 }
});
test('confirmed shorthand purchase keeps original date, exact cents and idempotent save',()=>{
 const [description,cents]=examples[0],p=parseMessage(description,[],today,[card]);
 const data={accounts:[],cards:[card],entries:[],invoices:[]},request={action:'entry',id:crypto.randomUUID(),createOnly:true,entry:{...p,description,scope:'casal'}};
 const user={id:crypto.randomUUID(),name:'Luciano',isOwner:true},saved=mutate(data,request,user,'2026-10-22T20:00:00Z');
 assert.equal(saved.entries.length,1);assert.equal(saved.entries[0].cents,cents);assert.equal(saved.entries[0].date,'2026-10-20');assert.equal(saved.entries[0].dueDate,'2026-11-13');assert.equal(mutate(saved,request,user),saved);assert.equal(data.entries.length,0);
});
