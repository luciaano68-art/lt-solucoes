import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixedExpenseTile} from '../fixed-expenses-ui.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rule={id:'rent-1',description:'Aluguel',cents:200000,dueDay:10};
const options={accountName:'Caixa da casa',canStop:true,escape,money:n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
test('compact rent tile keeps value, due day, account and existing stop action',()=>{const html=fixedExpenseTile(rule,options);assert.match(html,/Aluguel/);assert.match(html,/2\.000,00/);assert.match(html,/Vence dia <b>10/);assert.match(html,/Caixa da casa/);assert.match(html,/data-stop-fixed="rent-1"/);assert.equal(rule.cents,200000);});
test('read-only users see fixed expenses but no cancellation button',()=>{const html=fixedExpenseTile(rule,{...options,canStop:false});assert.match(html,/Aluguel/);assert.doesNotMatch(html,/data-stop-fixed|<button/);});
test('user-provided descriptions, account names and identifiers escaped',()=>{const html=fixedExpenseTile({...rule,description:'<img>',id:'"><script>'},{...options,accountName:'<b>Banco</b>'});assert.doesNotMatch(html,/<img>|<script>|<b>Banco/);assert.match(html,/&lt;img&gt;/);});
