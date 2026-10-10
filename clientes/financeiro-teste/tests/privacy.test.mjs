import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mutate,summarize} from '../ledger.js';
import {visibleData,privacyCutoff} from '../privacy.js';
import {assertPermission,readPermissions} from '../permissions.js';
import {accountBalanceReply} from '../account-query.js';
import {ChatSync} from '../chat-sync.js';
import {createTransfersUI,transferIntent} from '../transfers-ui.js';
const a={id:crypto.randomUUID(),name:'Luciano',isOwner:true},b={id:crypto.randomUUID(),name:'Yasmin'},stamp='2026-10-10T21:00:00.000Z',date='2026-10-10';
const empty=()=>({accounts:[],entries:[],cards:[],invoices:[],budgets:[],budgetAlerts:[],budgetSettings:{enabled:true,version:1}});
function setup(){let data=empty();const ids={a:crypto.randomUUID(),b:crypto.randomUUID(),house:crypto.randomUUID()};for(const [key,user,name,cents] of [['a',a,'Sicredi',10000],['b',b,'Apressol',20000],['house',a,'Casa',5000]])data=mutate(data,{action:'account',id:ids[key],name,openingCents:cents,visibility:key==='house'?'shared':'private'},user,stamp);return {data,ids};}
const transfer=(data,from,to,user,cents=1000,id=crypto.randomUUID())=>mutate(data,{action:'transfer',id,fromAccountId:from,toAccountId:to,cents,date},user,stamp);
test('private accounts and expenses are omitted from state; family destinations contain no financial values',()=>{
 const {data,ids}=setup();data.entries.push({id:crypto.randomUUID(),accountId:ids.b,cents:1234,kind:'expense',description:'Segredo da Yasmin',status:'paid',paidDate:date,date});
 const view=visibleData(data,a);assert.deepEqual(view.accounts.map(x=>x.id),[ids.a,ids.house]);assert.equal(view.entries.length,0);assert.equal(summarize(view,'2026-10').balance,15000);
 assert.deepEqual(Object.keys(view.transferTargets.find(x=>x.id===ids.b)).sort(),['id','name','ownerName','private']);
 assert.equal(JSON.stringify(view).includes('Segredo da Yasmin'),false);assert.equal(JSON.stringify(view).includes('20000'),false);assert.equal(privacyCutoff(data,a),stamp);
 assert.match(accountBalanceReply('quanto tenho na conta Sicredi',view,date).text,/100,00/);
 assert.equal(accountBalanceReply('quanto tenho na conta Apressol',view,date).awaitingChoice,true);
});
test('two-way private transfers update exactly both balances and never income or expenses',()=>{
 const {data,ids}=setup(),one=transfer(data,ids.b,ids.a,b,3000),two=transfer(one,ids.a,ids.b,a,1000);
 const av=visibleData(two,a),bv=visibleData(two,b),as=summarize(av,'2026-10'),bs=summarize(bv,'2026-10');
 assert.equal(as.accounts.find(x=>x.id===ids.a).balance,12000);assert.equal(bs.accounts.find(x=>x.id===ids.b).balance,18000);
 assert.equal(as.expense+as.income+bs.expense+bs.income,0);assert.equal(two.entries.length,0);assert.equal(av.transfers.length,2);assert.equal(bv.transfers.length,2);
 assert.match(accountBalanceReply('saldo da conta Sicredi',av,date).text,/120,00/);assert.equal(data.accounts[0].openingCents,10000);
});
test('source authorization, tenant targets, invalid dates, self-transfers and duplicate confirmations',()=>{
 const {data,ids}=setup(),id=crypto.randomUUID();assert.throws(()=>transfer(data,ids.b,ids.a,a),e=>e.status===403);
 assert.throws(()=>transfer(data,ids.a,crypto.randomUUID(),a));assert.throws(()=>transfer(data,ids.a,ids.a,a));assert.throws(()=>transfer(data,ids.a,ids.b,a,0));
 const p={action:'transfer',id,fromAccountId:ids.a,toAccountId:ids.b,cents:1000,date};const first=mutate(data,p,a,stamp);assert.deepEqual(mutate(first,p,a,stamp),first);
 assert.throws(()=>mutate(first,{...p,cents:2000},a,stamp),e=>e.status===409);assert.throws(()=>mutate(data,{...p,date:'2026-02-30'},a,stamp));assert.throws(()=>assertPermission({...b,permissions:readPermissions()},'transfer'),e=>e.status===403);
});
test('private accounts and entries cannot be edited, deleted, restored or settled by the other user',()=>{
 const {data,ids}=setup(),id=crypto.randomUUID();const s=mutate(data,{action:'entry',id,createOnly:true,entry:{kind:'expense',cents:1000,description:'Privada',category:'Outros',accountId:ids.b,date,dueDate:date,status:'pending',scope:'casal'}},b,stamp);
 const snapshot=structuredClone(s);for(const action of ['deleteEntry','restoreEntry','settleEntry'])assert.throws(()=>mutate(s,{action,id,version:1,paidDate:date},a,stamp),e=>e.status===403);
 assert.throws(()=>mutate(s,{action:'account',id:ids.b,name:'Roubar',version:1,openingCents:1,visibility:'shared'},a,stamp),e=>e.status===403);
 assert.throws(()=>mutate(s,{action:'entry',id:crypto.randomUUID(),createOnly:true,entry:{...s.entries[0],accountId:ids.b}},a,stamp),e=>e.status===403);assert.deepEqual(s,snapshot);
});
test('existing accounts remain shared; only explicit self-owned conversion changes visibility without dropping entries',()=>{
 const {data,ids}=setup();data.accounts[2].createdById=a.id;
 assert.throws(()=>mutate(data,{action:'account',id:ids.house,name:'Casa',openingCents:5000,version:1,visibility:'private'},b,stamp),e=>e.status===403);
 const result=mutate(data,{action:'account',id:ids.house,name:'Casa',openingCents:5000,version:1,visibility:'private'},a,stamp);assert.equal(result.accounts[2].ownerUserId,a.id);assert.equal(result.accounts.length,3);assert.equal(result.accounts[2].openingCents,5000);
 const legacy={...empty(),accounts:[{id:crypto.randomUUID(),name:'Legada',openingCents:1200}]};assert.deepEqual(visibleData(legacy,b),legacy);
});
test('private investments and their histories remain private and cannot bridge into shared or other-user accounts',()=>{
 const {data,ids}=setup(),id=crypto.randomUUID();let s=mutate(data,{action:'investmentCreate',id,name:'Caixinha',visibility:'private',cents:0,date},b,stamp);
 s=mutate(s,{action:'investmentDeposit',id:crypto.randomUUID(),investmentId:id,accountId:ids.b,cents:1000,version:1,date},b,stamp);
 assert.equal(visibleData(s,a).investments.length,0);assert.equal(visibleData(s,a).investmentMovements.length,0);assert.equal(summarize(visibleData(s,b),'2026-10').accounts.find(x=>x.id===ids.b).balance,19000);
 for(const action of ['investmentBalance','investmentWithdraw','investmentDeposit'])assert.throws(()=>mutate(s,{action,id:crypto.randomUUID(),investmentId:id,accountId:ids.house,cents:100,version:2,date},a,stamp),e=>e.status===403);
 assert.throws(()=>mutate(s,{action:'investmentWithdraw',id:crypto.randomUUID(),investmentId:id,accountId:ids.house,cents:100,version:2,date},b,stamp));
});
test('shared invoices cannot expose private account balances through payments or later conversion',()=>{
 const {data,ids}=setup(),card=crypto.randomUUID();const s=mutate(data,{action:'card',id:card,name:'Cartão casa',closingDay:10,dueDay:20},a,stamp);const bill=s.invoices[0];bill.status='closed';bill.closedTotal=0;
 assert.throws(()=>mutate(s,{action:'invoicePay',id:bill.id,version:bill.version,accountId:ids.a,paidDate:date,confirmedCents:0},a,stamp));
 s.entries.push({id:crypto.randomUUID(),accountId:ids.house,cardId:card,cents:1000});assert.throws(()=>mutate(s,{action:'account',id:ids.house,name:'Casa',openingCents:5000,version:1,visibility:'private'},a,stamp));
});
test('private budget alerts and reasons never disclose spending to the spouse',()=>{
 const {data,ids}=setup();data.budgets=[{id:crypto.randomUUID(),category:'Outros',month:'2026-10',limitCents:100,version:1}];
 const s=mutate(data,{action:'entry',id:crypto.randomUUID(),createOnly:true,entry:{kind:'expense',cents:999,description:'Segredo',category:'Outros',accountId:ids.b,date,status:'paid',scope:'casal'}},b,stamp);
 assert.equal(s.budgetAlerts.at(-1).ownerUserId,b.id);assert.equal(visibleData(s,a).budgetAlerts.length,0);
 assert.throws(()=>mutate(s,{action:'budgetResponse',id:s.budgetAlerts.at(-1).id,version:0,response:'skip'},a,stamp),e=>e.status===403);
});
test('previous cached chat summaries are masked on privacy change without deleting server conversation',async()=>{
 const msg={id:crypto.randomUUID(),role:'bot',text:'Saldo compartilhado antigo: R$ 200,00',time:'2026-10-09T10:00:00.000Z'},storage=new Map();const key='lt_pf_teste_chat_v2_'+a.id;storage.set(key,JSON.stringify({messages:[msg],pending:[]}));
 const sync=new ChatSync(a.id,{redactBefore:stamp,storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},request:async()=>({messages:[],hasOlder:false,redactBefore:stamp})});await sync.initialize();assert.equal(sync.messages.length,1);assert.equal(sync.messages[0].text.includes('200,00'),false);assert.equal(msg.text.includes('200,00'),true);
});
test('chat recognizes transfers before expense parsing; confirmation performs a single idempotent transfer',async()=>{
 const {data,ids}=setup();let view=visibleData(data,a),calls=[],messages=[];
 const ui=createTransfersUI({getState:()=>view,can:()=>true,request:async p=>{calls.push(p);return {data:visibleData(mutate(data,p,a,stamp),a)};},update:d=>view=d,render:()=>{},say:t=>messages.push(t),money:n=>'R$ '+n/100,today:()=>date,escape:String});
 for(const text of ['transferi','transferência','estou transferindo','transfiro'])assert.equal(transferIntent(text),true);assert.equal(transferIntent('quero transformar em gasto'),false);
 assert.equal(await ui.handle('Transferi 30,00 da conta Sicredi para a conta Apressol'),true);assert.equal(calls.length,0);assert.match(messages.at(-1),/Confirmar transferência/);
 await ui.handle('confirmar');assert.equal(calls.length,1);assert.equal(calls[0].action,'transfer');assert.equal(calls[0].fromAccountId,ids.a);assert.equal(calls[0].toAccountId,ids.b);assert.equal(calls[0].cents,3000);assert.equal(view.entries.length,0);assert.equal(summarize(view,'2026-10').accounts.find(x=>x.id===ids.a).balance,7000);
 assert.equal(await ui.handle('quanto transferi este mês'),true);assert.match(messages.at(-1),/Sicredi → Apressol/);assert.equal(calls.length,1);assert.equal(await ui.handle('gastei 10 com mercado'),false);
});
test('incomplete transfer conversation asks amount, own source and destination instead of creating expense',async()=>{
 const {data}=setup(),messages=[];let count=0;
 const ui=createTransfersUI({getState:()=>visibleData(data,a),can:()=>true,request:async()=>{count++;return {data};},update:()=>{},render:()=>{},say:t=>messages.push(t),money:String,today:()=>date,escape:String});
 await ui.handle('estou transferindo de uma conta minha para outra');assert.match(messages.at(-1),/Qual valor/);await ui.handle('10,00');assert.match(messages.at(-1),/De qual conta/);await ui.handle('Sicredi');assert.match(messages.at(-1),/Para qual conta/);await ui.handle('Apressol');assert.match(messages.at(-1),/Confirmar transferência/);await ui.handle('cancelar');assert.equal(count,0);
});
