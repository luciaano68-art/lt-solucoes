import {normalize,shiftDate} from './conversation.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const words=value=>normalize(value).replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const ignored=new Set(['a','o','as','os','de','do','da','dos','das','na','no','nas','nos','em','com','para']);
const tokens=value=>words(value).split(' ').filter(w=>w&&!ignored.has(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w);
const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const showDate=date=>date.split('-').reverse().join('/');
function parseDate(text,today){const [day,month,year]=text.split('/');const y=year?(year.length===2?'20'+year:year):today.slice(0,4),date=y+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');return !isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date?date:null;}
function monthRange(month){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);return {from:month+'-01',to:d.toISOString().slice(0,10)};}
function extractPeriod(input,today){
 let rest=input,range=null,error=null;
 const apply=(match,value)=>{rest=rest.replace(match[0],' ').replace(/\s+/g,' ').trim();range=value;};
 const date='(\\d{1,2}/\\d{1,2}(?:/(?:\\d{4}|\\d{2}))?)';
 let m=rest.match(new RegExp('(?:no periodo\\s+)?(?:de|entre|do dia)\\s+(?:os dias\\s+)?'+date+'\\s+(?:a|ate|e)\\s+(?:o dia\\s+)?'+date+'\\b'));
 if(m){const from=parseDate(m[1],today),to=parseDate(m[2],today);apply(m,{from,to});if(!from||!to||to<from)error='Confira o período: informe uma data inicial válida e uma data final igual ou posterior. Ex.: de 01/10/2026 até 31/10/2026.';}
 else if((m=rest.match(/\b(?:nos |durante os )?ultimos\s+(\d+)\s+dias\b/))){const days=Number(m[1]);apply(m,days>=1&&days<=3660?{from:shiftDate(today,1-days),to:today}:null);if(!range)error='Informe um período entre 1 e 3660 dias.';}
 else if((m=rest.match(/\b(?:na |durante a )?ultima semana\b/)))apply(m,{from:shiftDate(today,-6),to:today});
 else if((m=rest.match(new RegExp('\\b(?:no mes de|no mes|em|durante)\\s+('+months.join('|')+')(?:\\s+(?:de\\s+)?(\\d{4}))?\\b')))){const month=(m[2]||today.slice(0,4))+'-'+String(months.indexOf(m[1])+1).padStart(2,'0');apply(m,monthRange(month));}
 else if((m=rest.match(/\b(?:no mes de|no mes|em)\s+(0?[1-9]|1[0-2])\/(\d{4})\b/)))apply(m,monthRange(m[2]+'-'+m[1].padStart(2,'0')));
 else if((m=rest.match(/\b(?:neste|nesse|este|esse|no) mes(?: (passado|anterior))?\b/))){const d=new Date(today.slice(0,7)+'-01T12:00:00Z');if(m[1])d.setUTCMonth(d.getUTCMonth()-1);apply(m,monthRange(d.toISOString().slice(0,7)));}
 else if((m=rest.match(/\b(?:em|no ano de|no ano)\s+(\d{4})\b/)))apply(m,{from:m[1]+'-01-01',to:m[1]+'-12-31'});
 else if((m=rest.match(/\b(hoje|ontem)\b/))){const day=m[1]==='ontem'?shiftDate(today,-1):today;apply(m,{from:day,to:day});}
 if(!range&&!error&&/\d{1,2}\/\d{1,2}|\b(periodo|semana|mes|dias|ano)\b/.test(rest))error='Qual período você quer consultar? Pode dizer “neste mês”, “em setembro de 2026”, “nos últimos 30 dias” ou “de 01/10/2026 até 31/10/2026”.';
 if(error)rest=rest.replace(/\s+(?:desde|a partir de|de|entre|no periodo)\s+\d.*$/,'').trim();
 return {rest,range,error};
}
export function descriptionSpendingReply(text,data,today,previousSubject=null){
 let n=normalize(text).replace(/[?!.]+$/,'').trim();
 if(previousSubject&&/^(?:e\s+)?(?:hoje|ontem|neste mes|nesse mes|no mes|em (?:\d|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)|nos ultimos|na ultima semana|de \d|entre \d|no periodo)\b/.test(n))n='quanto gastei em '+previousSubject+' '+n.replace(/^e\s+/,'');
 const parsed=extractPeriod(n,today),q=parsed.rest;
 const match=q.match(/^quanto\s+(?:(?:eu|nos)\s+)?(?:gastei|gastamos|foi gasto)\s+(?:na|no|nas|nos|com|em|para|sobre|de)\s+(.+)$/)||q.match(/^quanto\s+(?:de\s+)?(.+?)\s+(?:eu\s+)?(?:gastei|gastamos)$/)||q.match(/^(?:me\s+)?(?:mostre|mostrar|ver)\s+(?:(?:os|todos os)\s+)?(?:gastos|compras)\s+(?:de|com|em|na|no)\s+(.+)$/)||q.match(/^(?:total gasto|gastos)\s+(?:de|com|em|na|no)\s+(.+)$/);
 if(!match)return null;
 const target=match[1].replace(/^(?:a\s+)?descricao\s+/,'').replace(/^["“”']|["“”']$/g,'').trim(),term=words(target),wanted=tokens(target);
 if(!wanted.length||/\b(cartao|cartoes|credito|fatura|faturas|dinheiro|banco|bancos|conta|contas|total|geral|tudo|receber|pagar|saldo|limite)\b/.test(term))return null;
 if(parsed.error)return {text:parsed.error,subject:target};
 const range=parsed.range,label=range?' · de '+showDate(range.from)+' a '+showDate(range.to):' · todos os períodos registrados';
 const list=(data.entries||[]).filter(e=>{if(e.deleted||e.kind!=='expense')return false;const description=tokens(e.description);return wanted.every(w=>description.includes(w))&&(!range||e.date>=range.from&&e.date<=range.to);}).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
 if(!list.length)return {text:'Nenhum gasto registrado com a descrição “'+target+'”'+label+'.\nTOTAL REGISTRADO: '+money(0)+'.',subject:target};
 const total=list.reduce((sum,e)=>sum+e.cents,0);
 return {text:'Gastos com a descrição “'+target+'”'+label+':\n\n'+list.map(e=>{const source=e.cardId?(data.cards||[]).find(c=>c.id===e.cardId)?.name||'Cartão':(data.accounts||[]).find(a=>a.id===e.accountId)?.name||'Conta';return '• '+(e.date?showDate(e.date):'Data não informada')+' · '+String(e.description).replace(/\s+/g,' ').trim()+' · '+money(e.cents)+' · '+source+' · '+(e.status==='paid'?'pago':e.dueDate?'a pagar em '+showDate(e.dueDate):'a pagar');}).join('\n')+'\n\nTOTAL REGISTRADO: '+money(total)+'.'+(list.some(e=>e.status!=='paid')?'\nInclui os gastos acima ainda a pagar.':''),subject:target};
}
