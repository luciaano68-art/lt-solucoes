(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Normal-flow fields: no clipped names, absolute footers or hidden overflow.
const css='@page{size:80mm 55mm;margin:0}html,body{margin:0!important;padding:0!important;width:80mm!important;background:#fff!important;color:#000!important;font-family:Arial,sans-serif}.ft{box-sizing:border-box;width:80mm;min-height:54mm;padding:2mm 4mm;text-align:center;break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid}.ft:last-child{break-after:auto;page-break-after:auto}.ft>*{display:block;margin:0;padding:0;color:#000;overflow:visible;white-space:normal;overflow-wrap:anywhere;word-break:break-word;letter-spacing:0}.ft header{font-size:9px;line-height:1.15;font-weight:bold}.ft h2{font-size:16px;line-height:1.1;font-weight:bold;border-bottom:1px dashed #000;padding:1.2mm 0;margin-bottom:1mm}.ft h1{font-size:23px;line-height:1.05;font-weight:bold;margin-bottom:1mm}.ft.long h1{font-size:14px}.ft.long h2{font-size:12px}.ft b{font-size:13px;line-height:1.15;margin:1mm 0}.ft p{font-size:9px;font-weight:bold;line-height:1.1;margin:1mm 0}.ft code{font:9px/1.15 monospace;margin-top:1.3mm}.ft small{font:8px/1.15 Arial,sans-serif;margin-top:1mm}';
function body(tickets){return tickets.map(t=>'<section class="ft'+(t.product.length>25||t.sector.length>22?' long':'')+'"><header>'+escape(t.event)+'</header><h2>'+escape(t.sector.toUpperCase())+'</h2><h1>'+escape(t.product)+'</h1><b>'+(t.cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</b>'+(t.reprint?'<p>2ª VIA · MESMO CÓDIGO</p>':'')+'<code>'+escape(t.code)+'</code><small>'+t.position+'/'+t.total+' · '+(t.test?'TESTE — SEM VALOR':'1 FICHA = 1 UNIDADE')+'</small></section>').join('');}
function documentHTML(tickets){return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fichas 80 mm</title><style>'+css+'</style></head><body>'+body(tickets)+'</body></html>';}
function appLink(tickets){return 'print://escpos.org/escpos/net/print?srcTp=uri&srcObj=html&numCopies=1&src='+encodeURIComponent('data:text/html;charset=utf-8,'+encodeURIComponent(documentHTML(tickets)));}
function directLink(tickets){if(!/Android/i.test(navigator.userAgent))throw Error('A impressão direta exige Android e o app ESC/POS Network instalado.');const url=appLink(tickets);if(url.length>120000)throw Error('Use a impressão compatível para este lote grande.');return url;}
let busy=false,lastJob=null;
function readyForLayout(){return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve();};const timer=setTimeout(finish,180);if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(()=>root.requestAnimationFrame(finish));});}
async function start(tickets,mode='auto'){
 if(!Array.isArray(tickets)||!tickets.length)throw Error('Nenhuma ficha para imprimir.');
 if(busy)throw Error('Já existe uma impressão sendo preparada. Aguarde e tente novamente pelo histórico.');
 const began=Date.now();
 if(mode==='escpos'){
  const url=directLink(tickets);
  if(navigator.userActivation&&navigator.userActivation.isActive===false)throw Error('Toque em “Enviar ao ESC/POS” para autorizar a abertura do app da impressora.');
  lastJob={mode:'escpos',tickets:tickets.length,payloadChars:url.length,prepareMs:Date.now()-began};
  root.location.href=url;return 'escpos';
 }
 busy=true;
 try{
  let style=document.getElementById('ticketPrintStyle');
  if(!style){style=document.createElement('style');style.id='ticketPrintStyle';style.media='print';document.head.appendChild(style);}
  const area=document.getElementById('printArea');if(!area)throw Error('Atualize o aplicativo com internet e tente novamente pelo histórico.');
  style.textContent=css;area.innerHTML=body(tickets);
  // Let layout settle before Android snapshots the print document.
  await readyForLayout();
  if(typeof root.print!=='function')throw Error('Este navegador não permite imprimir. Abra o aplicativo pelo Chrome.');
  lastJob={mode:'system',tickets:tickets.length,prepareMs:Date.now()-began};
  root.print();return 'system';
 }finally{busy=false;}
}
function test(mode='auto'){return start([{event:'TESTE DE IMPRESSÃO',sector:'BEBIDAS',product:'FICHA 1',cents:0,code:'TESTE-001',position:1,total:2,test:true},{event:'TESTE DE IMPRESSÃO',sector:'COZINHA',product:'FICHA 2 — CONFERIR TEXTO COMPLETO E CORTE',cents:0,code:'TESTE-002',position:2,total:2,test:true}],mode);}
root.FichasPrint=Object.freeze({css,body,documentHTML,appLink,directLink,start,test,metrics:()=>lastJob&&{...lastJob}});
})(window);
