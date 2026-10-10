export function createReceiptsUI({api,getState,setState,can,render,toast,storageBase}){
 const $=id=>document.getElementById(id);let selected=null,working=false,epoch=0;
 function close(force=false){if(working&&!force)return;epoch++;selected=null;$('receiptPhoto').removeAttribute('src');$('receiptFile').value='';$('receiptEditor').close();}
 async function show(id){
  const entry=getState().entries.find(e=>e.id===id&&!e.deleted);if(!entry)return;
  const requestEpoch=++epoch;selected=id;$('receiptTitle').textContent='Comprovante';$('receiptDescription').textContent=entry.description;$('receiptError').textContent='';$('receiptFile').value='';$('receiptPhoto').removeAttribute('src');$('receiptPhoto').hidden=true;$('receiptUploadLabel').hidden=!can('entries');$('receiptRemove').hidden=!entry.receipt||!can('entries');$('receiptEditor').showModal();
  if(entry.receipt)try{const result=await api({action:'receiptGet',id});if(selected!==id||epoch!==requestEpoch)return;$('receiptPhoto').src=storageBase+result.signedPath;$('receiptPhoto').hidden=false;}catch(e){if(selected===id&&epoch===requestEpoch)$('receiptError').textContent=e.message;}
 }
 async function compress(file){
  if(!file||file.size>20*1024*1024)throw Error('Escolha uma foto de até 20 MB.');
  const url=URL.createObjectURL(file);
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível ler a foto. Escolha JPG, PNG ou WebP.'));img.src=url;});
   const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const base64=canvas.toDataURL('image/jpeg',0.85).split(',')[1];if(base64.length>4194304)throw Error('Foto muito grande. Escolha uma imagem menor.');return {base64,mime:'image/jpeg'};
  }finally{URL.revokeObjectURL(url);}
 }
 async function save(remove=false){if(working||!selected)return;const entry=getState().entries.find(e=>e.id===selected&&!e.deleted);if(!entry)return;const requestEpoch=epoch;working=true;$('receiptFile').disabled=true;$('receiptRemove').disabled=true;$('receiptError').textContent='';
  try{const photo=remove?{}:await compress($('receiptFile').files[0]);const result=await api({action:remove?'receiptRemove':'receiptUpload',id:entry.id,version:entry.version,...photo});if(epoch!==requestEpoch)return;setState(result.data);working=false;close();render();toast(remove?'Comprovante removido.':'Comprovante anexado ao lançamento.');}
  catch(e){if(epoch===requestEpoch)$('receiptError').textContent=e.message;}
  finally{working=false;$('receiptFile').disabled=false;$('receiptRemove').disabled=false;}
 }
 function bind(){document.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>show(b.dataset.receipt));$('receiptFile').onchange=()=>{if($('receiptFile').files.length)save();};$('receiptRemove').onclick=()=>{if(confirm('Remover apenas a foto do comprovante? O lançamento será mantido.'))save(true);};$('closeReceipt').onclick=close;$('receiptEditor').oncancel=e=>{if(working)e.preventDefault();else close();};if(selected&&!getState().entries.some(e=>e.id===selected&&!e.deleted))close();}
 return {bind,close,reset:()=>close(true),isBusy:()=>working};
}
