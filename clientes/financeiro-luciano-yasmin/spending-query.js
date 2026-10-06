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
 const totals={credit:0,cash:0,bank:0,unknown:0,pending:0},bankAccounts=new Map();
 for(const entry of data.entries||[]){
  if(entry.deleted||entry.kind!=='expense')continue;
  if(entry.cardId){if(entry.date?.startsWith(month))totals.credit+=entry.cents;continue;}
  if(entry.status!=='paid'){if((entry.dueDate||entry.date)?.startsWith(month))totals.pending+=entry.cents;continue;}
  if(!(entry.paidDate||entry.date)?.startsWith(month))continue;
  const account=(data.accounts||[]).find(a=>a.id===entry.accountId);
  if(!account){totals.unknown+=entry.cents;continue;}
  if(cashAccount(account))totals.cash+=entry.cents;
  else{totals.bank+=entry.cents;bankAccounts.set(account.name,(bankAccounts.get(account.name)||0)+entry.cents);}
 }
 const total=totals.credit+totals.cash+totals.bank+totals.unknown;
 return {text:'Gastos do mês '+month.split('-').reverse().join('/')+':\n\nCartão de crédito: '+money(totals.credit)+'.\nDinheiro: '+money(totals.cash)+'.\nBanco / outras contas: '+money(totals.bank)+'.'+(totals.unknown?'\nConta não identificada: '+money(totals.unknown)+'.':'')+'\n\nTOTAL GERAL: '+money(total)+'.'+(bankAccounts.size?'\n\nPor conta:\n'+[...bankAccounts].map(([name,cents])=>name+': '+money(cents)+'.').join('\n'):'')+'\n\nNo cartão, conto as compras feitas neste mês, mesmo com a fatura ainda não paga. Em dinheiro e contas, conto as despesas pagas no mês. O pagamento da fatura não soma as compras novamente.'+(totals.pending?'\nOutras despesas ainda a pagar neste mês: '+money(totals.pending)+' (fora do total acima).':'')+'\nConsidera somente os lançamentos registrados no app.'};
}
