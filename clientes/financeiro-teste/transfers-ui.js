import {bindMoneyInput} from './money-input.js';
import {moneyCents,normalize} from './conversation.js';
export function transferIntent(text){const n=normalize(text);return !/\b(taxa|tarifa|custo)\b.*\btransfer/.test(n)&&/\b(transfer\w*|transfir\w*)\b/.test(n);}
export function transferAmount(text){const match=String(text).replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g,'').match(/(?:R\$\s*)?(-?\d+(?:\.\d{3})*(?:[,.]\d{1,2})?)/i);return match?moneyCents(match[1]):null;}
export function transferNamed(text,rows){const n=normalize(text),matches=rows.filter(a=>n.includes(normalize(a.name))),longest=Math.max(0,...matches.map(a=>normalize(a.name).length));const list=matches.filter(a=>normalize(a.name).length===longest);if(list.length===1)return list[0];const named=list.filter(a=>a.ownerName&&n.includes(normalize(a.ownerName)));return named.length===1?named[0]:null;}
export function createTransfersUI({getState,can,request,update,render,money,today,escape,say=()=>{},clearOtherFlow=()=>{}}){
 let dialog=null,id=null,pending=null;
 const sources=()=>getState().accounts.filter(a=>!a.deleted),targets=()=>getState().transferTargets||sources();
 function question(){
  if(!pending)return;
  const data=getState();if(!sources().some(a=>a.id===pending.fromAccountId))pending.fromAccountId=null;
  if(!targets().some(a=>a.id===pending.toAccountId))pending.toAccountId=null;
  if(!pending.cents){pending.stage='amount';say('Qual valor você quer transferir?');}
  else if(!pending.fromAccountId){pending.stage='from';say('De qual conta sua sai o dinheiro? '+sources().map(a=>a.name).join(', ')+'.');}
  else if(!pending.toAccountId){pending.stage='to';say('Para qual conta vai? '+targets().filter(a=>a.id!==pending.fromAccountId).map(a=>a.name+(a.private?' ('+(a.ownerName||'particular')+')':'')).join(', ')+'.');}
  else if(pending.fromAccountId===pending.toAccountId){pending.toAccountId=null;question();return;}
  else {pending.stage='confirm';say('Confirmar transferência de '+money(pending.cents)+' de '+sources().find(a=>a.id===pending.fromAccountId).name+' para '+targets().find(a=>a.id===pending.toAccountId).name+'? Não entra como gasto ou receita. É um registro no app; o dinheiro precisa ser transferido pelo banco.');}
  render();
 }
 async function handle(text){
  const n=normalize(text),intent=transferIntent(text);
  if(!pending&&!intent)return false;
  if(!can('entries')){pending=null;say('Seu acesso não permite registrar transferências.');render();return true;}
  if(intent&&/\b(quanto|quais|ver|mostre|historico)\b/.test(n)){
   const list=(getState().transfers||[]).filter(t=>t.date.startsWith(today().slice(0,7)));say(list.length?'Transferências deste mês (sem contar como gasto ou receita):\n'+list.slice(-30).map(t=>t.fromName+' → '+t.toName+': '+money(t.cents)).join('\n'):'Nenhuma transferência registrada neste mês.');render();return true;
  }
  if(/^(cancelar|cancela|nao)[.!?]*$/.test(n)){pending=null;say('Transferência cancelada. Nada foi lançado.');render();return true;}
  if(!pending){
   clearOtherFlow();const parts=n.split(/\bpara\b/),from=transferNamed(parts[0],sources()),to=parts.length>1?transferNamed(parts.slice(1).join(' para '),targets()):null;
   const amount=transferAmount(text);pending={id:crypto.randomUUID(),cents:amount>0?amount:null,date:today(),fromAccountId:from?.id||null,toAccountId:to?.id||null};question();return true;
  }
  if(pending.stage==='confirm'&&/^(sim|confirmar|confirmo|confirmar transferencia)[.!?]*$/.test(n)){
   if(pending.saving)return true;pending.saving=true;
   try{const p=pending,result=await request({action:'transfer',...p});update(result.data);pending=null;say('Transferência de '+money(p.cents)+' registrada. Os dois saldos foram atualizados, sem criar despesa ou receita.');}catch(e){if(pending)pending.saving=false;say(e.message);}render();return true;
  }
  if(pending.stage==='amount'){const cents=transferAmount(text);if(cents>0)pending.cents=cents;else say('Informe um valor maior que zero.');}
  else if(pending.stage==='from'){const row=transferNamed(text,sources());if(row)pending.fromAccountId=row.id;}
  else if(pending.stage==='to'){const row=transferNamed(text,targets().filter(a=>a.id!==pending.fromAccountId));if(row)pending.toAccountId=row.id;}
  question();return true;
 }
 function open(){
  if(!can('entries'))return;
  const data=getState(),sources=data.accounts.filter(a=>!a.deleted),targets=data.transferTargets||sources;
  if(!dialog){dialog=document.createElement('dialog');dialog.innerHTML='<form id="transferForm"><h2>Transferir entre contas</h2><label for="transferFrom">De qual conta sai?</label><select id="transferFrom" required></select><label for="transferTo">Para qual conta vai?</label><select id="transferTo" required></select><label for="transferAmount">Valor (R$)</label><input id="transferAmount" inputmode="decimal" required><label for="transferDate">Data</label><input id="transferDate" type="date" required><p class="muted">Atualiza os dois saldos sem contar como gasto ou receita. O saldo particular da outra pessoa permanece privado. Registra no app; não envia dinheiro pelo banco.</p><p id="transferError" class="error" role="alert"></p><button id="transferSave" type="submit">Confirmar transferência</button><button id="transferCancel" class="secondary" type="button">Cancelar</button></form>';document.body.append(dialog);
   document.getElementById('transferCancel').onclick=()=>dialog.close();
   document.getElementById('transferForm').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('transferSave');if(button.disabled||!can('entries'))return;button.disabled=true;const error=document.getElementById('transferError');error.textContent='';
    try{const result=await request({action:'transfer',id,fromAccountId:document.getElementById('transferFrom').value,toAccountId:document.getElementById('transferTo').value,cents:moneyCents(document.getElementById('transferAmount').value),date:document.getElementById('transferDate').value});update(result.data);dialog.close();render();}catch(e){error.textContent=e.message;}finally{button.disabled=false;}
   };
  }
  id=crypto.randomUUID();document.getElementById('transferForm').reset();
  document.getElementById('transferFrom').innerHTML='<option value="">Selecione sua conta</option>'+sources.map(a=>'<option value="'+a.id+'">'+escape(a.name)+(a.ownerUserId?' · Particular':' · Compartilhada')+'</option>').join('');
  document.getElementById('transferTo').innerHTML='<option value="">Selecione o destino</option>'+targets.map(a=>'<option value="'+a.id+'">'+escape(a.name)+(a.private?' · '+escape(a.ownerName||'Particular'):' · Compartilhada')+'</option>').join('');
  document.getElementById('transferAmount').value=money(0);bindMoneyInput(document.getElementById('transferAmount'));document.getElementById('transferDate').value=today();document.getElementById('transferError').textContent=sources.length&&targets.length>1?'':'Cadastre duas contas para registrar uma transferência.';dialog.showModal();
 }
 return {handle,bind(){document.querySelectorAll('[data-transfer-open]').forEach(b=>{b.hidden=!can('entries');b.onclick=open;});},reset(){dialog?.close();pending=null;}};
}
