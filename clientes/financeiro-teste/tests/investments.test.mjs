import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mutate,summarize} from '../ledger.js';
import {investmentEstimate} from '../investments.js';
import {assertPermission} from '../permissions.js';
import {investmentIntent,namedChoice} from '../investment-chat.js';
import {createInvestmentsUI} from '../investments-ui.js';
import {accountBalanceReply} from '../account-query.js';
const account=crypto.randomUUID(),investment=crypto.randomUUID(),user={id:'owner',name:'Owner',isOwner:true},date='2026-10-10';
const initial=()=>({accounts:[{id:account,name:'Sicredi',openingCents:5000,version:1}],entries:[],cards:[],invoices:[]});
const run=(s,p)=>mutate(s,{id:crypto.randomUUID(),date,...p},user,date+'T12:00:00Z');
const created=balance=>run(initial(),{action:'investmentCreate',id:investment,name:'Caixinha Nubank',cents:balance});
const move=(s,action,cents,fields={})=>run(s,{action,investmentId:investment,version:s.investments[0].version,cents,...(action==='investmentBalance'?{}:{accountId:account}),...fields});
test('aportes e resgates alteram contas e aplicação sem aumentar receitas, despesas ou entradas',()=>{
 const base=initial(),s=created(0),d=move(s,'investmentDeposit',1000),w=move(d,'investmentWithdraw',400);
 assert.equal(d.investments[0].balanceCents,1000);assert.equal(summarize(d,'2026-10').balance,4000);
 assert.equal(w.investments[0].balanceCents,600);assert.equal(summarize(w,'2026-10').balance,4400);
 assert.equal(summarize(w,'2026-10').income,0);assert.equal(summarize(w,'2026-10').expense,0);assert.deepEqual(w.entries,[]);assert.deepEqual(initial(),base);
 assert.match(accountBalanceReply('quanto tenho na conta Sicredi',w,date).text,/44,00/);
});
test('saldo inicial apenas registra patrimônio e rendimento de 10 para 12 é 20%',()=>{
 const s=created(1000);assert.equal(summarize(s,'2026-10').balance,5000);
 assert.deepEqual(investmentEstimate(s.investments[0],1200),{gainCents:200,percent:20,from:date});
 const next=move(s,'investmentBalance',1200);assert.equal(next.investmentMovements[0].estimate.percent,20);assert.equal(summarize(next,'2026-10').balance,5000);
});
test('aportes não viram rendimento; resgates não viram perda; zero, perda e nova base calculados',()=>{
 const s=move(move(created(1000),'investmentDeposit',500),'investmentWithdraw',200);
 const e=investmentEstimate(s.investments[0],1400);assert.equal(e.gainCents,100);assert.equal(e.percent,null);
 const next=move(s,'investmentBalance',1400);assert.equal(next.investments[0].sinceDeposits,0);
 assert.equal(investmentEstimate(next.investments[0],1260).percent,-10);
 assert.equal(investmentEstimate(created(0).investments[0],1200).percent,null);
 const zero=move(created(1000),'investmentBalance',0);assert.equal(zero.investments[0].balanceCents,0);
});
test('confirmações repetidas idênticas não duplicam e versões antigas não sobrescrevem',()=>{
 const s=created(0),p={id:crypto.randomUUID(),date,action:'investmentDeposit',investmentId:investment,accountId:account,version:1,cents:1000};
 const n=run(s,p);assert.deepEqual(run(n,p),n);
 assert.throws(()=>run(n,{...p,cents:2000}),/confirmação/);
 assert.throws(()=>run(n,{...p,id:crypto.randomUUID()}),e=>e.status===409);
});
test('IDs de outra aplicação ou conta, valores inválidos e resgates excessivos são rejeitados',()=>{
 const s=created(1000);
 assert.throws(()=>move(s,'investmentDeposit',100,{accountId:crypto.randomUUID()}),/deste financeiro/);
 assert.throws(()=>move(s,'investmentWithdraw',1100),/maior/);
 assert.throws(()=>move(s,'investmentBalance',-100),/válido/);
 assert.throws(()=>move(s,'investmentDeposit',1.1),/válido/);
 assert.throws(()=>move(s,'investmentDeposit',100,{investmentId:crypto.randomUUID()}),/deste financeiro/);
 assert.throws(()=>move(s,'investmentBalance',100,{accountId:account}),/não movimenta/);
 assert.throws(()=>move(s,'investmentDeposit',100,{date:'2026-02-30'}),/data/);
 const n=move(s,'investmentDeposit',100,{date:'2026-10-12'});
 assert.throws(()=>move(n,'investmentBalance',1200,{date:'2026-10-11'}),/última movimentação/);
});
test('consulta liberada não permite movimentação sem permissão de contas',()=>{
 for(const action of ['investmentCreate','investmentDeposit','investmentWithdraw','investmentBalance']){
  assert.throws(()=>assertPermission({permissions:{view:true,accounts:false}},action),e=>e.status===403);
  assert.doesNotThrow(()=>assertPermission({permissions:{view:true,accounts:true}},action));
 }
});
test('comandos de investimento reconhecidos sem capturar despesas e faturas',()=>{
 for(const text of ['Guardei 10 reais','Apliquei 10 reais na caixinha Nubank','Investi R$ 10,00'])assert.deepEqual(investmentIntent(text),{kind:'deposit',cents:1000});
 assert.deepEqual(investmentIntent('Meu saldo atual da aplicação é de 12,00'),{kind:'balance',cents:1200});
 assert.equal(investmentIntent('Quero atualizar o saldo da aplicação').kind,'balance');
 assert.equal(investmentIntent('Qual o meu saldo em aplicações?').kind,'query');
 assert.equal(investmentIntent('Resgatei 5 reais da aplicação').kind,'withdraw');
 for(const text of ['Gastei 30 com recarga','Quanto gastei no cartão?','fechar fatura do cartão'])assert.equal(investmentIntent(text),null);
 assert.equal(namedChoice('Nubank',[{name:'Caixinha Nubank'},{name:'Outra caixinha Nubank'}]).length,0);
});
function harness(permissions=true,accountName='Sicredi'){
 let state=created(1000),writes=0;state.accounts[0].name=accountName;const messages=[];
 const ui=createInvestmentsUI({getState:()=>state,can:()=>permissions,request:async p=>{writes++;return {data:run(state,p)}},update:s=>state=s,render(){},say:t=>messages.push(t),money:c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),escape:s=>String(s),today:()=>date,go(){},hasOtherFlow:()=>false});
 return {ui,messages,get writes(){return writes},get state(){return state}};
}
test('conversa pede origem, exibe prévia e só transfere após confirmar; cancelar preserva saldo',async()=>{
 const h=harness();await h.ui.handle('Guardei 10 reais na Caixinha Nubank');assert.equal(h.writes,0);assert.match(h.messages.at(-1),/qual conta/);
 await h.ui.handle('Sicredi');assert.equal(h.writes,0);assert.match(h.messages.at(-1),/não conta como despesa/);
 await h.ui.handle('confirmar');assert.equal(h.writes,1);assert.equal(h.state.investments[0].balanceCents,2000);
 await h.ui.handle('Resgatei 5 reais da aplicação Caixinha Nubank');await h.ui.handle('Sicredi');await h.ui.handle('cancelar');assert.equal(h.writes,1);assert.equal(h.state.investments[0].balanceCents,2000);
});
test('atualização mostra rendimento antes da confirmação e consulta não grava nada',async()=>{
 const h=harness();await h.ui.handle('Meu saldo atual da aplicação Caixinha Nubank é de 12,00');assert.equal(h.writes,0);assert.match(h.messages.at(-1),/20%/);assert.match(h.messages.at(-1),/impostos/);
 await h.ui.handle('confirmar');assert.equal(h.writes,1);assert.equal(h.state.investments[0].balanceCents,1200);
 await h.ui.handle('Qual meu saldo em aplicações?');assert.equal(h.writes,1);assert.match(h.messages.at(-1),/12,00/);
 const read=harness(false);await read.ui.handle('Investi 10 reais');assert.equal(read.writes,0);assert.equal(read.ui.active,false);
});
test('banco citado no nome da aplicação não é usado como origem sem perguntar',async()=>{
 const h=harness(true,'Nubank');await h.ui.handle('Guardei 10 reais na Caixinha Nubank');assert.match(h.messages.at(-1),/De qual conta/);assert.doesNotMatch(h.ui.bubble(),/data-invest-confirm/);assert.equal(h.writes,0);
 await h.ui.handle('Nubank');assert.match(h.ui.bubble(),/data-invest-confirm/);await h.ui.handle('confirmar');assert.equal(h.writes,1);
});
