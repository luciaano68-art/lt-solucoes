import {normalize,moneyCents} from './conversation.js';
import {bindMoneyInput} from './money-input.js';
import {investmentEstimate} from './investments.js';
import {investmentIntent,namedChoice} from './investment-chat.js';
export function createInvestmentsUI({getState,can,request,update,render,say,money,escape,today,go,hasOtherFlow}){
 let pending=null,saving=false,dialog=null,formId=null;
 const investments=()=>getState().investments||[],accounts=()=>getState().accounts.filter(a=>!a.deleted);
 const date=s=>s?s.split('-').reverse().join('/'):'—';
 const estimateText=(i,value)=>{
  const e=investmentEstimate(i,value),pct=e.percent===null?'Com aportes ou resgates no período, não estimo uma porcentagem.':(e.percent<0?'Variação estimada: ':'Rendimento estimado: ')+e.percent.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%.';
  return (e.gainCents<0?'Variação negativa estimada: ':'Rendimento estimado: ')+money(e.gainCents)+', desde '+date(e.from)+'. '+pct+' O app não calcula descontos de impostos ou taxas; o resultado depende do saldo informado e das movimentações registradas.';
 };
 const tell=text=>{say(text);render()};
 function query(text){
  const selected=namedChoice(text,investments()),all=/\b(aplicacoes|investimentos|caixinhas|total|todos|todas)\b/.test(normalize(text));
  const items=selected.length?selected:all?investments():investments().length===1?investments():[];
  if(!investments().length){tell('Você ainda não tem aplicações cadastradas. Toque em Investimentos para cadastrar uma caixinha, poupança ou outra aplicação.');return;}
  if(!items.length){tell('Qual aplicação? Escreva o nome completo: '+investments().map(i=>i.name).join(', ')+'.');pending={kind:'query'};return;}
  tell(items.map(i=>i.name+': '+money(i.balanceCents)+'.').join('\n')+'\nTotal: '+money(items.reduce((v,i)=>v+i.balanceCents,0))+'.\nSaldos informados por você; sem consulta automática ao banco.');pending=null;
 }
 function advance(text=''){
  if(!pending)return;
  if(pending.kind==='query'){query(text);return;}
  if(!investments().length){tell('Cadastre primeiro a aplicação em Investimentos. Informe o saldo que você já tem lá; depois registro este movimento.');return;}
  if(!pending.investmentId){const matches=namedChoice(text,investments());if(matches.length===1)pending.investmentId=matches[0].id;else{tell('Em qual aplicação? Escreva o nome completo: '+investments().map(i=>i.name).join(', ')+'.');return;}}
  const i=investments().find(i=>i.id===pending.investmentId);
  if(!i){pending=null;tell('A aplicação mudou. Comece novamente.');return;}
  if(pending.cents===null||pending.cents===undefined){const m=text.match(/(?:R\$\s*)?(\d[\d.,]*)/i);pending.cents=m?moneyCents(m[1]):null;if(pending.cents===null){tell(pending.kind==='balance'?'Qual é o saldo atual da aplicação?':'Qual o valor? Ex.: 10,00');return;}}
  if(pending.cents<0||(pending.cents===0&&pending.kind!=='balance')){pending.cents=null;tell('Informe um valor válido.');return;}
  if(pending.kind!=='balance'&&!pending.accountId){
   // The investment's bank name is not evidence of the source/destination account.
   const explicit=text.match(pending.kind==='deposit'?/(?:da conta|do banco|saindo de)\s+(.+)/i:/(?:para a conta|para conta|entrou na conta)\s+(.+)/i);
   const matches=namedChoice(pending.awaitingAccount?text:explicit?.[1]||'',accounts());if(matches.length===1)pending.accountId=matches[0].id;
   else{pending.awaitingAccount=true;tell((pending.kind==='deposit'?'De qual conta saiu o dinheiro?':'Em qual conta entrou o resgate?')+' '+(accounts().length?accounts().map(a=>a.name).join(', ')+'. Escreva o nome completo.':'Cadastre uma conta em Contas.'));return;}
  }
  pending.version=i.version;pending.id||=crypto.randomUUID();pending.date||=today();pending.ready=true;
  tell(preview());
 }
 function preview(){if(!pending?.ready)return '';const i=investments().find(i=>i.id===pending.investmentId),a=accounts().find(a=>a.id===pending.accountId);if(!i)return '';
  return pending.kind==='balance'?'Atualizar '+i.name+' de '+money(i.balanceCents)+' para '+money(pending.cents)+'?\n'+estimateText(i,pending.cents):pending.kind==='deposit'?'Aplicar '+money(pending.cents)+' em '+i.name+', saindo de '+a?.name+'? Esta transferência não conta como despesa.':'Resgatar '+money(pending.cents)+' de '+i.name+' para '+a?.name+'? Esta transferência não conta como receita.';
 }
 async function save(){
  if(!pending?.ready||saving)return;saving=true;render();const p={...pending};
  try{const action={deposit:'investmentDeposit',withdraw:'investmentWithdraw',balance:'investmentBalance'}[p.kind];const result=await request({action,id:p.id,investmentId:p.investmentId,accountId:p.accountId,version:p.version,cents:p.cents,date:p.date});update(result.data);pending=null;tell('Confirmado! '+investments().find(i=>i.id===p.investmentId)?.name+': '+money(investments().find(i=>i.id===p.investmentId)?.balanceCents||0)+'.');}
  catch(e){if(e.status===409){pending.ready=false;tell(e.message+' Cancele e comece novamente para conferir os novos valores.');}else tell(e.message+' Você pode tentar confirmar novamente.');}
  finally{saving=false;render();}
 }
 function start(kind,id){if(hasOtherFlow()){tell('Conclua ou cancele o lançamento em andamento antes de movimentar investimentos.');return;}if(!can('accounts')){tell('Seu acesso permite consultar investimentos. Para movimentar, peça a permissão de contas ao administrador.');return;}pending={kind,investmentId:id,cents:null};go('chat');advance();}
 async function handle(text){
  const n=normalize(text),intent=investmentIntent(text);
  if(pending){
   if(/^(cancelar|cancela|nao)[.!?]*$/.test(n)){pending=null;tell('Operação cancelada. Nada foi salvo.');return true;}
   if(pending.ready){if(/^(confirmar|confirmo|sim)[.!?]*$/.test(n))await save();else tell('Confira os dados e confirme, ou escreva cancelar para corrigir.');return true;}
   advance(text);return true;
  }
  if(!intent)return false;
  if(intent.kind==='query'){query(text);return true;}
  if(hasOtherFlow()){tell('Conclua ou cancele o lançamento em andamento antes de movimentar investimentos.');return true;}
  if(!can('accounts')){tell('Peça ao administrador a permissão para alterar contas e aplicações.');return true;}
  pending={...intent};advance(text);return true;
 }
 function bubble(){return pending?'<div class="bubble"><small>Investimentos</small><p>'+escape(pending.ready?preview():'Movimentação em preparação. Responda à pergunta acima.')+'</p>'+(pending.ready?'<button data-invest-confirm '+(saving?'disabled':'')+'>Confirmar '+(pending.kind==='balance'?'saldo':'transferência')+'</button>':'')+'<button data-invest-open class="secondary">Ver investimentos</button><button data-invest-cancel class="text-button" '+(saving?'disabled':'')+'>Cancelar</button></div>':'';}
 function view(){const items=investments(),history=getState().investmentMovements||[];
  return '<div class="page-head"><div><h2>Investimentos</h2><p class="muted">Caixinhas, poupança e outras aplicações</p></div><button data-invest-create>+ Aplicação</button></div><div class="card"><p class="muted">Total guardado</p><div class="metric green" style="font-size:28px;font-weight:750">'+money(items.reduce((v,i)=>v+i.balanceCents,0))+'</div><p class="muted">Aportes e resgates são transferências. Não entram nos gastos ou receitas.</p></div>'+(!items.length?'<div class="card empty"><h3>Seu dinheiro guardado, no seu controle</h3><p>Cadastre sua aplicação e o saldo que já está nela. O saldo inicial não será retirado de uma conta.</p><button data-invest-create>Cadastrar aplicação</button></div>':items.map(i=>'<section class="card"><h3>'+escape(i.name)+'</h3><div class="metric green" style="font-size:26px;font-weight:750">'+money(i.balanceCents)+'</div><p class="muted">Última conferência: '+date(i.checkpointDate)+'</p><div class="form-grid"><button class="secondary" data-invest-deposit="'+i.id+'">Guardar / aplicar</button><button class="secondary" data-invest-withdraw="'+i.id+'">Resgatar</button></div><button class="text-button" data-invest-balance="'+i.id+'">Atualizar saldo e conferir rendimento</button></section>').join(''))+'<div class="card"><h3>Movimentações</h3>'+(history.length?[...history].reverse().slice(0,50).map(m=>'<div class="row"><span>'+date(m.date)+' · '+escape(items.find(i=>i.id===m.investmentId)?.name)+'<br>'+({deposit:'Aporte',withdraw:'Resgate',balance:'Saldo conferido'}[m.kind])+(m.accountId?' · '+escape(accounts().find(a=>a.id===m.accountId)?.name):'')+'</span><strong>'+money(m.cents)+'</strong></div>'+(m.estimate?'<p class="muted">Variação estimada: '+money(m.estimate.gainCents)+(m.estimate.percent!==null?' ('+m.estimate.percent.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%)':' · Sem porcentagem por haver movimentações')+'. Impostos e taxas não calculados.</p>':'')).join(''):'<p class="muted">Os novos aportes, resgates e conferências aparecerão aqui.</p>')+'</div>';
 }
 function openCreate(){
  if(!can('accounts'))return;
  if(!dialog){dialog=document.createElement('dialog');dialog.innerHTML='<form id="investmentCreateForm"><h2>Cadastrar aplicação</h2><label for="investmentName">Nome</label><input id="investmentName" maxlength="80" placeholder="Ex.: Caixinha Nubank" required><label for="investmentVisibility">Quem pode consultar?</label><select id="investmentVisibility"><option value="shared">Compartilhada</option><option value="private">Particular · Só eu vejo</option></select><label for="investmentOpening">Saldo que já está aplicado (R$)</label><input id="investmentOpening" inputmode="decimal" placeholder="R$ 0,00" value="R$ 0,00" required><p class="muted">Informe o saldo atual. Este cadastro não retira dinheiro da sua conta. Para guardar mais, registre um aporte após cadastrar.</p><p id="investmentError" class="error" role="alert"></p><button id="investmentCreateSave" type="submit">Confirmar cadastro</button><button id="investmentCreateCancel" type="button" class="secondary">Cancelar</button></form>';document.body.append(dialog);
   document.getElementById('investmentCreateCancel').onclick=()=>dialog.close();
   document.getElementById('investmentCreateForm').onsubmit=async e=>{e.preventDefault();const button=document.getElementById('investmentCreateSave');if(button.disabled)return;button.disabled=true;
    try{const result=await request({action:'investmentCreate',id:formId,name:document.getElementById('investmentName').value,visibility:document.getElementById('investmentVisibility').value,cents:moneyCents(document.getElementById('investmentOpening').value),date:today()});update(result.data);dialog.close();render();if(pending&&!pending.investmentId){pending.investmentId=formId;advance();}}
    catch(e){document.getElementById('investmentError').textContent=e.message}finally{button.disabled=false};
   };
  }
  formId=crypto.randomUUID();document.getElementById('investmentCreateForm').reset();document.getElementById('investmentOpening').value=money(0);bindMoneyInput(document.getElementById('investmentOpening'));document.getElementById('investmentError').textContent='';dialog.showModal();
 }
 function bind(){document.querySelectorAll('[data-invest-open]').forEach(b=>b.onclick=()=>go('investments'));document.querySelectorAll('[data-invest-create]').forEach(b=>{b.hidden=!can('accounts');b.onclick=openCreate});for(const kind of ['deposit','withdraw','balance'])document.querySelectorAll('[data-invest-'+kind+']').forEach(b=>{b.hidden=!can('accounts');b.onclick=()=>start(kind,b.getAttribute('data-invest-'+kind))});document.querySelectorAll('[data-invest-confirm]').forEach(b=>b.onclick=save);document.querySelectorAll('[data-invest-cancel]').forEach(b=>b.onclick=()=>{if(saving)return;pending=null;tell('Operação cancelada. Nada foi salvo.');});}
 return {handle,bubble,view,bind,get active(){return !!pending},reset(){pending=null;dialog?.close()}};
}
