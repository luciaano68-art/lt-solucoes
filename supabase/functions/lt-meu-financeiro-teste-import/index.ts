const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
// Disabled at the owner's request. No credentials, payloads or financial data are read.
Deno.serve((req:Request)=>req.method==='OPTIONS'?new Response('ok',{headers}):new Response(JSON.stringify({ok:false,message:'A captura de notificações foi removida do Meu Financeiro — Teste.'}),{status:410,headers}));
