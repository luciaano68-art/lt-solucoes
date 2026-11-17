(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css='@page{size:80mm 55mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;width:80mm;color:#000;background:white;font-family:Arial,sans-serif}.ticket{width:80mm;height:55mm;padding:3mm 4mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;break-after:page;page-break-after:always;overflow:hidden}.ticket:last-child{break-after:auto;page-break-after:auto}.event{font-size:11px;line-height:1.15;font-weight:bold;max-height:8mm;overflow:hidden}.sector{font-size:18px;font-weight:900;border-block:1px dashed #000;padding:2mm 0;width:100%;line-height:1.1}.product{font-size:26px;line-height:1.05;font-weight:900;overflow-wrap:anywhere}.price{font-size:14px;font-weight:bold}.code{font:11px monospace}.foot{font-size:9px}.copy{font-size:12px;font-weight:bold;border:1px solid #000;padding:1mm 3mm}';
function body(tickets){return tickets.map(t=>'<section class="ticket"><div class="event">'+escape(t.event)+'</div><div class="sector" style="font-size:'+(t.sector.length>22?14:18)+'px">'+escape(t.sector.toUpperCase())+'</div><div class="product" style="font-size:'+(t.product.length>45?16:t.product.length>28?20:26)+'px">'+escape(t.product)+'</div><div class="price">'+(t.cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</div>'+(t.reprint?'<div class="copy">2ª VIA · MESMO CÓDIGO</div>':'')+'<div class="code">'+escape(t.code)+'</div><div class="foot">'+t.position+'/'+t.total+' · '+(t.test?'TESTE — SEM VALOR':'1 FICHA = 1 UNIDADE')+'</div></section>').join('');}
function documentHTML(tickets){return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fichas 80 mm</title><style>'+css+'</style></head><body>'+body(tickets)+'</body></html>';}
function appLink(tickets){return 'print://escpos.org/escpos/net/print?srcTp=uri&srcObj=html&numCopies=1&src='+encodeURIComponent('data:text/html;charset=utf-8,'+encodeURIComponent(documentHTML(tickets)));}
function start(tickets,mode='auto'){
 if(!tickets.length)throw Error('Nenhuma ficha para imprimir.');const android=/Android/i.test(navigator.userAgent),direct=mode==='escpos'||mode==='auto'&&android;
 const area=document.getElementById('printArea');area.innerHTML=body(tickets);document.documentElement.dataset.printing='true';
 if(direct){if(!android)throw Error('O modo ESC/POS direto é para Android. Escolha Impressão do sistema neste aparelho.');const url=appLink(tickets);if(url.length>450000)throw Error('Lote grande demais para impressão direta. Use a impressão do sistema.');root.location.href=url;return 'escpos';}
 root.print();return 'system';
}
function test(mode='auto'){const rows=[{event:'TESTE DE IMPRESSÃO',sector:'BEBIDAS',product:'FICHA 1',cents:0,code:'TESTE-001',position:1,total:2,test:true},{event:'TESTE DE IMPRESSÃO',sector:'COZINHA',product:'FICHA 2',cents:0,code:'TESTE-002',position:2,total:2,test:true}];start(rows,mode);}
root.FichasPrint=Object.freeze({css,body,documentHTML,appLink,start,test});
})(window);
