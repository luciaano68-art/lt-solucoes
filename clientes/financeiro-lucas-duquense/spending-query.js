import {normalize,categoryOf} from './conversation.js';
const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cashAccount=account=>/\b(dinheiro|especie)\b|^(carteira|caixa)(\s|$)/.test(normalize(account?.name||''));
export function monthlySpendingReply(text,data,today){
 const n=normalize(text);
 if(/\b(limite|recebi|recebemos|entrada|entradas|saldo)\b/.test(n))return null;
 if(!/\b(quanto|qual|total|mostre|mostrar|ver|resumo)\b/.test(n)||! /\b(gastei|gastamos|gasto|gastos|despesas|compras)\b/.test(n))return null;
 const hasCard=/\b(cartao|cartoes|credito|fatura|faturas)\b/.test(n)||(data.cards||[]).some(c=>n.includes(normalize(c.name)));
 const mixed=/\boutras despesas\b/.test(n)||hasCard&&/\b(dinheiro|banco|bancos|contas|outras)\b/.test(n);
 const broad=/\b(ao todo|tudo|todos os gastos|todas as despesas|geral|entre)\b/.test(n);
 if(hasCard&&!mixed)return null;
 if(!mixed&&!broad&&(categoryOf(n)!=='Outros'||/\b(dinheiro|banco|bancos|conta)\b/.test(n)))return null;
 let month=today.slice(0,7);
 if(/\bmes (passado|anterior)\b/.test(n)){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);month=d.toISOString().slice(0,7);}
 const totals={credit:0,cash:0,bank:0,unknown:0,pending:0},bankAccounts=new Map(),details={credit:[],cash:[],bank:[],unknown:[]};
 for(const entry of data.entries||[]){
  if(entry.deleted||entry.kind!=='expense')continue;
  if(entry.cardId){if(entry.date?.startsWith(month)){totals.credit+=entry.cents;details.credit.push({entry,date:entry.date,source:(data.cards||[]).find(c=>c.id===entry.cardId)?.name||'Cartão não identificado'});}continue;}
  if(entry.status!=='paid'){if((entry.dueDate||entry.date)?.startsWith(month))totals.pending+=entry.cents;continue;}
  if(!(entry.paidDate||entry.date)?.startsWith(month))continue;
  const account=(data.accounts||[]).find(a=>a.id===entry.accountId);
  if(!account){totals.unknown+=entry.cents;details.unknown.push({entry,date:entry.paidDate||entry.date,source:'Conta não identificada'});continue;}
  if(cashAccount(account)){totals.cash+=entry.cents;details.cash.push({entry,date:entry.paidDate||entry.date,source:account.name});}
  else{totals.bank+=entry.cents;details.bank.push({entry,date:entry.paidDate||entry.date,source:account.name});bankAccounts.set(account.name,(bankAccounts.get(account.name)||0)+entry.cents);}
 }
 const total=totals.credit+totals.cash+totals.bank+totals.unknown;
 const detailText=[['credit','No cartão de crédito'],['cash','Em dinheiro'],['bank','Pelo banco / outras contas'],['unknown','Conta não identificada']].filter(([key])=>details[key].length).map(([key,label])=>label+':\n'+details[key].sort((a,b)=>a.date.localeCompare(b.date)).map(({entry,date,source})=>'• '+date.split('-').reverse().join('/')+' · '+String(entry.description||entry.category||'Despesa sem descrição').replace(/\s+/g,' ').trim()+' · '+money(entry.cents)+' ('+source+')').join('\n')).join('\n\n');
 return {text:'Gastos do mês '+month.split('-').reverse().join('/')+':\n\nCartão de crédito: '+money(totals.credit)+'.\nDinheiro: '+money(totals.cash)+'.\nBanco / outras contas: '+money(totals.bank)+'.'+(totals.unknown?'\nConta não identificada: '+money(totals.unknown)+'.':'')+'\n\nTOTAL GERAL: '+money(total)+'.'+(bankAccounts.size?'\n\nPor conta:\n'+[...bankAccounts].map(([name,cents])=>name+': '+money(cents)+'.').join('\n'):'')+(detailText?'\n\nNo que foi gasto:\n\n'+detailText:'')+'\n\nNo cartão, conto as compras feitas neste mês, mesmo com a fatura ainda não paga. Em dinheiro e contas, conto as despesas pagas no mês. O pagamento da fatura não soma as compras novamente.'+(totals.pending?'\nOutras despesas ainda a pagar neste mês: '+money(totals.pending)+' (fora do total acima).':'')+'\nConsidera somente os lançamentos registrados no app.'};
}
