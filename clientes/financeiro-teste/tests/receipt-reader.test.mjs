import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseReceipt,receiptMoney,receiptDate,receiptDuplicates} from '../receipt-reader.js';
import {validateReceiptData} from '../receipt-data.js';
import {receiptDetailsHTML} from '../receipt-scan-ui.js';
import {mutate} from '../../../supabase/functions/lt-meu-financeiro-teste-api/ledger.js';
import {visibleData} from '../privacy.js';
import {createInstallmentsUI} from '../installments-ui.js';
const note='AUTO POSTO EXEMPLO\nCNPJ: 12.345.678/0001-90\nDOCUMENTO AUXILIAR NFC-e\nEmissão: 20/10/2026 17:23:00\nNFC-e 000123456\nCODIGO DESCRICAO QTD UN VL TOTAL\n001 GASOLINA 4,00 L 6,99 27,96\nVALOR TOTAL R$ 27,96\nFORMA DE PAGAMENTO\nCARTAO DE CREDITO 27,96\nVISA FINAL 8111\nVALOR APROXIMADO TRIBUTOS 8,10';
test('fuel receipt retains merchant, issuer, document, items, date, payment and cents',()=>{
 const r=parseReceipt(note,{confidence:94});assert.equal(r.merchant,'AUTO POSTO EXEMPLO');assert.equal(r.date,'2026-10-20');assert.equal(r.time,'17:23:00');assert.equal(r.cnpj,'12.345.678/0001-90');assert.equal(r.totalCents,2796);assert.equal(r.documentNumber,'000123456');assert.equal(r.paymentMethod,'Crédito');assert.equal(r.cardLast4,'8111');assert.equal(r.taxesCents,810);assert.equal(r.category,'Combustível');assert.equal(r.items[0].quantity,'4.00');assert.equal(r.items[0].unitCents,699);assert.equal(r.items[0].totalCents,2796);assert.equal(r.rawText,note);
});
test('net payable outranks subtotal, discounts, taxes, tendered money and change',()=>{
 const r=parseReceipt('MERCADO EXEMPLO\n22/10/2026\nSubtotal 1.250,00\nDesconto 50,00\nVALOR TOTAL 1.250,00\nVALOR A PAGAR R$ 1.200,00\nDINHEIRO RECEBIDO 1.500,00\nTROCO 300,00\nTRIBUTOS 200,00');assert.equal(r.totalCents,120000);assert.equal(r.subtotalCents,125000);assert.equal(r.discountCents,5000);assert.equal(r.changeCents,30000);assert.equal(r.tenderedCents,150000);
});
test('separate-line totals and ISO dates work; values without total labels are never guessed',()=>{
 assert.equal(parseReceipt('LOJA EXEMPLO\n2026-10-22\nTOTAL A PAGAR\nR$ 35,00').totalCents,3500);
 assert.equal(parseReceipt('LOJA EXEMPLO\nR$ 999,00\nTroco 5,00').totalCents,null);
 assert.equal(parseReceipt('LOJA EXEMPLO\n22/10/2026\nVALOR TOTAL 27,96\nVALOR TOTAL 35,00').totalCents,null);
 assert.equal(parseReceipt('LOJA EXEMPLO\nData e hora\n22/10/2026\nTOTAL 35,00').date,'2026-10-22');
});
test('invalid dates, uncertain scans and installments require review',()=>{
 assert.equal(receiptDate('2026-02-30'),false);assert.equal(receiptDate('2028-02-29'),true);
 const r=parseReceipt('LOJA EXEMPLO\n31/02/2026\nTOTAL 350,00\n3x 116,67',{confidence:40});assert.equal(r.date,null);assert.equal(r.installments,3);assert.ok(r.warnings.length>=3);
 assert.equal(parseReceipt('LOJA EXEMPLO\n20/10/2026\n21/10/2026\nTOTAL 35,00').date,null);
});
test('money parser rejects ambiguous and oversized values',()=>{
 assert.equal(receiptMoney('R$ 1.234,56'),123456);assert.equal(receiptMoney('27,96'),2796);assert.equal(receiptMoney('27.96'),2796);for(const s of ['R$','27,9','1,23,45','NaN','35 reais','999999999999,99'])assert.equal(receiptMoney(s),null);
});
test('duplicate detection ignores deleted rows and distinguishes photo from similar purchase',()=>{
 const r={...parseReceipt(note),imageHash:'a'.repeat(64)};const row={id:'e',kind:'expense',cents:2796,date:r.date,description:r.merchant,receiptData:r};assert.equal(receiptDuplicates({entries:[row]},r).length,1);assert.equal(receiptDuplicates({entries:[{...row,deleted:true}]},r).length,0);assert.equal(receiptDuplicates({entries:[row]},{...r,totalCents:1,imageHash:'b'.repeat(64),documentNumber:'x'}).length,0);
});
test('receipt schema bounds payload and strips unknown fields; backend has identical validation',()=>{
 const r=validateReceiptData({...parseReceipt(note),authorization:'secret',warnings:['x']});assert.equal(r.authorization,undefined);assert.equal(r.warnings,undefined);assert.equal(r.totalCents,2796);
 assert.throws(()=>validateReceiptData({...r,rawText:'x'.repeat(24001)}));assert.throws(()=>validateReceiptData({...r,items:Array(151).fill({line:'x'})}));assert.throws(()=>validateReceiptData({...r,confidence:101}));assert.throws(()=>validateReceiptData({...r,totalCents:1.1}));
 assert.equal(readFileSync(new URL('../receipt-data.js',import.meta.url),'utf8'),readFileSync(new URL('../../../supabase/functions/lt-meu-financeiro-teste-api/receipt-data.js',import.meta.url),'utf8'));
});
test('save requires confirmation action, preserves evidence on edits and blocks duplicate photo atomically',()=>{
 const user={id:crypto.randomUUID(),name:'Teste'},accountId=crypto.randomUUID();let data={accounts:[{id:accountId,name:'Conta',openingCents:0,visibility:'shared'}],entries:[],cards:[],invoices:[]};const entry={kind:'expense',cents:2796,description:'AUTO POSTO EXEMPLO',date:'2026-10-20',dueDate:'2026-10-20',status:'paid',paidDate:'2026-10-20',accountId,scope:'casal',category:'Combustível',receiptData:{...parseReceipt(note),imageHash:'a'.repeat(64)}};const p={action:'entry',id:crypto.randomUUID(),createOnly:true,entry};
 data=mutate(data,p,user);assert.equal(data.entries.length,1);assert.equal(data.entries[0].receiptData.items.length,1);assert.equal(mutate(data,p,user),data);assert.throws(()=>mutate(data,{...p,id:crypto.randomUUID()},user),/foto já foi usada/);
 const edited=mutate(data,{action:'entry',id:p.id,version:1,entry:{...entry,description:'Combustível da Biz'}},user);assert.equal(edited.entries[0].receiptData.rawText,note);
});
test('receipt metadata follows private account permissions',()=>{
 const me={id:crypto.randomUUID()},other={id:crypto.randomUUID()},id=crypto.randomUUID(),data={accounts:[{id,ownerUserId:other.id,visibility:'private',name:'Privada'}],entries:[{id:'e',kind:'expense',accountId:id,receiptData:parseReceipt(note)}]};assert.equal(JSON.stringify(visibleData(data,me)).includes('12.345.678'),false);
});
test('receipt rendering escapes every printed line',()=>{
 const escape=s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;');const html=receiptDetailsHTML({merchant:'<script>x</script>',rawText:'<img src=x>',items:[{line:'<svg onload=x>'}]},escape,String);assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img src=x>'),false);assert.equal(html.includes('<svg onload=x>'),false);
});
test('photo installment preview does not write until confirmed; photo evidence belongs to the first installment',async()=>{
 const user={id:crypto.randomUUID(),name:'Teste'},card={id:crypto.randomUUID(),name:'Sicredi',closingDay:29,dueDay:13};let data={accounts:[],cards:[card],invoices:[],entries:[]},writes=0,attached=null,cancelled=0;
 const ui=createInstallmentsUI({getState:()=>data,can:()=>true,request:async p=>{writes++;return {data:mutate(data,p,user,'2026-10-22T12:00:00Z')};},update:d=>data=d,render:()=>{},money:String,today:()=> '2026-10-22',escape:String,say:()=>{},clearOtherFlow:()=>{},afterSaved:(purchaseId,entryId)=>{attached={purchaseId,entryId};},onCancel:()=>{cancelled++;}});
 const p={id:crypto.randomUUID(),cents:2796,count:3,description:'Compra de teste',category:'Compras',scope:'casal',date:'2026-10-20',cardId:card.id,receiptData:{...parseReceipt(note),installments:3,imageHash:'b'.repeat(64)}};
 ui.start(p);assert.equal(writes,0);assert.match(ui.bubble(),/1\/3/);assert.match(ui.bubble(),/932/);await ui.handle('confirmar');assert.equal(writes,1);assert.equal(data.entries.length,3);assert.equal(data.entries.reduce((s,e)=>s+e.cents,0),2796);assert.equal(data.entries.filter(e=>e.receiptData).length,1);assert.equal(attached.purchaseId,p.id);assert.equal(attached.entryId,data.entries[0].id);assert.equal(data.entries[0].receiptData.rawText,note);
 ui.start({...p,id:crypto.randomUUID()});await ui.handle('cancelar');assert.equal(writes,1);assert.equal(cancelled,1);
});
