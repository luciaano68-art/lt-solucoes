import {accessScreen} from './access-screen.js';
const $=id=>document.getElementById(id),key='lt_pf_teste_invite';
let invite=new URLSearchParams(location.hash.slice(1)).get('convite');
try{if(invite)sessionStorage.setItem(key,invite);else invite=sessionStorage.getItem(key)}catch{}
const form=$('registrationForm');
async function call(action,fields={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch('https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-meu-financeiro-teste-cadastro',{method:'POST',headers:{apikey:'sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y','Content-Type':'application/json'},body:JSON.stringify({action,invite,...fields}),signal:controller.signal});const p=await r.json();if(!r.ok)throw Error(p.message);return p}finally{clearTimeout(timer)}
}
function clearInvite(){try{sessionStorage.removeItem(key)}catch{}history.replaceState(null,'',location.pathname+location.search);invite=null}
{
 let available=true;
 accessScreen.subscribe(state=>{
  form.hidden=state!=='guest'||!available;
  $('loginForm').hidden=state!=='login'&&!(state==='guest'&&!available);
  $('sessionRestore').hidden=state!=='restoring';
  $('forgotForm').hidden=state!=='forgot';
 });
 $('createRegistration').onclick=()=>accessScreen.set('guest');
 $('existingLogin').onclick=()=>accessScreen.set('login');
 call('inviteStatus').then(p=>{
  available=p.available;
  if(!available){clearInvite();if(accessScreen.state==='guest'){
   accessScreen.set('login');
   $('loginError').textContent='Os cinco acessos de teste já foram cadastrados. Entre com seu login e sua senha.';
  }}
 }).catch(e=>{$('registrationError').textContent=e.name==='AbortError'?'Sem resposta. Tente novamente.':e.message});
 form.onsubmit=async e=>{
  e.preventDefault();$('registrationError').textContent='';
  if($('newPassword').value!==$('confirmPassword').value){$('registrationError').textContent='As senhas precisam ser iguais.';return}
  $('registerButton').disabled=true;
  try{const password=$('newPassword').value,p=await call('register',{name:$('newName').value,username:$('newLogin').value,phone:$('newPhone').value,password});clearInvite();form.reset();accessScreen.set('login');$('username').value=p.username;$('password').value='';$('loginError').textContent='Cadastro recebido! Aguarde a autorização do responsável. Depois, entre com o login e a senha que você criou.'}
  catch(e){$('registrationError').textContent=e.name==='AbortError'?'Sem resposta. Tente novamente.':e.message}
  finally{$('registerButton').disabled=false}
 };
}

for(const button of document.querySelectorAll('[data-password-toggle]'))button.addEventListener('click',()=>{const input=$(button.dataset.passwordToggle),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar senha':'Mostrar senha';button.setAttribute('aria-pressed',String(show));});

$('forgotPassword').onclick=()=>{accessScreen.set('forgot');$('forgotPhone').value='';$('forgotStatus').textContent='';};
$('forgotBack').onclick=()=>{accessScreen.set('login');};
$('forgotForm').onsubmit=async e=>{e.preventDefault();$('forgotSubmit').disabled=true;$('forgotStatus').textContent='Enviando pedido…';try{const result=await call('requestReset',{phone:$('forgotPhone').value});$('forgotStatus').textContent=result.message}catch(e){$('forgotStatus').textContent=e.name==='AbortError'?'Sem resposta. Tente novamente.':e.message}finally{$('forgotSubmit').disabled=false}};
