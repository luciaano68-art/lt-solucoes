(function(root){
'use strict';
function pages(data,products=data.products||[]){
 const found=new Map();
 for(const p of products){const ns=p.source_pages?.length?p.source_pages:[p.source_page].filter(Boolean),hash=p.source_hash||data.imports?.[0]?.hash||'';
  for(const n of ns){const key=hash+':'+n,url=data.sourcePages?.[key]||(Number(n)===Number(p.source_page||ns[0])?p.source_page_image:'');if(!url)continue;
   if(!found.has(key))found.set(key,{key,number:Number(n),url,products:[]});const page=found.get(key);if(!page.products.some(x=>x.id===p.id))page.products.push(p);
  }
 }
 return [...found.values()].sort((a,b)=>a.key.split(':')[0].localeCompare(b.key.split(':')[0])||a.number-b.number);
}
function publicCatalog(data,available){
 const ids=new Set(available.map(v=>v.product_id)),products=data.products.filter(p=>ids.has(p.id)).map(p=>({id:p.id,name:p.name,category:p.category,image:p.image||'',image_is_illustrative:!!p.image_is_illustrative,source_hash:p.source_hash||data.imports?.[0]?.hash||'',source_page:p.source_page,source_pages:p.source_pages||[],source_page_image:p.source_page_image||''}));
 const sourcePages=Object.fromEntries(pages(data,data.products.filter(p=>ids.has(p.id))).map(p=>[p.key,p.url]));
 return {products,sourcePages,variants:available.map(v=>({id:v.id,product_id:v.product_id,label:v.label,shade:v.shade,finish:v.finish,fragrance:v.fragrance,net_content:v.net_content,price_cents:v.price_cents,regular_price_cents:v.regular_price_cents,image:v.image||'',promotion:v.promotion,approved:true,active:true}))};
}
root.BeautyCatalog={pages,publicCatalog};
})(globalThis);
