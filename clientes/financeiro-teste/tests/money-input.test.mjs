import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindMoneyInput,maskedMoney} from '../money-input.js';
import {moneyCents} from '../conversation.js';
function field(value=''){const handlers={};return {value,handlers,addEventListener(name,fn){(handlers[name]||=[]).push(fn)},dispatchEvent(event){for(const fn of handlers[event.type]||[])fn(event)},select(){this.selected=true}};}
test('digitação em centavos usa reais e mantém o valor que será salvo',()=>{
 for(const [raw,cents] of [['1',1],['10',10],['1000',1000],['123456',123456],['-1000',-1000]])assert.equal(moneyCents(maskedMoney(raw)),cents);
 assert.match(maskedMoney('1000'),/R\$.*10,00/);assert.equal(maskedMoney(''),'');
});
test('valores já cadastrados são formatados; campos opcionais vazios continuam vazios',()=>{
 const f=field('12,00');bindMoneyInput(f);assert.match(f.value,/R\$.*12,00/);assert.equal(f.inputMode,'decimal');
 const empty=field();bindMoneyInput(empty);assert.equal(empty.value,'');assert.equal(empty.placeholder,'R$ 0,00');
 bindMoneyInput(f);assert.equal(f.handlers.input.length,1);
});
test('colar valor em reais atualiza o campo e notifica o formulário sem alterar centavos',()=>{
 const f=field();bindMoneyInput(f);let notified=0;f.addEventListener('input',()=>notified++);let prevented=false;
 f.handlers.paste[0]({clipboardData:{getData:()=> '1.234,56'},preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(moneyCents(f.value),123456);assert.equal(notified,1);
 f.handlers.focus[0]();assert.equal(f.selected,true);
});
