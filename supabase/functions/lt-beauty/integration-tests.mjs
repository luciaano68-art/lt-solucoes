import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import readline from 'node:readline';
const rl=readline.createInterface({input:process.stdin,terminal:false});
rl.once('line',async line=>{rl.close();try{
 const config=JSON.parse(line),endpoint='https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-beauty',key='sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y';let token;
 async function request(body,authenticated=true){const r=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(authenticated&&token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 async function good(body,auth=true){const r=await request(body,auth);assert.equal(r.status,200,r.data.message);return r.data;}
 assert.equal((await request({action:'state'},false)).status,401);
 const credentials={username:'qa-'+config.id.slice(0,8),password:randomBytes(18).toString('hex')},setup=await good({action:'setup',accountId:config.id,setupToken:config.token,...credentials},false);token=setup.token;
 assert.ok(token.length===64);assert.ok((await request({action:'setup',accountId:config.id,setupToken:config.token,...credentials},false)).status>=400);
 let {state,revision}=await good({action:'state'});
 assert.equal((await good({action:'state',revision})).notModified,true);
 state=(await good({action:'change',operation:{kind:'settings',values:{...state.profile,maxInstallments:3,cycleEnd:'2099-12-31'}}})).state;
 const product1=randomUUID(),product2=randomUUID(),v1=randomUUID(),v2=randomUUID();
 for(const [id,parent,name,finish]of [[v1,product1,'Base teste Matte','Matte'],[v2,product2,'Base teste Luminosa','Luminosa']])await good({action:'change',operation:{kind:'variant',id,values:{product_id:parent,name,category:'Teste',shade:'Medium 6',finish,fragrance:'',net_content:'29 g',price_cents:8490,ackReview:true}}});
 state=(await good({action:'change',operation:{kind:'publish',ids:[v1,v2],approved:true}})).state;
 const clients=[];
 for(const name of ['QA Cliente A','QA Cliente B','QA Cliente C']){state=(await good({action:'change',operation:{kind:'customer',values:{name,phone:'',address:'Endereço de teste',city:'Teste'}}})).state;clients.push(state.customers.find(c=>c.name===name));}
 const publicCatalog=await good({action:'catalog',accountId:config.id,clientToken:clients[0].linkToken},false);
 assert.equal(publicCatalog.products.length,2);assert.ok(!JSON.stringify(publicCatalog).includes('QA Cliente B'));assert.ok(!JSON.stringify(publicCatalog).includes('linkHash'));
 const orderIds=[];
 for(let i=0;i<3;i++){const items=[{variantId:v1,qty:1},...(i===2?[{variantId:v2,qty:1}]:[])],payload={action:'order',accountId:config.id,clientToken:clients[i].linkToken,requestId:randomUUID(),items,expected:items.map(r=>({variantId:r.variantId,totalCents:8490})),paymentMethod:'pix',installments:3,note:''};const result=await good(payload,false);orderIds.push(result.order.id);assert.equal(result.order.installments.length,3);if(i===0){assert.equal((await good(payload,false)).duplicate,true);assert.ok((await request({...payload,items:[{variantId:v1,qty:2}]},false)).status>=400);}}
 const preview=await good({action:'batch_preview',orderIds});assert.equal(preview.lines.find(l=>l.variantId===v1).qty,3);assert.equal(preview.lines.find(l=>l.variantId===v2).qty,1);
 const batchId=randomUUID();state=(await good({action:'batch',id:batchId,name:'QA Encomenda',orderIds})).state;assert.equal(state.batches.length,1);
 assert.equal((await good({action:'batch',id:batchId,name:'QA Encomenda',orderIds})).state.batches.length,1);
 assert.ok((await request({action:'batch_preview',orderIds})).status>=400);
 state=(await good({action:'change',operation:{kind:'receive',id:batchId,quantities:{[v1]:2,[v2]:1}}})).state;
 for(const id of orderIds.slice(0,2))await good({action:'change',operation:{kind:'allocate',id,quantities:{[v1]:1}}});
 assert.ok((await request({action:'change',operation:{kind:'allocate',id:orderIds[2],quantities:{[v1]:1,[v2]:1}}})).status>=400);
 await good({action:'change',operation:{kind:'deliver',id:orderIds[0]}});await good({action:'change',operation:{kind:'paid',id:orderIds[0],number:1,paid:true}});
 const onlyOwn=await good({action:'catalog',accountId:config.id,clientToken:clients[0].linkToken},false);assert.equal(onlyOwn.orders.length,1);assert.equal(onlyOwn.orders[0].status,'delivered');
 const publicKeys=await good({action:'push_key'});assert.ok(typeof publicKeys.publicKey==='string'&&publicKeys.publicKey.length>70);
 await good({action:'logout'});assert.equal((await request({action:'state'})).status,401);
 const login=await good({action:'login',...credentials},false);assert.equal(login.accountId,config.id);
 console.log('PASS live API: setup once; private state; login/logout; client isolation; 3 client orders; retry idempotency; exact 3+1 consolidation; batch once; partial receipt/allocation cap; delivery; parcel payment; notification public key.');
 process.exit(0);
 }catch(error){console.error(error.message);process.exit(1);}});

