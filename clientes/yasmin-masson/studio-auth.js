(function(root){
'use strict';
const key='lt_yasmin_studio_online_credentials_v1',endpoint='https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-yasmin-studio';
const publishable='sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y';
function credentials(){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
async function call(body){const response=await fetch(endpoint,{method:'POST',headers:{apikey:publishable,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível entrar.');return data}
async function logout(){const c=credentials();try{if(c)await call({...c,action:'logout'})}catch{}localStorage.removeItem(key);for(const k of Object.keys(localStorage))if(k.startsWith('lt_yasmin_masson')||k.startsWith('lt_yasmin_studio'))localStorage.removeItem(k);location.replace('./')}
root.StudioAuth=Object.freeze({logout});
if(location.pathname.endsWith('/painel.html')&&!credentials())location.replace('./');
root.addEventListener('DOMContentLoaded',()=>{
 const form=document.getElementById('loginForm');if(!form)return;
 const status=document.getElementById('loginStatus'),button=document.getElementById('loginButton');
 const session=credentials();if(session){status.textContent='Abrindo seu painel…';call({...session,action:'state'}).then(()=>location.replace('./painel.html')).catch(e=>{localStorage.removeItem(key);status.textContent=e.message})}
 form.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled)return;button.disabled=true;button.textContent='Entrando…';status.textContent='';try{const result=await call({action:'login',username:document.getElementById('username').value,password:document.getElementById('password').value});localStorage.setItem(key,JSON.stringify(result));document.getElementById('password').value='';location.replace('./painel.html')}catch(e){status.textContent=e.message||'Confira a conexão e tente novamente.'}finally{button.disabled=false;button.textContent='Entrar no painel'}});
});
if('serviceWorker'in navigator)root.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=1',{scope:'./',updateViaCache:'none'}).catch(()=>{}));
})(window);
