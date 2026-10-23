const base='https://cdn.jsdelivr.net/npm/';
let library,engine,enginePromise,idleTimer,progress=()=>{},generation=0,recognizing=false;
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
  // Keep the attachment/hash stable; only resize the image used for recognition.
  const longest=canvas.height/canvas.width>2.2?2600:1900,ratio=Math.min(1,longest/Math.max(canvas.width,canvas.height));
  let scanCanvas=canvas;if(ratio<1){scanCanvas=document.createElement('canvas');scanCanvas.width=Math.round(canvas.width*ratio);scanCanvas.height=Math.round(canvas.height*ratio);scanCanvas.getContext('2d').drawImage(canvas,0,0,scanCanvas.width,scanCanvas.height);}
  return {canvas:scanCanvas,photo,upload:{base64:photo.split(',')[1],mime:'image/jpeg'},imageHash};
 }finally{URL.revokeObjectURL(url);}
}
function releaseLater(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(!recognizing)releaseReceiptReader();},90000);}
export function releaseReceiptReader(){generation++;clearTimeout(idleTimer);const old=engine;engine=null;enginePromise=null;progress=()=>{};old?.terminate().catch(()=>{});}
export function warmReceiptReader(){
 clearTimeout(idleTimer);if(engine){releaseLater();return Promise.resolve(engine);}if(enginePromise)return enginePromise;
 const current=generation;
 enginePromise=(async()=>{const Tesseract=await loadLibrary();if(current!==generation)throw Error('Leitura cancelada.');
  const worker=await Tesseract.createWorker('por',1,{workerPath:base+'tesseract.js@6.0.1/dist/worker.min.js',corePath:base+'tesseract.js-core@6.0.0',langPath:base+'@tesseract.js-data/por@1.0.0/4.0.0_best_int',logger:m=>progress(m.status==='recognizing text'?'Lendo a notinha… '+Math.round(m.progress*100)+'%':'Preparando o leitor…'),errorHandler:()=>{}});
  if(current!==generation){await worker.terminate();throw Error('Leitura cancelada.');}engine=worker;
  await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300'});releaseLater();return worker;
 })().catch(e=>{if(current===generation)releaseReceiptReader();throw e;});return enginePromise;
}
export async function recognizeReceipt(canvas,{signal,onProgress=()=>{}}={}){
 if(recognizing)throw Error('Aguarde a leitura em andamento.');
 let timer,abortHandler;const current=generation;recognizing=true;progress=onProgress;clearTimeout(idleTimer);
 try{
  const cancelled=new Promise((_,reject)=>{abortHandler=()=>{releaseReceiptReader();reject(Error('Leitura cancelada.'));};if(signal?.aborted)abortHandler();else signal?.addEventListener('abort',abortHandler,{once:true});});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{releaseReceiptReader();reject(Error('A leitura demorou demais. Tente uma foto mais próxima e bem iluminada.'));},60000);});
  const task=(async()=>{const worker=await warmReceiptReader();if(signal?.aborted)throw Error('Leitura cancelada.');return (await worker.recognize(canvas)).data;})();
  return await Promise.race([task,cancelled,timeout]);
 }catch(e){if(current===generation)releaseReceiptReader();throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abortHandler);progress=()=>{};recognizing=false;releaseLater();}
}
