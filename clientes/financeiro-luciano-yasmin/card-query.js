import {normalize} from './conversation.js';
import {cardLimit,purchaseCycle,invoiceId,invoiceDates} from './credit.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function cardLimitReply(text,data,awaitingChoice=false){
 const n=normalize(text),query=/\blimites?\b/.test(n)&&(/\b(quanto|qual|quais|tem|tenho|disponivel|resta|sobrou|utilizado|usado|consulta|ver|mostre)\b/.test(n)||/^limites?\b/.test(n));
 if(!query&&!awaitingChoice)return null;
 if(!query&&(/\b(gastei|paguei|comprei|recebi|despesa|entrada|saida|fatura|saldo)\b/.test(n)||/^(sim|nao|ainda nao|cancelar|cancela|confirmar)[.!?]*$/.test(n)))return null;
 const cards=data.cards||[];if(!cards.length)return {text:'Você ainda não tem cartões cadastrados. Abra Cartões → Adicionar cartão e informe o limite.',awaitingChoice:false};
 const allCards=query&&/\b(cartoes|cada cartao|todos os cartoes|todos meus cartoes)\b/.test(n);
 if(allCards)return {text:'Limites por cartão:\n\n'+cards.map(card=>{const amounts=cardLimit(data,card);return card.name+':\n'+(amounts.limit===null?'Limite total e disponível: ainda não informados. Cadastre o limite em Cartões → Editar.':'Limite disponível: '+money(amounts.available)+'.\nLimite total: '+money(amounts.limit)+'.')+'\nUtilizado: '+money(amounts.used)+'.';}).join('\n\n')+'\n\nConsidera as compras registradas no app que ainda não foram pagas.',awaitingChoice:false};
 const exact=cards.filter(c=>n.includes(normalize(c.name))),longest=Math.max(0,...exact.map(c=>normalize(c.name).length));
 let matches=exact.filter(c=>normalize(c.name).length===longest);
 if(!matches.length)matches=cards.filter(c=>{const parts=normalize(c.name).split(/\s+/).filter(t=>!['cartao','credito','de','do','da'].includes(t));return parts.some(part=>part.length>2&&new RegExp('(?:^|\\s)'+part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|\\s|[?!.,])').test(n))});
 if(!matches.length&&query&&cards.length===1&&!/cartao\s+(?:de\s+credito\s+)?[a-z0-9]/.test(n.replace(/\b(cartao de credito|cartao)\b\s*(?:[?!.,]|$)/,'cartao')))matches=cards;
 if(matches.length!==1)return {text:'Qual cartão você quer consultar? '+cards.map(c=>c.name).join(', ')+'. Escreva o nome do cartão.',awaitingChoice:true};
 const card=matches[0],amounts=cardLimit(data,card);
 if(amounts.limit===null)return {text:'O limite do cartão '+card.name+' ainda não foi informado. Abra Cartões → Editar e preencha o limite.\nCompras registradas ainda não pagas: '+money(amounts.used)+'.',awaitingChoice:false};
 return {text:'Limite disponível no cartão '+card.name+': '+money(amounts.available)+'.\nLimite total: '+money(amounts.limit)+'.\nUtilizado: '+money(amounts.used)+'.\nConsidera as compras registradas no app que ainda não foram pagas.',awaitingChoice:false};
}

// Purchases count when registered, even before an invoice is paid.
export function cardSpendingReply(text,data,today){
 const n=normalize(text),cards=data.cards||[];
 if(/\blimite\b/.test(n))return null;
 const mentionsCard=/\b(cartao|cartoes|credito|fatura|faturas)\b/.test(n)||cards.some(c=>n.includes(normalize(c.name)));
 const question=/\b(quanto|qual|quais|total|mostre|mostrar|ver|consulta|consultar)\b/.test(n);
 const spending=/\b(gastei|gastamos|gasto|gastos|gastou|gastamos|compras|fatura|faturas|utilizado)\b/.test(n);
 if(!mentionsCard||!question||!spending)return null;
 if(!cards.length)return {text:'Você ainda não tem cartões cadastrados. Abra Cartões → Adicionar cartão.',awaitingChoice:false};
 let matches=cards.filter(c=>n.includes(normalize(c.name)));
 const longest=Math.max(0,...matches.map(c=>normalize(c.name).length));matches=matches.filter(c=>normalize(c.name).length===longest);
 if(!matches.length)matches=cards.filter(c=>normalize(c.name).split(/\s+/).filter(p=>p.length>2&&!['cartao','credito'].includes(p)).some(p=>n.split(/[^a-z0-9]+/).includes(p)));
 // An explicit unknown card must not silently return another card's spending.
 if(!matches.length&&/\bcartao\s+(?:de\s+credito\s+)?(?:sicredi|nubank|itau|bradesco|santander|inter|c6|banco)\b/.test(n))return {text:'Não encontrei esse cartão. Cartões cadastrados: '+cards.map(c=>c.name).join(', ')+'.',awaitingChoice:false};
 const selected=matches.length?matches:cards,entries=(data.entries||[]).filter(e=>!e.deleted&&e.kind==='expense'&&e.cardId);
 let period=null,label='';
 if(/\b(hoje|ontem)\b/.test(n)){const date=new Date(today+'T12:00:00Z');if(n.includes('ontem'))date.setUTCDate(date.getUTCDate()-1);period=date.toISOString().slice(0,10);label=n.includes('ontem')?'ontem':'hoje';}
 else if(/\b(mes|mensal)\b/.test(n)){period=today.slice(0,7);if(/\b(passado|anterior)\b/.test(n)){const date=new Date(today+'T12:00:00Z');date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-1);period=date.toISOString().slice(0,7);}label='no mês '+period.split('-').reverse().join('/');}
 const historical=/\b(historico|sempre)\b|\b(no total|todo o periodo|todos os meses)\b/.test(n);
 let sum=0;
 const lines=selected.map(card=>{
  const purchases=entries.filter(e=>e.cardId===card.id);
  const cycle=purchaseCycle(today,card,data.invoices||[]),id=invoiceId(card.id,cycle);
  const bill=(data.invoices||[]).find(b=>b.id===id)||invoiceDates(card,cycle);
  const included=period?purchases.filter(e=>e.date?.startsWith(period)):historical?purchases:purchases.filter(e=>e.invoiceId===id);
  const total=included.reduce((v,e)=>v+e.cents,0);sum+=total;
  const pending=purchases.filter(e=>e.status!=='paid').reduce((v,e)=>v+e.cents,0);
  return card.name+': '+money(total)+'.\n'+(period?'Compras '+label+'.':historical?'Todas as compras registradas.':'Na fatura com vencimento para '+bill.dueDate.split('-').reverse().join('/')+'.')+'\nAinda não pago em todas as faturas deste cartão: '+money(pending)+'.';
 });
 return {text:(selected.length>1?'Total nos cartões consultados: '+money(sum)+'.\n\n':'Total de compras no cartão de crédito:\n')+lines.join('\n\n')+'\n\nConsidera somente as compras registradas no app.',awaitingChoice:false};
}
