import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={};vm.runInNewContext(fs.readFileSync(new URL('./core.js',import.meta.url),'utf8'),ctx);const C=ctx.BeautyCore;
let s=C.empty();s.profile.maxInstallments=3;s.profile.cycleEnd='2099-12-31';s.products=[{id:'base-matte',name:'Base Matte',active:true},{id:'base-lumi',name:'Base Luminosa',active:true}];s.variants=[{id:'tone-matte-6',product_id:'base-matte',shade:'Medium 6',finish:'Matte',net_content:'29 g',price_cents:8490,approved:true,active:true},{id:'tone-lumi-6',product_id:'base-lumi',shade:'Medium 6',finish:'Luminosa',net_content:'29 g',price_cents:8490,approved:true,active:true}];
const stamp='2026-11-18T20:00:00Z';let seq=0;
function order(customer,items){const q=C.quote(s,items),p={requestId:'order-'+(++seq),items,expected:q.items.map(i=>({variantId:i.variantId,totalCents:i.totalCents})),paymentMethod:'pix',installments:3,note:''};const out=C.submit(s,customer,p,stamp);s=out.state;return {p,order:out.result.order};}
const a={id:'a',name:'Cliente A'},b={id:'b',name:'Cliente B'},c={id:'c',name:'Cliente C'};
const first=order(a,[{variantId:'tone-matte-6',qty:1}]);order(b,[{variantId:'tone-matte-6',qty:1}]);order(c,[{variantId:'tone-matte-6',qty:1},{variantId:'tone-lumi-6',qty:1}]);
assert.equal(s.orders.length,3);assert.equal(C.submit(s,a,first.p,stamp).result.created,false);
assert.throws(()=>C.submit(s,a,{...first.p,items:[{variantId:'tone-lumi-6',qty:1}]},stamp));
assert.deepEqual([...C.installments(100,3,s.profile)].map(x=>x.amountCents),[34,33,33]);assert.throws(()=>C.installments(1,3,s.profile));assert.throws(()=>C.installments(100,4,s.profile));
const ids=s.orders.map(o=>o.id),report=C.consolidate(s,ids);assert.equal(report.lines.find(l=>l.variantId==='tone-matte-6').qty,3);assert.equal(report.lines.find(l=>l.variantId==='tone-lumi-6').qty,1);
assert.throws(()=>C.change(s,{kind:'variant',id:'tone-matte-6',values:{product_id:'base-matte',name:'Base Matte',shade:'Other tone',finish:'Matte',net_content:'29 g',fragrance:'',price_cents:8990}},stamp));
s=C.change(s,{kind:'settings',values:{...s.profile,maxInstallments:2,minInstallmentCents:0}},stamp).state;assert.equal(s.orders[0].installments.length,3);
s=C.makeBatch(s,{id:'batch-1',name:'Encomenda',orderIds:ids},stamp).state;assert.throws(()=>C.consolidate(s,ids));assert.equal(C.makeBatch(s,{id:'batch-1',orderIds:ids},stamp).state.batches.length,1);
assert.throws(()=>C.change(s,{kind:'receive',id:'batch-1',quantities:{'tone-matte-6':4,'tone-lumi-6':1}},stamp));
s=C.change(s,{kind:'receive',id:'batch-1',quantities:{'tone-matte-6':2,'tone-lumi-6':1}},stamp).state;
s=C.change(s,{kind:'allocate',id:'order-1',quantities:{'tone-matte-6':1}},stamp).state;s=C.change(s,{kind:'allocate',id:'order-2',quantities:{'tone-matte-6':1}},stamp).state;
assert.throws(()=>C.change(s,{kind:'allocate',id:'order-3',quantities:{'tone-matte-6':1,'tone-lumi-6':1}},stamp));
s=C.change(s,{kind:'deliver',id:'order-1'},stamp).state;assert.equal(s.orders[0].status,'delivered');assert.throws(()=>C.change(s,{kind:'deliver',id:'order-3'},stamp));
s=C.change(s,{kind:'paid',id:'order-1',number:1,paid:true},stamp).state;assert.equal(s.orders[0].installments[0].paidAt,stamp);
const snapshot=JSON.stringify(s);assert.throws(()=>C.change(s,{kind:'receive',id:'batch-1',quantities:{'tone-matte-6':1,'tone-lumi-6':1}},stamp));assert.equal(JSON.stringify(s),snapshot);
const seed=JSON.parse(fs.readFileSync(new URL('./catalog/seed.json',import.meta.url),'utf8'));assert.equal(new Set(seed.variants.map(v=>v.id)).size,seed.variants.length);assert.ok(seed.variants.every(v=>seed.products.some(p=>p.id===v.product_id)));assert.ok(seed.variants.every(v=>v.approved===false));assert.ok(seed.products.every(p=>p.official_sku===null));assert.equal(seed.variants.filter(v=>v.name==='Base TimeWise 3D Matte').length,30);assert.equal(seed.variants.filter(v=>v.name==='Base TimeWise 3D Luminosa').length,15);
const revised=C.change(s,{kind:'import',import:{id:'new-cycle',hash:'new-hash',complete:true},products:[{id:'new-parent',name:'Base Matte'}],variants:[{id:'new-variant',product_id:'new-parent',shade:'Medium 6',finish:'Matte',net_content:'29 g',price_cents:9990}]},stamp).state;
assert.equal(revised.variants.filter(v=>v.id==='tone-matte-6').length,1);assert.equal(revised.variants.find(v=>v.id==='tone-matte-6').price_cents,9990);assert.equal(revised.variants.find(v=>v.id==='tone-matte-6').approved,false);assert.equal(revised.orders[0].items[0].unitCents,8490);
const promotion=C.clone(s);promotion.variants.forEach(v=>{v.approved=true;v.active=true;});promotion.variants[1].promotion={requiresVariantId:'tone-matte-6',priceCents:7990,unitLimitPerRequired:1};assert.equal(C.quote(promotion,[{variantId:'tone-matte-6',qty:1},{variantId:'tone-lumi-6',qty:2}]).totalCents,24970);
console.log('PASS: variant grouping 3 matte + 1 luminous; idempotency; frozen terms; integer installments; price/identity guards; batching once; receipt/allocation caps; delivery; payment marks; catalog references and 45 base shades.');

