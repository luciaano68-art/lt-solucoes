/* Capture the browser's one-use install event before the main app loads. */
(()=>{
 let pending=null,busy=false,completed=false;
 const installed=()=>completed||navigator.standalone||window.matchMedia?.('(display-mode: standalone)').matches;
 const sync=()=>{const login=document.getElementById('installLogin');if(login)login.hidden=!!installed();const button=document.getElementById('installNative');if(button){button.hidden=!pending;button.disabled=busy;}};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;sync();});
 window.addEventListener('appinstalled',()=>{completed=true;pending=null;sync();document.getElementById('installHelp')?.close();});
 document.addEventListener('DOMContentLoaded',sync);
 async function prompt(){if(!pending||busy)return;const event=pending;pending=null;busy=true;sync();try{await event.prompt();await event.userChoice;document.getElementById('installHelp')?.close();}catch{showHelp();}finally{busy=false;sync();}}
 function showHelp(){
  let dialog=document.getElementById('installHelp');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='installHelp';dialog.innerHTML='<div class="dialog-head"><h2>Instalar Meu Financeiro</h2><button type="button" class="icon-button" aria-label="Fechar">×</button></div><p id="installSteps"></p><button id="installNative" type="button">Instalar agora</button><button id="copyInstallLink" type="button" class="secondary">Copiar link do aplicativo</button><p id="installCopyStatus" class="muted" role="status"></p>';document.body.append(dialog);dialog.querySelector('.icon-button').onclick=()=>dialog.close();dialog.querySelector('#installNative').onclick=prompt;dialog.querySelector('#copyInstallLink').onclick=async()=>{const url=new URL('./',document.baseURI).href;try{await navigator.clipboard.writeText(url);document.getElementById('installCopyStatus').textContent='Link copiado. Abra no navegador do celular.';}catch{document.getElementById('installCopyStatus').textContent=url;}};}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  document.getElementById('installSteps').textContent=installed()?'Este aplicativo já está instalado neste aparelho.':ios?'Abra este link no Safari. Toque em Compartilhar, depois em Adicionar à Tela de Início e confirme em Adicionar.':/Android/.test(navigator.userAgent)?'Abra este link no Chrome, fora do WhatsApp ou Instagram. Toque no menu ⋮, depois em Adicionar à tela inicial → Instalar. Se aparecer “Instalar agora” abaixo, toque nele para continuar.':'No Chrome ou Edge, use o ícone de instalação na barra de endereço ou o menu do navegador. No celular Android, abra o link no Chrome.';
  sync();if(!dialog.open)dialog.showModal();
 }
 window.financeInstaller={open:()=>pending&&!installed()?prompt():showHelp()};
})();
