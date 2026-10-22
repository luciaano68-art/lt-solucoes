const base='https://cdn.jsdelivr.net/npm/';
let library;
function loadLibrary(){
 if(globalThis.Tesseract)return Promise.resolve(globalThis.Tesseract);
 if(!library)library=new Promise((resolve,reject)=>{
  const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();reject(Error('O leitor não carregou. Confira a internet e tente novamente.'));},20000);script.src=base+'tesseract.js@6.0.1/dist/tesseract.min.js';script.crossOrigin='anonymous';
  script.integrity='sha384-r1ru3tcf6FhnCFR4B7pIFG+BhFF9LlFtz/P1y4pblWn3AGs9y3lBx5SKLNf4+rED';
  script.onload=()=>{clearTimeout(timer);globalThis.Tesseract?resolve(globalThis.Tesseract):reject(Error('Leitor indisponível.'));};
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Não foi possível carregar o leitor. Confira a internet e tente novamente.'));};document.head.append(script);
 }).catch(e=>{library=null;throw e;});
 return library;
}
export async function receiptImage(file){
 if(!file||file.size>20*1024*1024||!/^image\//.test(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP de até 20 MB.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir a foto. No iPhone, tente uma captura de tela ou uma foto em JPG.'));img.src=url;});
  const canvas=document.createElement('canvas'),scale=Math.min(1,2600/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  if(canvas.width<200||canvas.height<200)throw Error('A foto está muito pequena. Fotografe a notinha inteira e de perto.');
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const photo=canvas.toDataURL('image/jpeg',.86),bytes=Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0));
  if(bytes.length>3*1024*1024)throw Error('A foto ficou muito grande. Escolha outra imagem.');
  const imageHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {canvas,photo,upload:{base64:photo.split(',')[1],mime:'image/jpeg'},imageHash};
 }finally{URL.revokeObjectURL(url);}
}
export async function recognizeReceipt(canvas,{signal,onProgress=()=>{}}={}){
 let worker,timer,aborted=false;
 const abort=()=>{aborted=true;worker?.terminate().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{
  const Tesseract=await loadLibrary();if(signal?.aborted)throw Error('Leitura cancelada.');
  // Explicit versions prevent an engine/model change from silently changing results.
  const task=(async()=>{
   worker=await Tesseract.createWorker('por',1,{workerPath:base+'tesseract.js@6.0.1/dist/worker.min.js',corePath:base+'tesseract.js-core@6.0.0',langPath:base+'@tesseract.js-data/por@1.0.0/4.0.0_best_int',logger:m=>onProgress(m.status==='recognizing text'?'Lendo a notinha… '+Math.round(m.progress*100)+'%':'Preparando o leitor…'),errorHandler:()=>{}});
   if(aborted){await worker.terminate();throw Error('Leitura cancelada.');}
   await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});
   return (await worker.recognize(canvas)).data;
  })();
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{abort();reject(Error('A leitura demorou demais. Tente uma foto mais próxima e bem iluminada.'));},90000);});
  const data=await Promise.race([task,timeout]);if(aborted)throw Error('Leitura cancelada.');return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(worker)await worker.terminate().catch(()=>{});}
}
