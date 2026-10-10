const $=id=>document.getElementById(id),key='lt_pf_teste_admin';
let adminKey=new URLSearchParams(location.hash.slice(1)).get('chave');
try{if(adminKey)sessionStorage.setItem(key,adminKey);else adminKey=sessionStorage.getItem(key)}catch{}
history.replaceState(null,'',location.pathname);
async function call(action,fields={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{const r=await fetch('https://wwietlvweqsxfpejhhis.supabase.co/functions/v1/lt-meu-financeiro-teste-cadastro',{method:'POST',headers:{apikey:'sb_publishable_dArUUh2qpDqbzvjxXAEbNQ_hT6Y0y5y','Content-Type':'application/json'},body:JSON.stringify({action,adminKey,...fields}),signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.message);return data}finally{clearTimeout(timer)}
}
async function load(){
 $('reload').disabled=true;$('status').textContent='Buscando cadastros…';
 try{const data=await call('adminList');$('registrations').replaceChildren();$('status').textContent=data.users.length+' de '+data.limit+' acessos cadastrados.';
  for(const user of data.users){const card=document.createElement('section');card.className='card';const name=document.createElement('h2');name.textContent=user.name;const login=document.createElement('p');login.textContent='Login: '+user.username;const status=document.createElement('p');status.textContent=user.active?'✓ Autorizado':'Aguardando sua autorização';card.append(name,login,status);
   if(!user.active){const button=document.createElement('button');button.type='button';button.textContent='Autorizar acesso';button.onclick=async()=>{if(!confirm('Autorizar o acesso de '+user.name+' ('+user.username+')?'))return;button.disabled=true;try{await call('approve',{userId:user.id});await load()}catch(e){$('status').textContent=e.message;button.disabled=false}};card.append(button)}
   $('registrations').append(card);
  }
 }catch(e){$('status').textContent=e.name==='AbortError'?'Sem resposta. Tente novamente.':e.message}
 finally{$('reload').disabled=false}
}
$('reload').onclick=load;
if(adminKey)load();else{$('status').textContent='Abra o link de controle exclusivo do responsável.';$('reload').disabled=true}
