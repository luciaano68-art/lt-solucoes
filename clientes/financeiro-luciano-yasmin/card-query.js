import {normalize} from './conversation.js';
import {cardLimit} from './credit.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function cardLimitReply(text,data,awaitingChoice=false){
 const n=normalize(text),query=/\blimite\b/.test(n)&&(/\b(quanto|qual|tem|tenho|disponivel|resta|sobrou|utilizado|usado|consulta|ver|mostre)\b/.test(n)||/^limite\b/.test(n));
 if(!query&&!awaitingChoice)return null;
 if(!query&&(/\b(gastei|paguei|comprei|recebi|despesa|entrada|saida|fatura|saldo)\b/.test(n)||/^(sim|nao|ainda nao|cancelar|cancela|confirmar)[.!?]*$/.test(n)))return null;
 const cards=data.cards||[];if(!cards.length)return {text:'Você ainda não tem cartões cadastrados. Abra Cartões → Adicionar cartão e informe o limite.',awaitingChoice:false};
 const exact=cards.filter(c=>n.includes(normalize(c.name))),longest=Math.max(0,...exact.map(c=>normalize(c.name).length));
 let matches=exact.filter(c=>normalize(c.name).length===longest);
 if(!matches.length)matches=cards.filter(c=>{const parts=normalize(c.name).split(/\s+/).filter(t=>!['cartao','credito','de','do','da'].includes(t));return parts.some(part=>part.length>2&&new RegExp('(?:^|\\s)'+part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|\\s|[?!.,])').test(n))});
 if(!matches.length&&query&&cards.length===1&&!/cartao\s+(?:de\s+credito\s+)?[a-z0-9]/.test(n.replace(/\b(cartao de credito|cartao)\b\s*(?:[?!.,]|$)/,'cartao')))matches=cards;
 if(matches.length!==1)return {text:'Qual cartão você quer consultar? '+cards.map(c=>c.name).join(', ')+'. Escreva o nome do cartão.',awaitingChoice:true};
 const card=matches[0],amounts=cardLimit(data,card);
 if(amounts.limit===null)return {text:'O limite do cartão '+card.name+' ainda não foi informado. Abra Cartões → Editar e preencha o limite.\nCompras registradas ainda não pagas: '+money(amounts.used)+'.',awaitingChoice:false};
 return {text:'Limite disponível no cartão '+card.name+': '+money(amounts.available)+'.\nLimite total: '+money(amounts.limit)+'.\nUtilizado: '+money(amounts.used)+'.\nConsidera as compras registradas no app que ainda não foram pagas.',awaitingChoice:false};
}
