import {normalize} from './conversation.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function accountBalanceReply(text,data,today,awaitingChoice=false){
 const n=normalize(text);
 if(/\b(cartao|cartoes|credito|fatura|faturas|limite|limites|gastei|gastamos|paguei|comprei|recebi|lancamento|despesa)\b/.test(n)||/^(sim|nao|cancelar|cancela|confirmar)[.!?]*$/.test(n))return null;
 const query=/\bsaldo\b|\b(quanto|qual|quais|o que|ver|mostre)\b.*\b(tenho|temos|pagar|receber|conta|banco)\b/.test(n);
 if(!query&&!awaitingChoice)return null;
 const accounts=(data.accounts||[]).filter(a=>!a.deleted);
 const exact=accounts.filter(a=>n.includes(normalize(a.name))),longest=Math.max(0,...exact.map(a=>normalize(a.name).length));
 let matches=exact.filter(a=>normalize(a.name).length===longest);
 const parts=account=>normalize(account.name).split(/\s+/).filter(part=>part.length>2&&!['conta','banco','corrente','poupanca','minha','meu','dos','das'].includes(part));
 if(!matches.some(a=>parts(a).length>1))matches=accounts.filter(a=>parts(a).some(part=>n.split(/[^a-z0-9]+/).includes(part)));
 if(!matches.length&&!awaitingChoice&&!/\b(conta|banco)\b/.test(n))return null;
 if(!accounts.length)return {text:'Você ainda não tem contas cadastradas. Adicione uma conta em Contas.',awaitingChoice:false};
 if(matches.length!==1)return {text:(matches.length>1?'Encontrei mais de uma conta com esse nome.':'Qual conta você quer consultar?')+' '+(matches.length?matches:accounts).map(a=>a.name).join(', ')+'. Escreva o nome completo da conta.',awaitingChoice:true};
 const account=matches[0],entries=(data.entries||[]).filter(e=>!e.deleted&&e.accountId===account.id);
 const balance=account.openingCents+entries.filter(e=>e.status==='paid').reduce((sum,e)=>sum+(e.kind==='income'?e.cents:-e.cents),0);
 const month=/\b(mes|mensal)\b/.test(n)?today.slice(0,7):null;
 const pending=entries.filter(e=>e.status==='pending'&&!e.cardId&&(!month||(e.dueDate||e.date)?.startsWith(month)));
 const sum=kind=>pending.filter(e=>e.kind===kind).reduce((total,e)=>total+e.cents,0);
 const period=month?' neste mês':' (pendências registradas)';
 return {text:account.name+':\nSaldo disponível: '+money(balance)+'.\nPrevisto a receber'+period+': '+money(sum('income'))+'.\nPrevisto a pagar'+period+': '+money(sum('expense'))+'.',awaitingChoice:false};
}
