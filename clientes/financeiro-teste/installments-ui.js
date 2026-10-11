import {normalize,parseMessage,moneyCents,matchCreditCards} from './conversation.js';
import {purchaseCycle,monthShift,invoiceDates,invoiceId} from './credit.js';
export function installmentIntent(text){const n=normalize(text);return !/\b(quanto|qual|mostr|saldo|limite|recebi|transfer|pagar fatura)\w*/.test(n)&&/\b(parcelad\w*|parcelas?|\d+\s*x\b|\d+\s+vezes)\b/.test(n)&&/\b(comprei|compra|gastei|comprar)\b/.test(n);}
export function installmentCount(text){const n=normalize(text),m=n.match(/\b(\d+)\s*(?:vezes|parcelas?|x)\b/);return m?Number(m[1]):null;}
export const matchingCards=matchCreditCards;
export function createInstallmentsUI({getState,can,request,update,render,money,today,escape,say,clearOtherFlow}){
 let pending=null,saving=false,epoch=0;
 const reset=()=>{pending=null;saving=false;epoch++};
 function prompt(){if(!pending.cents)say('Qual é o valor total da compra?');else if(!pending.count)say('Em quantas parcelas? Exemplo: 5 vezes.');else if(!pending.cardId)say('Em qual cartão? '+(getState().cards||[]).map(c=>c.name).join(' · '));else say('Confira as parcelas abaixo e confirme para salvar.');render();}
 async function confirm(){if(!pending||saving||!can('entries'))return;const p={...pending},generation=epoch;saving=true;render();try{const data=await request(p);if(generation!==epoch)return;update(data.data);pending=null;say('Compra parcelada registrada: '+p.count+' parcelas, total de '+money(p.cents)+'. O saldo das contas não foi descontado.');}catch(e){if(generation===epoch)say(e.message);}finally{if(generation===epoch){saving=false;render();}}}
 async function handle(text){const n=normalize(text);if(!pending&&!installmentIntent(text))return false;if(!can('entries')){say('Seu acesso não permite registrar compras.');render();return true;}
  if(saving)return true;
  if(pending&&/^(cancelar|cancela|nao)$/.test(n)){reset();say('Parcelamento descartado. Nada foi salvo.');render();return true;}
  if(pending&&/^(sim|confirmar|confirma|confirmo)$/.test(n)){if(pending.cents&&pending.count&&pending.cardId)await confirm();else prompt();return true;}
  const parsed=parseMessage(text,[],today(),getState().cards||[]),count=installmentCount(text);
  if(parsed.invalidDate){say('Essa data não é válida. Informe a data correta.');render();return true;}
  if(!pending){clearOtherFlow();pending={action:'installmentPurchase',id:crypto.randomUUID(),description:text.slice(0,300),category:parsed.category,scope:parsed.scope||'casal',date:parsed.date||today()};}
  if(parsed.cents)pending.cents=parsed.cents;else if(!pending.cents){const amount=moneyCents(text);if(amount>0)pending.cents=amount;}
  if(count!==null)pending.count=count;else if(!pending.count&&/^\d+$/.test(n))pending.count=Number(n);
  if(pending.count&&(pending.count<2||pending.count>60||pending.cents&&pending.cents<pending.count)){delete pending.count;say('Use de 2 a 60 parcelas, com pelo menos R$ 0,01 por parcela.');render();return true;}
  if(parsed.date)pending.date=parsed.date;
  const matches=matchingCards(text,getState().cards||[]);if(matches.length===1)pending.cardId=matches[0].id;
  const card=(getState().cards||[]).find(c=>c.id===pending.cardId);if(card)pending.firstInvoiceId=invoiceId(card.id,purchaseCycle(pending.date,card,getState().invoices||[]));
  prompt();return true;
 }
 function bubble(){if(!pending)return '';const card=(getState().cards||[]).find(c=>c.id===pending.cardId),ready=!!(pending.cents&&pending.count&&card);let rows='';if(ready){const cycle=pending.firstInvoiceId.slice(card.id.length+1),base=Math.floor(pending.cents/pending.count),extra=pending.cents%pending.count;for(let i=0;i<pending.count;i++){const due=invoiceDates(card,monthShift(cycle,i)).dueDate.split('-').reverse().join('/');rows+='<li>'+String(i+1)+'/'+pending.count+' · '+escape(money(base+(i<extra?1:0)))+' · vence '+due+'</li>';}}
  return '<div class="bubble"><strong>Compra parcelada</strong><p>'+escape(pending.description)+'</p>'+(ready?'<p>'+escape(card.name)+' · Total '+escape(money(pending.cents))+'</p><ul>'+rows+'</ul><button data-installment-confirm '+(saving?'disabled':'')+'>'+(saving?'Salvando…':'Confirmar parcelas')+'</button>':'<p>Aguardando valor, parcelas ou cartão.</p>')+' <button class="secondary" data-installment-cancel '+(saving?'disabled':'')+'>Cancelar</button></div>';
 }
 function bind(){document.querySelectorAll('[data-installment-confirm]').forEach(b=>b.onclick=confirm);document.querySelectorAll('[data-installment-cancel]').forEach(b=>b.onclick=()=>handle('cancelar'));}
 return {handle,bubble,bind,reset,get active(){return !!pending}};
}
