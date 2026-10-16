import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoiceValueReply} from '../card-query.js';
const cards=[{id:'a',name:'Sicredi Luciano',closingDay:29,dueDay:13},{id:'b',name:'Nubank Yasmin',closingDay:20,dueDay:2}];
const bill=(cardId,cycle,dueDate,status='open')=>({id:cardId+'_'+cycle,cardId,cycle,dueDate,status});
const entry=(cardId,cycle,cents,description,extra={})=>({id:description,kind:'expense',cardId,invoiceId:cardId+'_'+cycle,date:'2026-10-06',cents,description,status:'pending',...extra});
const data={cards,invoices:[bill('a','2026-09','2026-10-13','paid'),bill('a','2026-10','2026-11-13'),bill('b','2026-09','2026-10-02','closed')],entries:[entry('a','2026-09',5000,'Setembro cobrado em outubro',{status:'paid'}),entry('a','2026-10',3000,'Compra de outubro vence novembro'),entry('a','2026-11',1000,'Parcela futura'),entry('b','2026-09',2000,'Nubank outubro'),entry('a','2026-10',-500,'Crédito anuidade'),entry('a','2026-09',99999,'Compra excluída',{deleted:true})]};
const query=text=>invoiceValueReply(text,data,'2026-10-16').text;
test('exact user question filters due month, includes paid invoice, and is concise',()=>{
 for(const text of ['qual o valor da fatura com vencimento nesse mês','qual o valor da fatura com vencimento neste mês?','quanto é a fatura que vence no mês atual?']){
  const answer=query(text);assert.match(answer,/vencimento em 10\/2026/);assert.match(answer,/TOTAL: R\$\s*70,00/);assert.match(answer,/13\/10\/2026/);assert.match(answer,/Situação: paga/);assert.doesNotMatch(answer,/11\/2026|12\/2026|Compras:|Setembro cobrado|Compra excluída/);
 }
});
test('named, numeric and relative months use due dates instead of purchase dates or cycles',()=>{
 for(const text of ['valor da fatura de novembro','valor da fatura 11/2026','valor da fatura 2026-11','valor da fatura do próximo mês','valor da fatura mês que vem']){
  const answer=query(text);assert.match(answer,/vencimento em 11\/2026/);assert.match(answer,/TOTAL: R\$\s*25,00/);assert.doesNotMatch(answer,/13\/10\/2026|13\/12\/2026|Compras:/);
 }
});
test('selected card is isolated, unknown card never silently selects another',()=>{
 assert.match(query('valor da fatura com vencimento nesse mês do Sicredi'),/TOTAL: R\$\s*50,00/);assert.doesNotMatch(query('valor da fatura com vencimento nesse mês do Sicredi'),/Nubank/);
 assert.match(query('valor da fatura Bradesco desse mês'),/Não encontrei/);
});
test('details are opt in and stay within selected month',()=>{
 const answer=query('mostre os itens da fatura de novembro do Sicredi');assert.match(answer,/Compra de outubro vence novembro/);assert.match(answer,/Crédito anuidade/);assert.doesNotMatch(answer,/Setembro cobrado|Parcela futura|Compra excluída/);
});
test('empty month returns zero without substituting later invoices',()=>{
 const answer=query('valor da fatura do mês passado');assert.match(answer,/09\/2026/);assert.match(answer,/TOTAL: R\$\s*0,00/);assert.doesNotMatch(answer,/13\/11\/2026/);
});
test('all invoices and paid-only requests remain available explicitly',()=>{
 assert.match(query('valor de todas as faturas'),/TOTAL: R\$\s*55,00/);
 assert.match(query('valor das faturas pagas com vencimento nesse mês'),/TOTAL: R\$\s*50,00/);
 assert.match(query('valor das faturas a pagar com vencimento nesse mês'),/TOTAL: R\$\s*20,00/);
});
test('relative month handles year rollover and no state is changed',()=>{
 const before=JSON.stringify(data),answer=invoiceValueReply('valor da fatura próximo mês',data,'2026-12-31').text;
 assert.match(answer,/01\/2027/);assert.equal(JSON.stringify(data),before);
});
test('financial actions and ordinary spending queries continue to their own handlers',()=>{
 for(const text of ['pagar fatura desse mês','fechar fatura','paguei a fatura','quanto gastei no cartão este mês'])assert.equal(invoiceValueReply(text,data,'2026-10-16'),null);
});

test('screenshot question selects current open Sicredi invoice, never the empty due month or future installments',()=>{
 for(const text of ['Qual o valor da fatura do Sicredi','qual o valor da fatura em aberto do Sicredi','valor da fatura desse mês do Sicredi','valor da fatura atual do Sicredi']){
  const answer=query(text);assert.match(answer,/Fatura atual em aberto/);assert.match(answer,/13\/11\/2026/);assert.match(answer,/TOTAL: R\$\s*25,00/);assert.doesNotMatch(answer,/13\/10\/2026|13\/12\/2026|Compras:|Nubank/);
 }
});
test('zero-valued open cycle never substitutes a future installment or sums all invoices',()=>{
 const empty={cards:[cards[0]],invoices:[],entries:[entry('a','2026-11',10000,'Futura')]};
 const answer=invoiceValueReply('qual o valor da fatura do Sicredi',empty,'2026-10-16').text;
 assert.match(answer,/13\/11\/2026/);assert.match(answer,/TOTAL: R\$\s*0,00/);assert.doesNotMatch(answer,/100,00|13\/12\/2026/);
});
test('closing cycle advances after closing day and across year rollover',()=>{
 const sample={cards:[cards[0]],invoices:[],entries:[entry('a','2026-11',1234,'Próxima'),entry('a','2027-01',5678,'Janeiro')]};
 assert.match(invoiceValueReply('valor da fatura aberta do Sicredi',sample,'2026-10-30').text,/13\/12\/2026[\s\S]*12,34/);
 assert.match(invoiceValueReply('valor da fatura aberta do Sicredi',sample,'2026-12-30').text,/13\/02\/2027[\s\S]*56,78/);
});
