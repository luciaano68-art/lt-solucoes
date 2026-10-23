import {parseReceipt,receiptDate,receiptMoney,receiptDuplicates} from './receipt-reader.js';
import {receiptImage,recognizeReceipt,warmReceiptReader,releaseReceiptReader} from './receipt-ocr.js';
import {receiptPaymentOptions,suggestedReceiptPayment,receiptPurchase} from './receipt-flow.js';
import {categories} from './conversation.js';
export function receiptDetailsHTML(data,escape,money){
 if(!data)return '';
 const rows=[['Estabelecimento',data.merchant],['CNPJ',data.cnpj],['Documento',data.documentNumber],['Data na notinha',[data.date?.split('-').reverse().join('/'),data.time].filter(Boolean).join(' ')],['Pagamento impresso',data.paymentMethod],['Final do cartão',data.cardLast4],['Parcelas impressas',data.installments]];
 for(const [key,label] of [['totalCents','Total lido'],['subtotalCents','Subtotal'],['discountCents','Desconto'],['feesCents','Acréscimos / frete'],['taxesCents','Tributos informativos'],['tenderedCents','Valor entregue'],['changeCents','Troco']])if(data[key]!=null)rows.push([label,money(data[key])]);
 return '<details class="receipt-data"><summary>Dados reconhecidos da notinha</summary><p class="muted">Leitura por foto, sujeita a erros. O valor do lançamento é o que você confirmou.</p><dl>'+rows.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>'<div><dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd></div>').join('')+'</dl>'+(data.items?.length?'<h4>Linhas de produtos reconhecidas</h4><ul>'+data.items.map(i=>'<li>'+escape(i.line)+'</li>').join('')+'</ul>':'')+'<details><summary>Texto completo reconhecido</summary><pre>'+escape(data.rawText)+'</pre></details></details>';
}

