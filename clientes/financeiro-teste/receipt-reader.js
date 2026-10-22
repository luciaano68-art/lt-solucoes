// OCR output is evidence to review, never authority to write to the ledger.
import {categoryOf,normalize} from './conversation.js';
const norm=s=>normalize(s).replace(/\s+/g,' ').trim();
export function receiptMoney(s){
 const text=String(s||'').trim().replace(/R\$\s*/gi,'').replace(/\s/g,'');
 if(!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+)[,.]\d{2}$/.test(text))return null;
 const cents=Math.round(Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text)*100);
 return Number.isSafeInteger(cents)&&Math.abs(cents)<=100000000000?cents:null;
}
const values=s=>[...s.matchAll(/(?:R\$\s*)?(-?(?:\d{1,3}(?:\.\d{3})+|\d+)[,.]\d{2})(?!\d)/gi)].map(m=>receiptMoney(m[1])).filter(v=>v!==null);
export function receiptDate(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;
 const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;
}
function dateIn(line){const iso=line.match(/\b20\d{2}-\d{2}-\d{2}\b/);if(iso&&receiptDate(iso[0]))return iso[0];const m=line.match(/\b(\d{2})[\/.\-](\d{2})[\/.\-](20\d{2})\b/);if(!m)return null;const d=`${m[3]}-${m[2]}-${m[1]}`;return receiptDate(d)?d:null;}
export function parseReceipt(text,{confidence=null}={}){
 const rawText=String(text||'').slice(0,24000),lines=rawText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),warnings=[],candidates=[];
 if(String(text||'').length>24000)warnings.push('Notinha muito extensa: o texto foi limitado. Divida a foto para conferir o restante.');
 const cnpj=rawText.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/)?.[0]||'';
 const cnpjLine=lines.findIndex(l=>/cnpj/i.test(l)||cnpj&&l.includes(cnpj));
 const header=lines.slice(0,cnpjLine>=0?cnpjLine:6);
 const merchant=header.find(l=>/[a-zÀ-ÿ]{3}/i.test(l)&&!/(danfe|documento|auxiliar|cupom|fiscal|via cliente|via estabelecimento|cnpj|cpf|inscri|endereco|rua |avenida|rodovia|telefone|^tel\b)/i.test(norm(l)))||'';
 const dateLines=lines.filter(l=>/emiss|data.*compra|data.*venda|data.*hora/.test(norm(l)));
 const preferredDates=dateLines.map(dateIn).filter(Boolean);
 const dates=[...new Set(preferredDates.length?preferredDates:lines.map(dateIn).filter(Boolean))];
 const date=dates.length===1?dates[0]:null;
 const time=lines.find(l=>dateIn(l)===date)?.match(/\b([012]\d:[0-5]\d(?::[0-5]\d)?)\b/)?.[1]||'';
 if(!date)warnings.push(dates.length?'Há mais de uma data. Escolha a data da compra.':'Data não identificada. Informe a data da compra.');
 let subtotal=null,discount=null,fees=null,taxes=null,change=null,tendered=null,paymentMethod='';
 let documentNumber='',installments=null,cardLast4='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i],n=norm(line),numbers=values(line);let last=numbers.at(-1);
  const nextValue=()=>last??(/^\s*(?:R\$\s*)?\d[\d.,\s]*$/.test(lines[i+1]||'')?values(lines[i+1]).at(-1):null);
  if(/\b(subtotal|sub total|total bruto|valor dos produtos)\b/.test(n))subtotal=nextValue();
  if(/\bdescont/.test(n))discount=nextValue();
  if(/\b(acrescimo|taxa de servico|frete)\b/.test(n))fees=nextValue();
  if(/tribut|impost/.test(n)&&!/%/.test(line))taxes=nextValue();
  if(/\btroco\b/.test(n))change=nextValue();
  if(/valor (recebido|entregue)|dinheiro recebido/.test(n))tendered=nextValue();
  if(!paymentMethod&&/\b(pix|dinheiro|credito|debito|vale alimentacao|vale refeicao)\b/.test(n)&&!/(tribut|impost)/.test(n))paymentMethod=/pix/.test(n)?'Pix':/debito/.test(n)?'Débito':/credito/.test(n)?'Crédito':/dinheiro/.test(n)?'Dinheiro':line.slice(0,80);
  const doc=line.match(/(?:NFC-?e|COO|cupom|documento|nota fiscal)\s*(?:n[ºo°.]*)?\s*[:#.-]?\s*(\d{3,12})\b/i);if(doc&&!documentNumber)documentNumber=doc[1];
  const parts=n.match(/\b(\d{1,2})\s*(?:x\b|parcelas?\b|vezes\b)/)||n.match(/parcelad[oa].*?\b(\d{1,2})\b/);if(parts&&Number(parts[1])>1)installments=Number(parts[1]);
  const tail=line.match(/(?:final|\*{2,}|[xX]{3,})\s*(\d{4})\b/i);if(tail)cardLast4=tail[1];
  // Never choose taxes, quantity, tendered money, subtotal, installment or change as the purchase total.
  if(/subtotal|sub total|bruto|produtos|itens|quantidade|qtd|tribut|impost|troco|recebido|entregue|descont|parcela|unit|acrescimo|frete/.test(n))continue;
  let rank=/valor\s*(?:total\s*)?(?:a\s*)?pagar|total\s*a\s*pagar|total\s*liquido|valor\s*da\s*compra/.test(n)?3:/\btotal\b|valor total|valor da venda|valor pago/.test(n)?2:/^valor\s*[:(]?\s*(?:r\$[):]?\s*)?\d/.test(n)?1:0;
  const value=nextValue();if(rank&&value>0)candidates.push({cents:value,line,rank});
 }
 const ranked=candidates.filter(c=>c.rank===Math.max(0,...candidates.map(c=>c.rank))),totals=[...new Set(ranked.map(c=>c.cents))];
 const totalCents=totals.length===1?totals[0]:null;
 if(!totalCents)warnings.push(totals.length?'Totais diferentes encontrados. Confira o valor final da compra.':'Total da compra não identificado com segurança. Informe o valor.');
 if(!merchant)warnings.push('Confira o nome do estabelecimento.');
 if(confidence!==null&&confidence<70)warnings.push('A leitura tem baixa qualidade. Confira os números com a foto.');
 if(installments)warnings.push('Compra parcelada: confira o total e a quantidade de parcelas antes de continuar.');
 const itemStart=lines.findIndex(l=>/descricao|codigo.*produto|qtd.*unit|item.*produto/.test(norm(l)));
 const itemEnd=lines.findIndex((l,i)=>i>itemStart&&/^(?:valor total|total a pagar|subtotal|sub total|qtd.*total|forma.*pagamento)/.test(norm(l)));
 const itemLines=itemStart>=0?lines.slice(itemStart+1,itemEnd>=0?itemEnd:lines.length):lines.filter(l=>/\b(?:UN|KG|LT|L|PC|CX)\b/i.test(l)&&values(l).length);
 const items=itemLines.filter(l=>/[a-zÀ-ÿ]{2}/i.test(l)&&!/(cnpj|cpf|tribut|impost|consumidor|protocolo|http|chave de acesso)/i.test(norm(l))).slice(0,150).map(line=>{
  const qty=line.match(/\b(\d+(?:[,.]\d{1,4})?)\s*(UN|KG|LT|L|PC|CX)\b/i),amounts=values(line);
  return {line:line.slice(0,500),quantity:qty?qty[1].replace(',','.'):null,unit:qty?.[2]?.toUpperCase()||null,unitCents:amounts.length>1?amounts.at(-2):null,totalCents:amounts.at(-1)??null};
 });
 const category=categoryOf(norm(merchant+' '+items.map(i=>i.line).join(' ')));
 return {source:'photo-ocr',merchant,cnpj,date,time,totalCents,subtotalCents:subtotal,discountCents:discount,feesCents:fees,taxesCents:taxes,changeCents:change,tenderedCents:tendered,paymentMethod,documentNumber,installments,cardLast4,items,rawText,category,confidence,warnings,totalCandidates:candidates};
}
export function receiptDuplicates(data,receipt){
 return (data.entries||[]).filter(e=>!e.deleted&&((receipt.imageHash&&e.receiptData?.imageHash===receipt.imageHash)||(receipt.documentNumber&&receipt.cnpj&&e.receiptData?.documentNumber===receipt.documentNumber&&e.receiptData?.cnpj===receipt.cnpj&&e.date===receipt.date)||(e.kind==='expense'&&e.cents===receipt.totalCents&&e.date===receipt.date&&norm(e.description)===norm(receipt.merchant))));
}
