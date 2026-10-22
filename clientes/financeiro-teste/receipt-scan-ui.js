import {parseReceipt,receiptDate,receiptMoney,receiptDuplicates} from './receipt-reader.js';
import {validateReceiptData} from './receipt-data.js';
import {receiptImage,recognizeReceipt} from './receipt-ocr.js';
import {categories} from './conversation.js';
const amount=n=>n==null?'':(n/100).toFixed(2).replace('.',',');
export function receiptDetailsHTML(data,escape,money){
 if(!data)return '';
 const rows=[['Estabelecimento',data.merchant],['CNPJ',data.cnpj],['Documento',data.documentNumber],['Data na notinha',[data.date?.split('-').reverse().join('/'),data.time].filter(Boolean).join(' ')],['Pagamento impresso',data.paymentMethod],['Final do cartão',data.cardLast4],['Parcelas impressas',data.installments]];
 for(const [key,label] of [['totalCents','Total lido'],['subtotalCents','Subtotal'],['discountCents','Desconto'],['feesCents','Acréscimos / frete'],['taxesCents','Tributos informativos'],['tenderedCents','Valor entregue'],['changeCents','Troco']])if(data[key]!=null)rows.push([label,money(data[key])]);
 return '<details class="receipt-data"><summary>Dados reconhecidos da notinha</summary><p class="muted">Leitura por foto, sujeita a erros. O valor do lançamento é o que você confirmou.</p><dl>'+rows.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>'<div><dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd></div>').join('')+'</dl>'+(data.items?.length?'<h4>Linhas de produtos reconhecidas</h4><ul>'+data.items.map(i=>'<li>'+escape(i.line)+'</li>').join('')+'</ul>':'')+'<details><summary>Texto completo reconhecido</summary><pre>'+escape(data.rawText)+'</pre></details></details>';
}
export function createReceiptScanUI({getState,can,api,setState,render,toast,escape,money,openEntry,onPrepared,prepareInstallments,hasFlow,isPreparedCurrent=()=>true}){
 const $=id=>document.getElementById(id);let image=null,result=null,pending=null,epoch=0,controller=null,working=false;
 const dialog=()=>{
  let el=$('receiptScan');if(el)return el;el=document.createElement('dialog');el.id='receiptScan';document.body.append(el);return el;
 };
 function reset(){epoch++;controller?.abort();controller=null;image=null;result=null;pending=null;working=false;$('receiptScan')?.close();if($('receiptScan'))$('receiptScan').innerHTML='';}
 function close(){epoch++;controller?.abort();controller=null;working=false;image=null;result=null;dialog().close();dialog().innerHTML='';}
 function show(){
  if(!can('entries'))return toast('Seu acesso não permite registrar compras.');
  if(pending)return toast(pending.savedId?'A foto anterior ainda precisa ser anexada. Use “Tentar anexar foto”.':'Conclua ou cancele a conferência anterior.');
  if(hasFlow())return toast('Conclua ou cancele o lançamento em andamento antes de ler outra notinha.');
  image=null;result=null;paint();dialog().showModal();
 }
 function paint(){
  const el=dialog();el.innerHTML='<div class="dialog-head"><h2>Ler notinha</h2><button type="button" id="scanClose" class="icon-button" aria-label="Fechar leitura">×</button></div><p class="muted">Fotografe a notinha inteira, reta e bem iluminada. Você confere todos os dados antes de salvar.</p><div class="scan-actions"><label class="scan-file">Tirar foto<input id="scanCamera" type="file" accept="image/*" capture="environment"></label><label class="scan-file secondary">Escolher foto<input id="scanGallery" type="file" accept="image/*"></label></div><p class="muted">A leitura acontece neste aparelho. A foto será anexada ao lançamento após sua confirmação. A primeira leitura precisa de internet para carregar o leitor.</p>'+(image?'<img class="scan-photo" id="scanPhoto" alt="Foto da notinha para conferir">':'')+'<p id="scanProgress" role="status" aria-live="polite"></p><p id="scanError" class="error" role="alert"></p>'+(result?formHTML():'');
  if(image)$('scanPhoto').src=image.photo;
  $('scanClose').onclick=close;el.oncancel=e=>{e.preventDefault();close();};
  for(const id of ['scanCamera','scanGallery'])$(id).onchange=e=>{if(e.target.files?.[0])read(e.target.files[0]);};
  if(result){$('scanRaw').value=result.rawText;$('scanReparse').onclick=()=>{result=parseReceipt($('scanRaw').value,{confidence:result.confidence});paint();};$('scanForm').onsubmit=prepare;}
 }
 function formHTML(){
  const field=(id,label,value='',type='text',required=false)=>'<label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" value="'+escape(value||'')+'" '+(required?'required':'')+' '+(type==='text'?'maxlength="300"':'')+'>';
  const data=getState();return '<form id="scanForm"><h3>Confira a leitura</h3><p class="scan-warning">'+escape(result.warnings.join(' ')||'Confira os dados com a foto. Reconhecimento automático pode errar.')+'</p>'+field('scanMerchant','Estabelecimento / descrição',result.merchant,'text',true)+field('scanTotal','Total da compra (R$)',amount(result.totalCents),'text',true)+field('scanDate','Data da compra',result.date,'date',true)+'<div class="form-grid"><div>'+field('scanCnpj','CNPJ',result.cnpj)+'</div><div>'+field('scanDoc','Número da nota / cupom',result.documentNumber)+'</div></div><label for="scanCategory">Categoria sugerida</label><select id="scanCategory">'+categories.map(c=>'<option '+(c===result.category?'selected':'')+'>'+escape(c)+'</option>').join('')+'</select><p>Pagamento impresso: <strong>'+escape(result.paymentMethod||'Não identificado')+'</strong>'+(result.cardLast4?' · final '+escape(result.cardLast4):'')+(result.installments?' · '+result.installments+' parcelas':'')+'.</p><label for="scanPayment">De qual conta ou cartão? Confira e selecione</label><select id="scanPayment" required><option value="">Selecione…</option>'+data.accounts.filter(a=>!a.deleted).map(a=>'<option value="account:'+escape(a.id)+'">Conta / dinheiro · '+escape(a.name)+'</option>').join('')+(data.cards||[]).filter(c=>!c.deleted).map(c=>'<option value="card:'+escape(c.id)+'">Crédito · '+escape(c.name)+'</option>').join('')+'</select><label for="scanStatus">Situação da compra</label><select id="scanStatus" required><option value="">Selecione…</option><option value="paid">Já paguei (conta / dinheiro)</option><option value="pending">A pagar / compra na fatura</option></select><label for="scanParts">Quantidade de parcelas (1 para à vista)</label><input id="scanParts" type="number" min="1" max="60" value="'+(result.installments||1)+'" required><p class="muted">Informe o valor total da compra acima. Com mais de uma parcela, você confere os valores e vencimentos antes de confirmar.</p>'+receiptDetailsHTML(result,escape,money)+'<details><summary>Corrigir o texto reconhecido</summary><p class="muted">Ajuste a leitura e toque em “Analisar texto novamente”. Isso recalcula os campos acima.</p><textarea id="scanRaw" rows="10" maxlength="24000" aria-label="Texto reconhecido da notinha"></textarea><button id="scanReparse" type="button" class="secondary">Analisar texto novamente</button></details><label class="scan-check"><input id="scanDuplicate" type="checkbox"> Se já existe uma compra parecida, conferi e esta é outra compra.</label><p id="scanPrepareError" class="error" role="alert"></p><button type="submit">Conferir lançamento</button><p class="muted">Nada será salvo nesta etapa. Você verá o valor e a fatura de cada parcela antes de confirmar.</p></form>';
 }
 async function read(file){
  const generation=++epoch;controller?.abort();controller=new AbortController();working=true;result=null;image=null;paint();$('scanProgress').textContent='Preparando a foto…';
  try{const prepared=await receiptImage(file);if(generation!==epoch)return;image=prepared;paint();$('scanProgress').textContent='Carregando o leitor…';const data=await recognizeReceipt(image.canvas,{signal:controller.signal,onProgress:t=>{if(generation===epoch)$('scanProgress').textContent=t;}});if(generation!==epoch)return;result=parseReceipt(data.text,{confidence:data.confidence});working=false;paint();if(!data.text.trim())$('scanError').textContent='Não encontrei texto legível. Tente outra foto.';}
  catch(e){if(generation===epoch){working=false;paint();$('scanError').textContent=e.message;}}
 }
 function prepare(event){
  event.preventDefault();if(working||!image||!result||!can('entries'))return;
  try{
   const cents=receiptMoney($('scanTotal').value),date=$('scanDate').value,merchant=$('scanMerchant').value.trim(),payment=$('scanPayment').value,status=$('scanStatus').value;
   if(!cents||cents<0)throw Error('Informe o total correto da compra.');if(!receiptDate(date))throw Error('Informe a data correta da compra.');if(!merchant)throw Error('Informe o estabelecimento.');if(!payment||!status)throw Error('Escolha a conta ou cartão e a situação.');
   const count=Number($('scanParts').value);if(!Number.isInteger(count)||count<1||count>60)throw Error('Informe de 1 a 60 parcelas. O valor acima deve ser o total da compra.');
   const credit=payment.startsWith('card:'),id=payment.slice(payment.indexOf(':')+1),data=getState();
   if(!(credit?(data.cards||[]):data.accounts).some(a=>a.id===id&&!a.deleted))throw Error('Conta ou cartão indisponível.');
   if(credit&&status!=='pending')throw Error('Compras no crédito entram na fatura. Escolha “A pagar / compra na fatura”.');
   if(count>1&&!credit)throw Error('Para distribuir parcelas entre faturas, selecione um cartão de crédito.');
   if(count>cents)throw Error('O valor deve permitir pelo menos R$ 0,01 por parcela.');
   const details=validateReceiptData({...result,merchant,date,totalCents:cents,installments:count,cnpj:$('scanCnpj').value.trim(),documentNumber:$('scanDoc').value.trim(),imageHash:image.imageHash});
   const duplicates=receiptDuplicates(data,details);
   if(duplicates.some(e=>e.receiptData?.imageHash===image.imageHash))throw Error('Esta foto já foi usada em um lançamento. Confira os lançamentos antes de registrar novamente.');
   if(duplicates.length&&!$('scanDuplicate').checked)throw Error('Já existe uma compra parecida nesta data e valor. Confira a lista e marque a opção acima somente se for outra compra.');
   const entry={id:crypto.randomUUID(),kind:'expense',cents,description:merchant,date,dueDate:date,paidDate:status==='paid'?date:null,status,category:$('scanCategory').value,scope:'casal',...(credit?{credit:true,cardId:id}:{accountId:id}),receiptData:details};
   pending={id:entry.id,details,upload:image.upload};close();if(count>1)prepareInstallments({...entry,count});else{onPrepared(entry);openEntry(entry,true);}
  }catch(e){$('scanPrepareError').textContent=e.message;}
 }
 function fields(id){return pending?.id===id?{receiptData:pending.details}:{};}
 async function afterSave(id,savedId=id){
  if(pending?.id!==id)return;pending.savedId=savedId;const generation=epoch;
  try{const entry=getState().entries.find(e=>e.id===savedId&&!e.deleted);if(!entry)throw Error('Lançamento indisponível.');const saved=await api({action:'receiptUpload',id:savedId,version:entry.version,...pending.upload});if(generation!==epoch)return;setState(saved.data);pending=null;toast('Lançamento salvo com a foto da notinha.');}
  catch{if(generation===epoch){toast('Lançamento salvo. A foto ainda não foi anexada; use “Tentar anexar foto”.');render();}}
 }
 function cancelPending(){if(pending&&!pending.savedId)pending=null;}
 function banner(){return pending?.savedId?'<div class="card scan-warning"><p>O lançamento foi salvo. A foto ainda precisa ser anexada.</p><button data-scan-retry>Tentar anexar foto</button><button data-scan-drop class="secondary">Dispensar foto</button></div>':'';}
 function bind(){if(pending&&!pending.savedId&&!isPreparedCurrent(pending.id))pending=null;document.querySelectorAll('[data-scan-receipt]').forEach(b=>{b.hidden=!can('entries');b.onclick=show;});document.querySelectorAll('[data-scan-retry]').forEach(b=>b.onclick=async()=>{b.disabled=true;await afterSave(pending?.id,pending?.savedId);render();});document.querySelectorAll('[data-scan-drop]').forEach(b=>b.onclick=()=>{if(confirm('Manter o lançamento e dispensar o anexo desta foto?')){pending=null;render();}});}
 return {show,bind,reset,fields,afterSave,cancelPending,banner,get isBusy(){return working},get hasUnsaved(){return !!(pending||working||$('receiptScan')?.open)}};
}
