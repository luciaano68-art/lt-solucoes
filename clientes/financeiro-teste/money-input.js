import {moneyCents} from './conversation.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const bound=new WeakSet();
export function maskedMoney(raw){
 const digits=String(raw).replace(/\D/g,'');if(!digits)return '';
 const cents=Number(digits);if(!Number.isSafeInteger(cents))return raw;
 return (String(raw).includes('-')?'-':'')+money(cents);
}
export function bindMoneyInput(input){
 if(!input||bound.has(input))return;bound.add(input);
 input.inputMode='decimal';input.placeholder='R$ 0,00';
 if(input.value){const cents=moneyCents(input.value);if(cents!==null)input.value=money(cents);}
 input.addEventListener('input',()=>{input.value=maskedMoney(input.value)});
 input.addEventListener('focus',()=>input.select());
 input.addEventListener('paste',event=>{const raw=event.clipboardData?.getData('text'),cents=moneyCents(raw);if(cents!==null){event.preventDefault();input.value=money(cents);input.dispatchEvent(new Event('input',{bubbles:true}));}});
}
