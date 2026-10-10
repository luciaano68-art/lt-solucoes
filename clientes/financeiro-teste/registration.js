const $=id=>document.getElementById(id),key='lt_pf_teste_invite';
let invite=new URLSearchParams(location.hash.slice(1)).get('convite');
try{if(invite)sessionStorage.setItem(key,invite);else invite=sessionStorage.getItem(key)}catch{}
const form=$('registrationForm');
async function call(action,fields={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch('https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-meu-financeiro-teste-cadastro',{method:'POST',headers:{apikey:'sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y','Content-Type':'application/json'},body:JSON.stringify({action,invite,...fields}),signal:controller.signal});const p=await r.json();if(!r.ok)throw Error(p.message);return p}finally{clearTimeout(timer)}
}
function clearInvite(){try{sessionStorage.removeItem(key)}catch{}history.replaceState(null,'',location.pathname+location.search);invite=null}
if(invite){
 $('loginForm').hidden=true;$('sessionRestore').hidden=true;form.hidden=false;
 const observer=new MutationObserver(()=>{if(!form.hidden){if(!$('loginForm').hidden)$('loginForm').hidden=true;if(!$('sessionRestore').hidden)$('sessionRestore').hidden=true}});
 observer.observe($('loginForm'),{attributes:true,attributeFilter:['hidden']});observer.observe($('sessionRestore'),{attributes:true,attributeFilter:['hidden']});
 $('existingLogin').onclick=()=>{form.hidden=true;observer.disconnect();$('loginForm').hidden=false;$('sessionRestore').hidden=true};
 call('inviteStatus').then(p=>{if(!p.available){form.hidden=true;observer.disconnect();clearInvite();$('loginForm').hidden=false;$('sessionRestore').hidden=true;$('loginError').textContent='Cadastro já criado. Entre com seu login e sua senha.'}}).catch(e=>{$('registrationError').textContent=e.name==='AbortError'?'Sem resposta. Tente novamente.':e.message});
 form.onsubmit=async e=>{
  e.preventDefault();$('registrationError').textContent='';
  if($('newPassword').value!==$('confirmPassword').value){$('registrationError').textContent='As senhas precisam ser iguais.';return}
  $('registerButton').disabled=true;
  try{const password=$('newPassword').value,p=await call('register',{name:$('newName').value,username:$('newLogin').value,password});clearInvite();form.reset();form.hidden=true;observer.disconnect();$('loginForm').hidden=false;$('username').value=p.username;$('password').value=password;$('loginForm').requestSubmit()}
  catch(e){$('registrationError').textContent=e.name==='AbortError'?'Sem resposta. Tente novamente.':e.message}
  finally{$('registerButton').disabled=false}
 };
}
