const CACHE_NAME='lt-tessaro-gestao-dev-v1';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

const FIADOS_OPEN_INVOICES_SCRIPT=`<script>
(function(){
  if(window.__tessaroOpenInvoicesV41) return;
  window.__tessaroOpenInvoicesV41=true;

  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const safe=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const periodLabel=p=>{const m=String(p||'').match(/^(\\d{4})-(\\d{2})$/);return m?m[2]+'/'+m[1]:String(p||'-');};

  function getRows(){
    try{
      const data=ensureFiadosData();
      const customers=Array.isArray(data.customers)?data.customers:[];
      const invoices=(Array.isArray(data.invoices)?data.invoices:[]).filter(inv=>inv.status!=='cancelled'&&Number(inv.amount||0)>0.005);
      const periods=[...new Set(invoices.map(inv=>String(inv.period||'')).filter(Boolean))].sort().reverse();
      const period=periods[0]||'';
      const selected=invoices.filter(inv=>String(inv.period||'')===period);
      return selected.map(inv=>{
        const statementDate=String(inv.statementDate||'');
        const after=(data.transactions||[]).filter(t=>String(t.customerId||'')===String(inv.customerId||'')&&(!statementDate||String(t.date||'')>statementDate)&&t.hiddenFromMonthly!==true);
        const payments=after.filter(t=>t.type==='payment'||t.type==='credit').reduce((s,t)=>s+Number(t.amount||0),0);
        const original=Math.max(0,Number(inv.amount||0));
        const open=Math.max(0,Number((original-payments).toFixed(2)));
        const customer=customers.find(c=>String(c.id)===String(inv.customerId))||{id:inv.customerId,name:'Cliente'};
        return {customer,inv,original,received:Math.min(original,Math.max(0,payments)),open};
      }).filter(x=>x.open>0.005).sort((a,b)=>b.open-a.open);
    }catch(e){console.error('Faturas em aberto:',e);return [];}
  }

  function decorate(){
    const saldoLabel=[...document.querySelectorAll('.metric span')].find(el=>el.textContent.trim()==='Saldo Fiado');
    if(!saldoLabel) return;
    const metrics=saldoLabel.closest('.metrics');
    if(!metrics) return;
    const rows=getRows();
    const total=rows.reduce((s,x)=>s+x.open,0);
    let card=document.getElementById('openInvoicesDirectCard');
    if(!card){card=document.createElement('div');card.id='openInvoicesDirectCard';card.className='card metric green';card.setAttribute('role','button');card.setAttribute('tabindex','0');card.style.cursor='pointer';metrics.appendChild(card);}
    card.innerHTML='<div class="metric-icon">$</div><span>Faturas em aberto</span><strong>'+brl(total)+'</strong><small>'+rows.length+' cliente(s) · clique para ver</small>';
    let modal=document.getElementById('openInvoicesDirectModal');
    if(!modal){modal=document.createElement('div');modal.id='openInvoicesDirectModal';modal.style.cssText='display:none;position:fixed;inset:0;z-index:5200;background:rgba(15,23,42,.58);place-items:center;padding:20px;backdrop-filter:blur(3px)';document.body.appendChild(modal);}
    modal.innerHTML='<section class="card" style="width:min(900px,96vw);max-height:86vh;margin:0;padding:0;overflow:hidden;border-radius:20px"><div style="padding:20px 22px;border-bottom:1px solid var(--line)"><div class="page-head" style="margin:0"><div><div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase">Faturas em aberto</div><h2 style="margin:3px 0">Ainda tenho para receber</h2><div class="muted">Total: <strong>'+brl(total)+'</strong></div></div><button id="closeOpenInvoicesDirect" class="btn secondary">✕ Fechar</button></div></div><div style="overflow:auto;max-height:calc(86vh - 105px);padding:18px 22px 24px"><div class="table-wrap"><table class="table"><thead><tr><th>Cliente</th><th>Fatura</th><th style="text-align:right">Falta receber</th><th>Ação</th></tr></thead><tbody>'+(rows.length?rows.map(x=>'<tr><td><strong>'+safe(x.customer.name||'Cliente')+'</strong></td><td>'+safe(periodLabel(x.inv.period))+'</td><td style="text-align:right"><strong style="color:#b42318">'+brl(x.open)+'</strong></td><td><button class="btn primary" data-open-fiado-account="'+safe(x.customer.id)+'">Abrir conta</button></td></tr>').join(''):'<tr><td colspan="4" class="empty">Nenhuma fatura em aberto.</td></tr>')+'</tbody><tfoot><tr><td colspan="2"><strong>Total</strong></td><td style="text-align:right"><strong>'+brl(total)+'</strong></td><td></td></tr></tfoot></table></div></div></section>';
    const open=()=>{modal.style.display='grid';};const close=()=>{modal.style.display='none';};card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};modal.querySelector('#closeOpenInvoicesDirect').onclick=close;modal.onclick=e=>{if(e.target===modal) close();};modal.querySelectorAll('[data-open-fiado-account]').forEach(btn=>btn.onclick=()=>{fiadoSelectedCustomerId=btn.getAttribute('data-open-fiado-account');close();fiadosPage();});
  }

  try{if(typeof fiadosPage==='function'){const originalFiadosPage=fiadosPage;fiadosPage=function(){const result=originalFiadosPage.apply(this,arguments);setTimeout(decorate,0);return result;};}}catch(e){console.error(e);}setTimeout(decorate,250);
})();
<\/script>`;

async function fetchFresh(request){
  const response=await fetch(request,{cache:'no-store'});if(!response.ok)return response;const url=new URL(request.url);const isHtml=request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');const type=response.headers.get('content-type')||'';if(!isHtml||!type.includes('text/html'))return response;let text=await response.text();if(!text.includes('__tessaroOpenInvoicesV41'))text=text.replace('</body>',FIADOS_OPEN_INVOICES_SCRIPT+'\n</body>');const headers=new Headers(response.headers);headers.delete('content-length');return new Response(text,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);const isNavigation=request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/index.html');if(isNavigation){event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy)).catch(()=>{});return response;}).catch(async()=>await caches.match('./index.html')||Response.error()));return;}event.respondWith(fetchFresh(request).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));return response;}).catch(async()=>await caches.match(request)||Response.error()));});
