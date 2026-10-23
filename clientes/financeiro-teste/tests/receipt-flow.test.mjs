import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptPaymentOptions,suggestedReceiptPayment,receiptPurchase} from '../receipt-flow.js';
import {parseReceipt} from '../receipt-reader.js';
import {mutate} from '../../../supabase/functions/lt-meu-financeiro-teste-api/ledger.js';
import {warmReceiptReader,releaseReceiptReader,recognizeReceipt} from '../receipt-ocr.js';
const user={id:crypto.randomUUID(),name:'Teste'},account={id:crypto.randomUUID(),name:'Sicredi',openingCents:100000,visibility:'shared'},card={id:crypto.randomUUID(),name:'Sicredi · final 8111',closingDay:29,dueDay:13};
const data=()=>({accounts:[{...account}],cards:[{...card}],entries:[],invoices:[]});
const note=()=>({...parseReceipt('AUTO POSTO TESTE\nCNPJ: 12.345.678/0001-90\nEmissão 20/10/2026\nTOTAL R$ 27,96\nCRÉDITO\nFINAL 8111'),imageHash:'f'.repeat(64)});
const fields=()=>({merchant:'AUTO POSTO TESTE',total:'27,96',date:'2026-10-20',category:'Combustível',count:1,payment:'card:'+card.id});
test('payment suggestion uses exact card ending, never silently substitutes another card',()=>{
 assert.equal(suggestedReceiptPayment(note(),data()).value,'card:'+card.id);
 assert.equal(suggestedReceiptPayment({...note(),cardLast4:'9999'},data()).value,'');
 assert.equal(suggestedReceiptPayment(note(),{...data(),cards:[card,{...card,id:crypto.randomUUID()}]}).value,'');
 assert.equal(suggestedReceiptPayment({...note(),paymentMethod:'Pix'},data()).value,'account:'+account.id);
 assert.equal(suggestedReceiptPayment({...note(),paymentMethod:'Pix'},{...data(),accounts:[account,{...account,id:crypto.randomUUID()}]}).value,'');
 assert.equal(suggestedReceiptPayment({...note(),paymentMethod:''},data()).value,'');
 assert.equal(receiptPaymentOptions({accounts:[{...account,deleted:true}],cards:[card]}).length,1);
});
test('single confirmation payload goes directly to the correct invoice, without debiting account',()=>{
 const p=receiptPurchase(note(),fields(),data(),crypto.randomUUID());assert.equal(p.request.action,'entry');assert.equal(p.request.createOnly,true);assert.equal(p.entry.status,'pending');assert.equal(p.entry.paidDate,null);assert.equal(p.entry.accountId,null);assert.equal(p.entry.dueDate,'2026-11-13');assert.equal(p.rows.length,1);
 const result=mutate(data(),p.request,user,'2026-10-22T12:00:00Z');assert.equal(result.entries.length,1);assert.equal(result.entries[0].cents,2796);assert.equal(result.accounts[0].openingCents,100000);
});
test('cash purchase defaults to paid; optional pending selection stays possible',()=>{
 const f={...fields(),payment:'account:'+account.id},p=receiptPurchase(note(),f,data(),crypto.randomUUID());assert.equal(p.entry.status,'paid');assert.equal(p.entry.paidDate,f.date);assert.equal(p.rows.length,0);
 assert.equal(receiptPurchase(note(),{...f,unpaid:true},data(),crypto.randomUUID()).entry.status,'pending');
 assert.throws(()=>receiptPurchase(note(),{...f,count:2},data(),crypto.randomUUID()),/cartão de crédito/);
});
test('missing essentials ask only their own question; optional fiscal fields are not required',()=>{
 for(const [patch,expected] of [[{total:''},/valor total/],[{merchant:''},/estabelecimento/],[{date:''},/data da compra/],[{payment:''},/conta ou no cartão/]])assert.throws(()=>receiptPurchase(note(),{...fields(),...patch},data(),crypto.randomUUID()),expected);
 const p=receiptPurchase({...note(),cnpj:'',documentNumber:''},fields(),data(),crypto.randomUUID());assert.equal(p.request.entry.receiptData.cnpj,'');
});
test('previewed installment dates and cent distribution match actual saved installments',()=>{
 const p=receiptPurchase(note(),{...fields(),count:5},data(),crypto.randomUUID());assert.equal(p.request.action,'installmentPurchase');assert.equal(p.rows.reduce((s,r)=>s+r.cents,0),2796);
 const result=mutate(data(),p.request,user,'2026-10-22T12:00:00Z');assert.deepEqual(result.entries.map(e=>[e.cents,e.dueDate]),p.rows.map(r=>[r.cents,r.dueDate]));assert.equal(result.entries.filter(e=>e.receiptData).length,1);
});
test('duplicate and retry behavior preserves confirmation idempotence',()=>{
 const id=crypto.randomUUID(),p=receiptPurchase(note(),fields(),data(),id),saved=mutate(data(),p.request,user,'2026-10-22T12:00:00Z');
 assert.throws(()=>receiptPurchase(note(),fields(),saved,crypto.randomUUID()),/foto já foi lançada/);
 const retry=receiptPurchase(note(),fields(),saved,id);assert.equal(mutate(saved,retry.request,user),saved);
 const similar={...data(),entries:[{id:'other',kind:'expense',cents:2796,date:'2026-10-20',description:fields().merchant}]};
 assert.throws(()=>receiptPurchase(note(),fields(),similar,id),/compra parecida/);assert.ok(receiptPurchase(note(),{...fields(),duplicateAck:true},similar,id));
});
test('OCR worker starts during camera setup and is reused across photos',async()=>{
 let created=0,terminated=0,recognized=0;globalThis.Tesseract={createWorker:async()=>{created++;return {setParameters:async()=>{},recognize:async()=>{recognized++;return {data:{text:'TOTAL 27,96',confidence:95}};},terminate:async()=>{terminated++;}};}};
 try{await warmReceiptReader();await recognizeReceipt({});await recognizeReceipt({});assert.equal(created,1);assert.equal(recognized,2);assert.equal(terminated,0);}finally{releaseReceiptReader();delete globalThis.Tesseract;}assert.equal(terminated,1);
});
test('cancelled reading releases the worker and allows the next photo',async()=>{
 let created=0,terminated=0;globalThis.Tesseract={createWorker:async()=>{created++;const first=created===1;return {setParameters:async()=>{},recognize:async()=>first?new Promise(()=>{}):{data:{text:'TOTAL 35,00'}},terminate:async()=>{terminated++;}};}};
 try{const c=new AbortController(),reading=recognizeReceipt({},{signal:c.signal});await new Promise(r=>setImmediate(r));c.abort();await assert.rejects(reading,/cancelada/);assert.equal((await recognizeReceipt({})).text,'TOTAL 35,00');assert.equal(created,2);assert.ok(terminated>=1);}finally{releaseReceiptReader();delete globalThis.Tesseract;}
});
