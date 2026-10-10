import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createAccessScreen} from '../access-screen.js';
function setup(initial){
 const accessScreen=createAccessScreen();if(initial)accessScreen.set(initial);
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',textContent:'',reset(){}});return nodes.get(id)};
 let resolve;const response=new Promise(r=>resolve=r);
 const source=readFileSync(new URL('../registration.js',import.meta.url),'utf8').replace("import {accessScreen} from './access-screen.js';",'');
 vm.runInNewContext(source,{accessScreen,document:{getElementById:node,querySelectorAll:()=>[]},location:{hash:'',pathname:'/clientes/financeiro-teste/',search:''},history:{replaceState(){}},sessionStorage:{getItem:()=>null,removeItem(){}},URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:()=>response});
 return {accessScreen,node,async reply(available){resolve({ok:true,json:async()=>({available})});await new Promise(r=>setImmediate(r))}};
}
test('restauração assíncrona não é substituída pelo cadastro ou pelo retorno tardio do convite',async()=>{
 const s=setup();assert.equal(s.node('sessionRestore').hidden,false);assert.equal(s.node('registrationForm').hidden,true);
 s.accessScreen.set('authenticated');await s.reply(false);
 assert.equal(s.accessScreen.state,'authenticated');assert.equal(s.node('loginForm').hidden,true);
 assert.equal(s.node('registrationForm').hidden,true);
});
test('sessão já recuperada antes do script de cadastro permanece aberta',async()=>{
 const s=setup('authenticated');await s.reply(true);assert.equal(s.node('loginForm').hidden,true);assert.equal(s.node('registrationForm').hidden,true);
});
test('sem sessão abre cadastro; login, recuperação e saída continuam disponíveis',async()=>{
 const s=setup();s.accessScreen.set('guest');await s.reply(true);assert.equal(s.node('registrationForm').hidden,false);
 s.node('existingLogin').onclick();assert.equal(s.node('loginForm').hidden,false);
 s.node('forgotPassword').onclick();assert.equal(s.node('forgotForm').hidden,false);
 s.node('forgotBack').onclick();assert.equal(s.node('loginForm').hidden,false);
 s.accessScreen.set('authenticated');s.accessScreen.set('login');assert.equal(s.node('loginForm').hidden,false);
});
test('sem internet a recuperação mantém a tela de tentativa e não exige novo login',async()=>{
 const s=setup();await s.reply(false);assert.equal(s.accessScreen.state,'restoring');assert.equal(s.node('sessionRestore').hidden,false);assert.equal(s.node('loginForm').hidden,true);
});
