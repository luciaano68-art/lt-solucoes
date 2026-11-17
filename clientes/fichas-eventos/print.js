(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Small, self-contained document. One request contains every ticket in the sale.
const css='@page{size:80mm 55mm;margin:0}html,body{margin:0;padding:0;width:80mm;color:#000;background:#fff;font:13px Arial,sans-serif}.ft{box-sizing:border-box;position:relative;width:80mm;height:55mm;padding:3mm 4mm 12mm;text-align:center;overflow:hidden;break-after:page;page-break-after:always}.ft:last-child{break-after:auto;page-break-after:auto}.ft>*{margin:0;color:inherit}.ft header{font-size:10px;line-height:1.15;max-height:7mm;overflow:hidden}.ft h2{font-size:16px;line-height:1.1;border-bottom:1px dashed;padding:1.5mm 0 1mm}.ft h1{font-size:24px;line-height:1.05;overflow-wrap:anywhere;max-height:17mm;overflow:hidden;padding-top:1mm;letter-spacing:0}.ft.long h1{font-size:16px}.ft.long h2{font-size:14px}.ft b{display:block;padding-top:1.5mm}.ft p{font-size:10px;font-weight:bold}.ft code,.ft small{position:absolute;left:4mm;right:4mm}.ft code{bottom:7mm;font:10px monospace}.ft small{bottom:3mm;font-size:9px}';
function body(tickets){let html='';for(const t of tickets)html+='<section class="ft'+(t.product.length>28||t.sector.length>22?' long':'')+'"><header>'+escape(t.event)+'</header><h2>'+escape(t.sector.toUpperCase())+'</h2><h1>'+escape(t.product)+'</h1><b>'+(t.cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</b>'+(t.reprint?'<p>2ª VIA · MESMO CÓDIGO</p>':'')+'<code>'+escape(t.code)+'</code><small>'+t.position+'/'+t.total+' · '+(t.test?'TESTE — SEM VALOR':'1 FICHA = 1 UNIDADE')+'</small></section>';return html;}
function documentHTML(tickets){return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Fichas 80 mm</title><style>'+css+'</style><body>'+body(tickets)+'</body></html>';}
function appLink(tickets){return 'print://escpos.org/escpos/net/print?srcTp=uri&srcObj=html&numCopies=1&src='+encodeURIComponent('data:text/html;charset=utf-8,'+encodeURIComponent(documentHTML(tickets)));}
let lastJob=null;
function start(tickets,mode='auto'){
 if(!Array.isArray(tickets)||!tickets.length)throw Error('Nenhuma ficha para imprimir.');
 const began=Date.now(),android=/Android/i.test(navigator.userAgent),direct=mode==='escpos'||mode==='auto'&&android;
 if(direct){
  if(!android)throw Error('O modo ESC/POS direto é para Android. Escolha Impressão do sistema neste aparelho.');
  const url=appLink(tickets);
  if(url.length>450000)throw Error('Lote grande demais para impressão direta. Use a impressão do sistema.');
  lastJob={mode:'escpos',tickets:tickets.length,payloadChars:url.length,prepareMs:Date.now()-began};
  root.location.href=url;return 'escpos';
 }
 // Build DOM only when actually using the system print dialog.
 let style=document.getElementById('ticketPrintStyle');
 if(!style){style=document.createElement('style');style.id='ticketPrintStyle';style.media='print';document.head.appendChild(style);}
 style.textContent=css;document.getElementById('printArea').innerHTML=body(tickets);
 lastJob={mode:'system',tickets:tickets.length,prepareMs:Date.now()-began};
 root.print();return 'system';
}
function test(mode='auto'){const rows=[{event:'TESTE DE IMPRESSÃO',sector:'BEBIDAS',product:'FICHA 1',cents:0,code:'TESTE-001',position:1,total:2,test:true},{event:'TESTE DE IMPRESSÃO',sector:'COZINHA',product:'FICHA 2',cents:0,code:'TESTE-002',position:2,total:2,test:true}];return start(rows,mode);}
root.FichasPrint=Object.freeze({css,body,documentHTML,appLink,start,test,metrics:()=>lastJob&&{...lastJob}});
})(window);
