import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {budgetReply,budgetSpent,budgetStatus,budgetEntryFeedback,mutateBudget} from '../budget.js';
import {categoryOf} from '../conversation.js';
import {mutate} from '../ledger.js';
import {visibleData} from '../privacy.js';
const today='2026-10-16',user={id:crypto.randomUUID(),name:'Luciano',isOwner:true};
const budget=(category,limitCents=50000,month='2026-10')=>({id:crypto.randomUUID(),category,limitCents,month});
const entry=(more={})=>({id:crypto.randomUUID(),kind:'expense',category:'Transporte',description:'Gasolina',cents:10000,date:today,paidDate:today,status:'paid',...more});
const state=()=>({budgetSettings:{enabled:true},budgets:[budget('Combustível'),budget('Delivery',20000)],entries:[entry(),entry({cardId:'card',status:'pending',category:'Alimentação',description:'iFood',cents:5000})]});
test('recognizes user questions, accents, aliases and general remaining budget',()=>{
 const s=state();
 for(const q of ['quanto eu ainda posso gastar esse mês com combustível?','quanto posso gastar com gasolina ainda?'])assert.match(budgetReply(q,s,today),/Ainda pode gastar R\$\s*400,00/);
 for(const q of ['quanto posso gastar com delivery ainda?','quanto ainda posso gastar no iFood?'])assert.match(budgetReply(q,s,today),/Ainda pode gastar R\$\s*150,00/);
 const all=budgetReply('quanto posso gastar ainda neste mês?',s,today);assert.match(all,/Combustível/);assert.match(all,/Delivery/);
});
test('unknown category asks rather than returns unrelated budgets; bank queries pass through',()=>{
 const s=state();assert.match(budgetReply('quanto posso gastar com presentes ainda?',s,today),/Qual categoria/);
 for(const q of ['qual o limite disponível no cartão','quanto tenho disponível na conta','gastei 40 com delivery','transferi 100','qual meu saldo'])assert.equal(budgetReply(q,s,today),null,q);
});
test('unconfigured and disabled budgets never invent a safe amount',()=>{
 const s=state();s.budgets=[];assert.match(budgetReply('quanto posso gastar com delivery ainda?',s,today),/não há limite planejado/);
 assert.equal(budgetEntryFeedback(s,entry()),null);s.budgetSettings.enabled=false;
 assert.match(budgetReply('quanto posso gastar com delivery ainda?',s,today),/desativado/);assert.equal(budgetEntryFeedback(s,entry()),null);
});
test('delivery and fuel are selectable and recognized before generic purchase or food',()=>{
 for(const text of ['comprei 30 no iFood','paguei 40 em delivery','comida por entrega'])assert.equal(categoryOf(text),'Delivery');
 for(const text of ['abasteci 100','paguei 50 no posto','comprei etanol'])assert.equal(categoryOf(text),'Combustível');
 let s=state();s=mutateBudget(s,{action:'budget',id:crypto.randomUUID(),month:'2026-11',category:'Delivery',limitCents:20000},user,today);assert.equal(s.budgets.at(-1).category,'Delivery');
 assert.equal(budgetSpent(s,{category:'Alimentação',month:'2026-10'}),0);
});
test('pending bank expenses reserve funds once, then become spent when settled',()=>{
 const s=state(),pending=entry({status:'pending',paidDate:null,dueDate:today,cents:2500});s.entries.push(pending);
 assert.deepEqual(budgetStatus(s,s.budgets[0]),{spent:10000,reserved:2500,left:37500});
 assert.match(budgetEntryFeedback(s,pending),/reservado para despesas pendentes R\$\s*25,00/);
 pending.status='paid';pending.paidDate=today;assert.deepEqual(budgetStatus(s,s.budgets[0]),{spent:12500,reserved:0,left:37500});
});
test('near limit, exact limit and excess use cent precision',()=>{
 const s=state(),e=s.entries[0];
 for(const [cents,pattern]of [[40000,/80%/],[50000,/chegou ao limite/],[50001,/Passou do orçamento em R\$\s*0,01/]]){e.cents=cents;assert.match(budgetEntryFeedback(s,e),pattern);}
});
test('transfers, income, deleted expenses, old months and invoice payments cannot consume budget twice',()=>{
 const s=state();s.entries.push(entry({kind:'income'}),entry({kind:'invoicePayment'}),entry({deleted:true}),entry({date:'2026-09-01',paidDate:'2026-09-01'}));s.transfers=[{cents:999999}];
 assert.equal(budgetSpent(s,s.budgets[0]),10000);assert.equal(budgetEntryFeedback(s,s.entries[2]),null);
});
test('queries and feedback respect months including year rollover and never mutate data',()=>{
 const s=state();s.budgets.push(budget('Delivery',12345,'2027-01'));const before=JSON.stringify(s);
 assert.match(budgetReply('quanto posso gastar com delivery próximo mês?',s,'2026-12-16'),/01\/2027[\s\S]*123,45/);
 assert.match(budgetReply('quanto posso gastar com delivery em novembro?',s,today),/outro período/);
 assert.match(budgetReply('quanto posso gastar com delivery mês passado?',s,today),/09\/2026/);
 budgetEntryFeedback(s,s.entries[0]);assert.equal(JSON.stringify(s),before);
});
test('spouse private expenses never affect query or feedback; other financial spaces stay isolated',()=>{
 const s=state(),account=crypto.randomUUID(),other=crypto.randomUUID();s.accounts=[{id:account,ownerUserId:other}];s.entries.push(entry({accountId:account,cents:999999}));
 const view=visibleData(s,user);assert.equal(budgetStatus(view,view.budgets[0]).spent,10000);
 assert.match(budgetReply('quanto posso gastar com combustível?',view,today),/400,00/);
 assert.match(budgetEntryFeedback(view,view.entries[0]),/400,00/);
 assert.match(budgetReply('quanto posso gastar com combustível?',{budgetSettings:{enabled:true},entries:[],budgets:[]},today),/não há limite/);
});
test('server and client budget rules are identical',()=>{
 const source=readFileSync(new URL('../budget.js',import.meta.url),'utf8');
 assert.equal(readFileSync(new URL('../../../supabase/functions/lt-meu-financeiro-teste-api/budget.js',import.meta.url),'utf8'),source);
});
test('saved real expense yields remaining budget without changing bank accounting',()=>{
 const account=crypto.randomUUID(),s={...state(),accounts:[{id:account,name:'Sicredi',openingCents:100000}],entries:[]};
 const e=entry({accountId:account,scope:'casal',cents:5000});const result=mutate(s,{action:'entry',id:e.id,createOnly:true,entry:e},user,today+'T12:00:00Z');
 assert.match(budgetEntryFeedback(result,result.entries[0]),/Ainda pode gastar R\$\s*450,00/);assert.equal(s.entries.length,0);assert.equal(result.entries.length,1);
});

test('no unsolicited budget guidance for an unconfigured category or month',()=>{
 const s=state();
 assert.equal(budgetEntryFeedback(s,entry({category:'Moradia',description:'Aluguel'})),null);
 assert.equal(budgetEntryFeedback(s,entry({date:'2026-11-16',paidDate:'2026-11-16'})),null);
 s.budgets=[];assert.equal(budgetEntryFeedback(s,entry()),null);
 assert.match(budgetReply('quanto ainda posso gastar com combustível?',s,today),/Defina em Orçamentos/);
});
