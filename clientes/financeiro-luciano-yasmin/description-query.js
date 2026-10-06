import {normalize,shiftDate} from './conversation.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const words=value=>normalize(value).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
export function descriptionSpendingReply(text,data,today){
 const match=text.trim().match(/^quanto\s+(?:(?:eu|nos|nós)\s+)?(?:gastei|gastamos)\s+(?:na|no|nas|nos|com|em|para|sobre)\s+(.+?)\s*[?!.]*$/i);
 if(!match)return null;
 let target=match[1].replace(/^(?:a\s+)?descri[cç][aã]o\s+/i,'').replace(/^["“”']|["“”']$/g,'').trim(),period=null,label='';
 const monthSuffix=/\s+(?:neste|nesse|este|esse|no)\s+m[eê]s(?:\s+(passado|anterior))?\s*[?!.]*$/i;
 const monthMatch=target.match(monthSuffix);
 if(monthMatch){target=target.replace(monthSuffix,'').trim();period=today.slice(0,7);if(monthMatch[1]){const d=new Date(period+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);period=d.toISOString().slice(0,7);}label=' · mês '+period.split('-').reverse().join('/');}
 else{const day=target.match(/\s+(hoje|ontem)\s*[?!.]*$/i);if(day){target=target.replace(/\s+(hoje|ontem)\s*[?!.]*$/i,'').trim();period=day[1].toLowerCase()==='ontem'?shiftDate(today,-1):today;label=' · '+day[1].toLowerCase();}}
 const term=words(target);
 // Leave questions about payment methods, accounts and general totals to their own handlers.
 if(!term||/\b(cartao|cartoes|credito|fatura|faturas|dinheiro|banco|bancos|conta|contas|total|geral|tudo)\b/.test(term))return null;
 const list=(data.entries||[]).filter(e=>!e.deleted&&e.kind==='expense'&&(' '+words(e.description)+' ').includes(' '+term+' ')&&(!period||e.date?.startsWith(period))).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
 if(!list.length)return {text:'Nenhum gasto registrado com a descrição “'+target+'”'+label+'.\nTOTAL REGISTRADO: '+money(0)+'.'};
 const total=list.reduce((sum,e)=>sum+e.cents,0);
 return {text:'Gastos com a descrição “'+target+'”'+label+':\n\n'+list.map(e=>{const source=e.cardId?(data.cards||[]).find(c=>c.id===e.cardId)?.name||'Cartão':(data.accounts||[]).find(a=>a.id===e.accountId)?.name||'Conta';return '• '+(e.date?e.date.split('-').reverse().join('/'):'Data não informada')+' · '+String(e.description).replace(/\s+/g,' ').trim()+' · '+money(e.cents)+' · '+source+' · '+(e.status==='paid'?'pago':e.dueDate?'a pagar em '+e.dueDate.split('-').reverse().join('/'):'a pagar');}).join('\n')+'\n\nTOTAL REGISTRADO: '+money(total)+'.'+(list.some(e=>e.status!=='paid')?'\nInclui os gastos acima ainda a pagar.':'')};
}