export function createReceiptScanUI({getState,can,api,setState,render,toast,escape,money,onSaved=()=>{},hasFlow=()=>false}){
 const $=id=>document.getElementById(id);
 let image=null,note=null,fields=null,purchaseId=null,epoch=0,controller=null,working=false,saving=false,editingBasics=false,displayedPlan='',queue=[];
 const dateLabel=d=>d?d.split('-').reverse().join('/'):'Data não identificada';
 const cash=n=>n==null?'':(n/100).toFixed(2).replace('.',',');
 function dialog(){let el=$('receiptScan');if(!el){el=document.createElement('dialog');el.id='receiptScan';document.body.append(el);}return el;}
 function clear(){epoch++;controller?.abort();controller=null;working=false;image=null;note=null;fields=null;purchaseId=null;editingBasics=false;displayedPlan='';}
 function reset(){clear();saving=false;queue=[];releaseReceiptReader();$('receiptScan')?.close();if($('receiptScan'))$('receiptScan').innerHTML='';}
 function close(){if(saving)return;clear();dialog().close();dialog().innerHTML='';}
 function show(){
  if(!can('entries'))return toast('Seu acesso não permite registrar compras.');
  if(hasFlow())return toast('Conclua ou cancele o lançamento em andamento primeiro.');
  if(saving)return;
  clear();paint();dialog().showModal();void warmReceiptReader().catch(()=>{});
 }
 function paint(){
  const ready=!!note,el=dialog();
  el.innerHTML='<div class="dialog-head"><h2>'+(ready?'Confirmar compra':'Ler notinha')+'</h2><button type="button" id="scanClose" class="icon-button" aria-label="Fechar leitura">×</button></div>'+
   (ready?reviewHTML():'<p class="muted">Fotografe a notinha inteira e bem iluminada.</p><div class="scan-actions"><label class="scan-file">Tirar foto<input id="scanCamera" type="file" accept="image/*" capture="environment"></label><label class="scan-file secondary">Escolher foto<input id="scanGallery" type="file" accept="image/*"></label></div><div class="scan-reading" '+(working?'':'hidden')+'><span class="scan-spinner" aria-hidden="true"></span><div><strong>Lendo sua notinha</strong><p id="scanProgress" role="status" aria-live="polite">Identificando valor, local e data…</p></div></div><p id="scanError" class="error" role="alert"></p>'+(working?'<button type="button" id="scanManual" class="secondary">Preencher só valor, local e data</button>':''));
  $('scanClose').onclick=close;el.oncancel=e=>{e.preventDefault();close();};
  if(!ready){
   for(const id of ['scanCamera','scanGallery'])$(id).onchange=e=>{if(e.target.files?.[0])read(e.target.files[0]);};
   if($('scanManual')){$('scanManual').disabled=!image;$('scanManual').onclick=manual;}
  }else bindReview();
 }
 function reviewHTML(){
  const missing=!note.totalCents||!note.date||!note.merchant;
  const basic=(key,label,value,type='text')=>'<div data-basic="'+key+'" '+(!editingBasics&&value?'hidden':'')+'><label for="scan'+key+'">'+label+'</label><input id="scan'+key+'" type="'+type+'" value="'+escape(value||'')+'" '+(key==='Total'?'inputmode="decimal"':key==='Merchant'?'maxlength="300"':'')+' required></div>';
  const options=receiptPaymentOptions(getState()),suggestion=suggestedReceiptPayment(note,getState()),warning=note.confidence!==null&&note.confidence<70?'A foto ficou difícil de ler. Confira o valor e o local.':'';
  const ordered=[...options].sort((a,b)=>(/crédito/i.test(note.paymentMethod)?Number(b.credit)-Number(a.credit):Number(a.credit)-Number(b.credit)));
  return '<form id="scanForm"><div class="scan-summary"><div class="scan-summary-head"><span>Valor da compra</span><button id="scanEdit" type="button" class="text-button">Corrigir</button></div><strong id="scanValue" class="scan-value">'+(note.totalCents?escape(money(note.totalCents)):'Qual foi o valor?')+'</strong><h3 id="scanLocal">'+escape(note.merchant||'Onde foi a compra?')+'</h3><p id="scanWhen">'+escape(dateLabel(note.date))+' · '+escape(note.category||'Outros')+'</p></div>'+
   (missing?'<p class="scan-nudge">Falta só completar o que não consegui ler.</p>':'')+
   (warning?'<p class="scan-nudge">'+warning+'</p>':'')+
   '<div class="scan-basics">'+basic('Total','Valor total (R$)',fields.total)+basic('Merchant','Local da compra',fields.merchant)+basic('Date','Data da compra',fields.date,'date')+'</div>'+
   '<fieldset class="scan-sources"><legend>Como você pagou?</legend><div class="scan-payment-options">'+ordered.map(o=>'<button type="button" data-scan-payment="'+escape(o.value)+'" class="scan-payment" aria-pressed="'+(o.value===fields.payment)+'"><span>'+escape(o.label)+'</span><small>'+(o.credit?'Cartão de crédito':'Conta / Pix / débito / dinheiro')+'</small></button>').join('')+'</div>'+
   (!options.length?'<p class="error">Cadastre uma conta ou um cartão na tela principal.</p>':'')+
   '<p id="scanPaymentHint" class="muted">'+escape(fields.payment===suggestion.value?suggestion.reason:'')+'</p></fieldset>'+
   '<div id="scanPlan" class="scan-plan" aria-live="polite"></div><div id="scanDuplicateNotice"></div>'+
   '<details id="scanMore" class="scan-more"><summary>Mais opções e detalhes da nota</summary><label for="scanCategory">Categoria</label><select id="scanCategory">'+categories.map(c=>'<option '+(c===fields.category?'selected':'')+'>'+escape(c)+'</option>').join('')+'</select><label for="scanParts">Parcelas (1 para à vista)</label><input id="scanParts" type="number" min="1" max="60" value="'+fields.count+'"><label class="scan-check" id="scanUnpaidLabel"><input type="checkbox" id="scanUnpaid">Ainda vou pagar esta compra</label><label for="scanScope">De quem é?</label><select id="scanScope"><option value="casal">Compartilhado</option><option value="luciano">Pessoal</option><option value="yasmin">Outra pessoa</option></select><details class="scan-original"><summary>Ver foto e dados reconhecidos</summary><img id="scanPhoto" class="scan-photo" alt="Foto da notinha">'+receiptDetailsHTML(note,escape,money)+'</details><details><summary>Corrigir o texto da leitura</summary><textarea id="scanRaw" rows="6" maxlength="24000" aria-label="Texto reconhecido"></textarea><button id="scanReparse" type="button" class="secondary">Analisar texto novamente</button></details></details>'+
   '<p id="scanPrepareError" class="error" role="alert"></p><button id="scanConfirm" class="scan-confirm" type="submit">Confirmar compra</button><p class="scan-footnote">A foto fica anexada. Só salva ao confirmar.</p></form>';
 }
 function collect(){
  Object.assign(fields,{total:$('scanTotal').value,merchant:$('scanMerchant').value,date:$('scanDate').value,category:$('scanCategory').value,count:Number($('scanParts').value),unpaid:$('scanUnpaid').checked,scope:$('scanScope').value,duplicateAck:$('scanDuplicate')?.checked||false});
 }
 function bindReview(){
  $('scanPhoto').src=image.photo;$('scanRaw').value=note.rawText;$('scanUnpaid').checked=fields.unpaid;$('scanScope').value=fields.scope;
  $('scanEdit').onclick=()=>{editingBasics=!editingBasics;document.querySelectorAll('#receiptScan [data-basic]').forEach(el=>{const input=el.querySelector('input');el.hidden=!editingBasics&&!!input.value;});$('scanEdit').textContent=editingBasics?'Pronto':'Corrigir';};
  for(const id of ['scanTotal','scanMerchant','scanDate','scanCategory','scanParts','scanUnpaid','scanScope'])$(id).oninput=()=>{collect();updatePreview();};
  document.querySelectorAll('[data-scan-payment]').forEach(b=>b.onclick=()=>{collect();fields.payment=b.dataset.scanPayment;document.querySelectorAll('[data-scan-payment]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));updatePreview();});
  $('scanReparse').onclick=()=>{const payment=fields.payment;note={...parseReceipt($('scanRaw').value,{confidence:note.confidence}),imageHash:image.imageHash};initializeFields(payment);paint();};
  $('scanForm').onsubmit=confirmPurchase;updatePreview();
 }
 function updatePreview(){
  const value=receiptMoney(fields.total),source=receiptPaymentOptions(getState()).find(o=>o.value===fields.payment);
  $('scanValue').textContent=value>0?money(value):'Qual foi o valor?';$('scanLocal').textContent=fields.merchant||'Onde foi a compra?';$('scanWhen').textContent=dateLabel(fields.date)+' · '+fields.category;
  $('scanUnpaidLabel').hidden=!!source?.credit;
  $('scanPaymentHint').textContent=source?(source.credit?'Vai para a fatura de '+source.label:fields.unpaid?'Fica pendente em '+source.label:'Já pago em '+source.label):'Toque em uma opção acima.';
  // Preserve acknowledgement while updating the amount or payment selection.
  const ack=fields.duplicateAck,similar=receiptDuplicates(getState(),{...note,merchant:fields.merchant,date:fields.date,totalCents:value}),samePhoto=similar.some(e=>e.receiptData?.imageHash===note.imageHash);
  $('scanDuplicateNotice').innerHTML=samePhoto?'<p class="scan-warning">Esta foto já foi lançada. Confira os lançamentos.</p>':similar.length?'<div class="scan-warning"><strong>Existe uma compra parecida</strong><label class="scan-check"><input id="scanDuplicate" type="checkbox" '+(ack?'checked':'')+'>Conferi: esta é outra compra.</label></div>':'';
  if($('scanDuplicate'))$('scanDuplicate').onchange=e=>{fields.duplicateAck=e.target.checked;};
  $('scanConfirm').disabled=saving||samePhoto||!source;
  displayedPlan='';let planHTML='';
  try{const p=receiptPurchase(note,{...fields,duplicateAck:true},getState(),purchaseId);displayedPlan=JSON.stringify(p.rows);
   if(p.rows.length>1)planHTML='<strong>'+p.rows.length+' parcelas · total '+escape(money(p.entry.cents))+'</strong><ul>'+p.rows.map(r=>'<li>'+r.number+'/'+p.rows.length+' · '+escape(money(r.cents))+' · '+dateLabel(r.dueDate)+'</li>').join('')+'</ul>';
   else if(p.rows.length)planHTML='Na fatura com vencimento em <strong>'+dateLabel(p.rows[0].dueDate)+'</strong>';
  }catch{}
  $('scanPlan').innerHTML=planHTML;$('scanPlan').hidden=!planHTML;
 }
 function initializeFields(payment=''){
  fields={total:cash(note.totalCents),merchant:note.merchant,date:note.date||'',payment:payment||suggestedReceiptPayment(note,getState()).value,category:note.category||'Outros',count:note.installments||1,unpaid:false,scope:'casal',duplicateAck:false};
 }
 async function read(file){
  const current=++epoch;controller?.abort();controller=new AbortController();working=true;note=null;fields=null;image=null;purchaseId=crypto.randomUUID();paint();
  try{
   const prepared=await receiptImage(file);if(current!==epoch)return;image=prepared;if($('scanManual'))$('scanManual').disabled=false;
   const data=await recognizeReceipt(image.canvas,{signal:controller.signal,onProgress:text=>{if(current===epoch&&$('scanProgress'))$('scanProgress').textContent=text;}});
   if(current!==epoch)return;note={...parseReceipt(data.text,{confidence:data.confidence}),imageHash:image.imageHash};working=false;initializeFields();paint();dialog().scrollTop=0;
  }catch(e){if(current===epoch){working=false;paint();$('scanError').textContent=e.message;if(image){const b=document.createElement('button');b.type='button';b.textContent='Informar só o essencial';b.onclick=manual;$('scanError').after(b);}}}
 }
 function manual(){if(!image)return;epoch++;controller?.abort();working=false;note={...parseReceipt(''),imageHash:image.imageHash};initializeFields();paint();}
 async function confirmPurchase(event){
  event.preventDefault();if(saving||working||!note||!image||!can('entries'))return;
  collect();let prepared;
  try{prepared=receiptPurchase(note,fields,getState(),purchaseId);if(displayedPlan!==JSON.stringify(prepared.rows)){updatePreview();throw Error('A fatura mudou. Confira os vencimentos abaixo e confirme novamente.');}}
  catch(e){$('scanPrepareError').textContent=e.message;return;}
  const current=epoch,upload=image.upload;saving=true;$('scanConfirm').disabled=true;$('scanConfirm').textContent='Salvando…';$('scanPrepareError').textContent='';
  dialog().querySelectorAll('input,select,button,textarea').forEach(el=>el.disabled=true);
  try{
   const response=await api(prepared.request);if(current!==epoch)return;setState(response.data);
   const saved=prepared.request.action==='installmentPurchase'?response.data.entries.find(e=>e.installmentPurchaseId===purchaseId&&e.installmentNumber===1):response.data.entries.find(e=>e.id===purchaseId);
   if(!saved)throw Error('Não consegui localizar o lançamento. Atualize a lista antes de tentar novamente.');
   const item={id:saved.id,upload,status:'uploading',busy:false};queue.push(item);saving=false;close();
   onSaved(saved,prepared);render();toast(prepared.rows.length>1?'Compra parcelada confirmada.':'Compra confirmada.');void uploadPhoto(item);
  }catch(e){if(current===epoch){saving=false;dialog().querySelectorAll('input,select,button,textarea').forEach(el=>el.disabled=false);$('scanConfirm').textContent='Confirmar compra';$('scanPrepareError').textContent=e.message;updatePreview();}}
 }
 async function uploadPhoto(item){
  if(item.busy||!queue.includes(item)||!can('entries'))return;item.busy=true;item.status='uploading';
  try{
   const entry=getState().entries.find(e=>e.id===item.id&&!e.deleted);if(!entry)throw Error('Lançamento indisponível.');
   const response=await api({action:'receiptUpload',id:item.id,version:entry.version,...item.upload});
   // New scans may change epoch; logout/reset removes the item from the queue.
   if(!queue.includes(item))return;
   const current=getState(),row=current.entries.find(e=>e.id===item.id),uploaded=response.data.entries.find(e=>e.id===item.id);
   if(row&&uploaded&&row.version===entry.version)setState({...current,entries:current.entries.map(e=>e.id===item.id?{...e,receipt:uploaded.receipt,version:uploaded.version,updatedAt:uploaded.updatedAt,updatedBy:uploaded.updatedBy}:e)});
   queue=queue.filter(x=>x!==item);render();
  }catch{if(queue.includes(item)){item.status='error';render();toast('Compra salva. Você pode tentar anexar a foto novamente.');}}
  finally{item.busy=false;}
 }
 function banner(){return queue.filter(x=>x.status==='error').map(item=>'<div class="card scan-warning"><p>Compra salva. Falta anexar a foto.</p><button data-scan-retry="'+escape(item.id)+'">Tentar anexar foto</button><button data-scan-drop="'+escape(item.id)+'" class="secondary">Dispensar foto</button></div>').join('');}
 function bind(){
  document.querySelectorAll('[data-scan-receipt]').forEach(b=>{b.hidden=!can('entries');b.onclick=show;});
  document.querySelectorAll('[data-scan-retry]').forEach(b=>b.onclick=()=>{const item=queue.find(x=>x.id===b.dataset.scanRetry);if(item){b.disabled=true;void uploadPhoto(item);}});
  document.querySelectorAll('[data-scan-drop]').forEach(b=>b.onclick=()=>{queue=queue.filter(x=>x.id!==b.dataset.scanDrop);render();});
 }
 // Editor compatibility: photos now confirm here; existing receipt edits use their saved metadata.
 return {show,bind,reset,banner,fields:()=>({}),afterSave:async()=>{},cancelPending:()=>{},get isBusy(){return working||saving},get hasUnsaved(){return !!(queue.length||working||saving||$('receiptScan')?.open)}};
}
