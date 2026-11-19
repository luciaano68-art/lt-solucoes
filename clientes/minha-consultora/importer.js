(function(root){
'use strict';
async function fingerprint(file){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function loadPdf(){const lib=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';return lib;}
function candidates(items,page,hash,preview){
 // Coordinates keep prices near their descriptions. Ambiguous extractions stay blocked drafts.
 const lines=[];for(const item of items){const text=item.str?.trim();if(!text)continue;const y=item.transform[5],x=item.transform[4];let line=lines.find(l=>Math.abs(l.y-y)<3);if(!line){line={y,parts:[]};lines.push(line);}line.parts.push({x,text});}
 lines.sort((a,b)=>b.y-a.y);const text=lines.map(l=>l.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ')).join('\n');
 const products=[],variants=[];let n=0;
 const list=text.split('\n');
 for(let i=0;i<list.length;i++){
  const price=list[i].match(/(?:POR:\s*)?R\$\s*([\d.]+)[,.](\d{2})(?!\d)/i);if(!price||/economize|economia/i.test(list[i]))continue;
  const before=list.slice(Math.max(0,i-5),i).filter(s=>!/^[-\d\s]+$/.test(s)&&!s.includes('R$')),name=before.reverse().find(s=>/base|batom|creme|gel|loção|locao|sérum|serum|parfum|colônia|colonia|máscara|mascara|pincel|kit|presente|sombra|pó |spray|lip |lápis|lapis|hidratante|delineador|corretivo|tônico|tonico|esponja|bolsa|necessaire|nécessaire/i.test(s));
  if(!name)continue;const id='pdf-'+hash.slice(0,16)+'-'+page+'-'+n++,amount=Number(price[1].replace(/\./g,''))*100+Number(price[2]);if(!Number.isSafeInteger(amount)||amount<1)continue;
  const net=(before.join(' ').match(/\b\d+(?:[,.]\d+)?\s*(?:ml|g)\b/i)||[])[0]||'';
  products.push({id,name:name.replace(/LANÇAMENTO/gi,'').replace(/[,–-]?\s*\d+(?:[,.]\d+)?\s*(?:ml|g)\b.*$/i,'').trim().slice(0,120),category:'Importação para conferir',source_hash:hash,source_pages:[page],source_text:list.slice(Math.max(0,i-6),i+4).join('\n'),source_page_image:preview,image:null,active:false,review_required:true,review_notes:['Confira nome, variações, preço de venda, composição e associação da imagem nesta página.']});
  variants.push({id:id+'-v',product_id:id,price_cents:amount,net_content:net,finish:/luminosa/i.test(name)?'Luminosa':/matte/i.test(name)?'Matte':'',shade:'',label:'',approved:false,active:false,source_pages:[page],review_required:true,review_notes:['Leitura automática ainda não conferida.']});
 }
 return {products,variants,text};
}
root.BeautyImporter={fingerprint,async read(file,{state,save,upload,onProgress}){
 if(file.size>60000000)throw Error('Use um PDF com até 60 MB.');const hash=await fingerprint(file);if(state.imports.some(i=>i.hash===hash&&i.complete))return {duplicate:true};
 const seed=await fetch('./catalog/seed.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Não foi possível carregar o catálogo.');return r.json();});
 if(seed.source.sha256===hash){await save({kind:'import',import:{id:hash,hash,name:file.name,pages:seed.source.pages,complete:true,createdAt:new Date().toISOString(),method:'Ciclo analisado',notes:seed.notes,pageImages:seed.sourcePages||{}},products:seed.products,variants:seed.variants});onProgress(100,'Catálogo do ciclo carregado para conferência.');return {known:true,count:seed.variants.length};}
 const lib=await loadPdf(),pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;if(pdf.numPages>180)throw Error('Use um catálogo com até 180 páginas.');
 const previous=state.imports.find(i=>i.hash===hash),done=new Set(previous?.pagesDone||[]),record={id:hash,hash,name:file.name,pages:pdf.numPages,complete:false,pagesDone:[...done],createdAt:previous?.createdAt||new Date().toISOString(),method:'Leitura automática com conferência',pageImages:previous?.pageImages||{}};
 for(let number=1;number<=pdf.numPages;number++){
  if(done.has(number))continue;onProgress(Math.round((number-1)/pdf.numPages*100),'Lendo página '+number+' de '+pdf.numPages);
  const page=await pdf.getPage(number),content=await page.getTextContent(),viewport=page.getViewport({scale:Math.min(1.1,560/page.view[2])}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  const preview=await upload(canvas.toDataURL('image/jpeg',.72)),draft=candidates(content.items,number,hash,preview);done.add(number);record.pageImages[hash+':'+number]=preview;record.pagesDone=[...done];record.complete=number===pdf.numPages;
  await save({kind:'import',import:record,products:draft.products,variants:draft.variants});canvas.width=1;canvas.height=1;page.cleanup();
 }
 pdf.destroy();onProgress(100,'Leitura concluída. Confira os rascunhos antes de publicar.');return {known:false};
}};
})(window);

