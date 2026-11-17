(function(C){
'use strict';
let assertions=0;function ok(v,m){assertions++;if(!v)throw Error(m);}function rejects(fn,m){let threw=false;try{fn();}catch{threw=true;}ok(threw,m);}
const t='2026-11-16T20:00:00.000Z',a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
for(const [v,n] of [['27,96',2796],['35,00',3500],['1.234,56',123456],['1.234',123400],['8.50',850],['0,01',1]])ok(C.cents(v)===n,'Dinheiro '+v);
for(const v of ['','-1','1,123','a','Infinity','1,2,3'])rejects(()=>C.cents(v),'Rejeitar '+v);
ok(!C.validDate('2026-02-30')&&!C.validDate('9999-99-99'),'Data inválida');
let s=C.empty('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),base=C.clone(s);s=C.createEvent(s,{id:a,name:'Festa A',date:'2026-11-16',sample:true},t);ok(base.events.length===0,'Criação imutável');C.validate(s);
const cart={[a+'-p0-0']:3,[a+'-p1-0']:2},q=C.quote(s,cart);ok(q.count===5&&q.total===4400,'3 cervejas + 2 pastéis');
const payload={id:'sale-1',eventId:a,cart,expectedItems:q.items,method:'cash',received:'50,00'};
const sold=C.sell(s,payload,t);ok(sold.result.sale.changeCents===600,'Troco');ok(s.sales.length===0,'Venda imutável');s=sold.state;ok(C.sell(s,payload,t).state.sales.length===1,'Clique duplicado idempotente');ok(C.tickets(sold.result.sale).length===5,'5 fichas separadas');ok(new Set(C.tickets(sold.result.sale).map(t=>t.code)).size===5,'Códigos distintos');
rejects(()=>C.sell(s,{...payload,id:'bad',received:'1,00'},t),'Dinheiro insuficiente');
rejects(()=>C.sell(s,{...payload,id:'bad',method:''},t),'Pagamento obrigatório');
const q2=C.quote(s,{[a+'-p0-1']:1});const stale=C.catalogChange(s,{kind:'product',id:a+'-p0-1',name:'Água',price:'7,00',sectorId:a+'-s0'});rejects(()=>C.sell(stale,{id:'stale',eventId:a,method:'pix',received:'',cart:{[a+'-p0-1']:1},expectedItems:q2.items},t),'Preço alterado');
let s2=C.createEvent(s,{id:b,name:'Festa B',date:'2026-11-17',sample:true},t);const qb=C.quote(s2,{[b+'-p0-1']:2});s2=C.sell(s2,{id:'sale-b',eventId:b,method:'pix',received:'',cart:{[b+'-p0-1']:2},expectedItems:qb.items},t).state;
ok(C.totals(s2,a).total===4400&&C.totals(s2,b).total===1000,'Isolamento de eventos');rejects(()=>C.quote(s2,cart),'Não vender produto de outro evento');
const cancelled=C.voidSale(s2,'sale-1','Estorno',t);ok(s2.sales[0].status==='paid'&&cancelled.sales[0].status==='void','Cancelamento imutável');ok(C.totals(cancelled,a).total===0&&C.totals(cancelled,b).total===1000,'Cancelamento não mistura evento');
let n=0;const id=()=>String(++n),ops=C.changes(base,s,id);let cloud=C.mergeCloud(null,ops,a).data;ok(cloud.sales.length===1,'Subir venda offline');const again=C.mergeCloud(cloud,ops,a);ok(again.data.sales.length===1,'Reenvio não duplica');
let device=C.mergeRemote(C.empty('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),{...cloud,revision:1});device.activeEventId=a;const qd=C.quote(device,{[a+'-p0-0']:1});const ds=C.sell(device,{id:'sale-device2',eventId:a,method:'credit',received:'',cart:{[a+'-p0-0']:1},expectedItems:qd.items},t).state;cloud=C.mergeCloud(cloud,C.changes(device,ds,id),a).data;ok(cloud.sales.length===2,'Juntar dois aparelhos');
const cancelA=C.voidSale(s,'sale-1','Estorno',t);cloud=C.mergeCloud(cloud,C.changes(s,cancelA,id),a).data;const oldPaid=C.changes(base,s,()=>String(++n)).filter(o=>o.entity==='sales');cloud=C.mergeCloud(cloud,oldPaid,a).data;ok(cloud.sales.find(x=>x.id==='sale-1').status==='void','Retry não ressuscita cancelamento');
rejects(()=>C.mergeCloud(cloud,[{id:'evil',entity:'sales',eventId:b,record:ds.sales[1]}],a),'Servidor isola evento');
const dirtyState={...s,outbox:[{id:'local-edit',entity:'events',eventId:a,record:{...s.events[0],name:'Local'}}]};dirtyState.events=[{...s.events[0],name:'Local'}];const merged=C.mergeRemote(dirtyState,{...cloud,revision:3},['other']);ok(merged.events[0].name==='Local'&&merged.outbox.length===1,'Preservar alterações feitas durante envio');
return {assertions,passed:true};
})