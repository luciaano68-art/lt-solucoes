import {assertPermission,validatePermissions,publicUser} from './permissions.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const columns='id,username,display_name,active,is_owner,permissions,access_version';
export async function manageUsers(user,p,{db,passwordHash}){
 assertPermission(user,p.action);
 if(p.action==='usersList')return {users:(await db('lt_pf_users_internal','?space_id=eq.'+user.space+'&select='+columns+'&order=display_name.asc')).map(publicUser)};
 if(!uuid(p.id))fail('Identificador de usuário inválido.');
 const name=String(p.name||'').trim();if(!name||name.length>80)fail('Informe o nome (até 80 caracteres).');
 if(p.isOwner!==undefined||p.space_id!==undefined||p.space!==undefined)fail('Não é permitido alterar o administrador ou o financeiro.',403);
 const permissions=validatePermissions(p.permissions);
 const rows=await db('lt_pf_users_internal','?id=eq.'+p.id+'&space_id=eq.'+user.space),existing=rows[0];
 if(p.action==='userCreate'&&existing)fail('Este usuário já foi cadastrado. Atualize a lista.',409);
 if(p.action==='userUpdate'&&!existing)fail('Usuário não encontrado neste financeiro.',404);
 if(existing?.is_owner)fail('O acesso do administrador é protegido e não pode ser alterado nesta tela.',403);
 const password=typeof p.password==='string'?p.password:'';
 if((p.action==='userCreate'||password)&& (password.length<8||password.length>100))fail('A senha deve ter de 8 a 100 caracteres.');
 let passwordFields={};if(password){const salt=crypto.randomUUID();passwordFields={password_salt:salt,password_hash:await passwordHash(password,salt),failed_attempts:0,locked_until:null};}
 if(p.action==='userCreate'){
  const username=String(p.username||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(username))fail('Login: use de 3 a 60 letras sem acentos, números, ponto, traço ou sublinhado.');
  if((await db('lt_pf_users_internal','?username=eq.'+encodeURIComponent(username)+'&select=id')).length)fail('Este login já está em uso. Escolha outro.',409);
  const created=await db('lt_pf_users_internal','','POST',{id:p.id,username,display_name:name,space_id:user.space,active:true,is_owner:false,permissions,access_version:1,...passwordFields});
  return {user:publicUser(created[0])};
 }
 if(!Number.isSafeInteger(p.version)||p.version!==existing.access_version)fail('Este acesso mudou em outro aparelho. Atualize antes de salvar.',409);
 if(typeof p.active!=='boolean')fail('Escolha se o acesso está ativo.');
 const updated=await db('lt_pf_users_internal','?id=eq.'+p.id+'&space_id=eq.'+user.space+'&is_owner=eq.false&access_version=eq.'+p.version,'PATCH',{display_name:name,active:p.active,permissions,access_version:p.version+1,...passwordFields});
 if(!updated.length)fail('Este acesso mudou em outro aparelho. Atualize antes de salvar.',409);
 if(password||!p.active)await db('lt_pf_tokens_internal','?user_id=eq.'+p.id,'DELETE');
 return {user:publicUser(updated[0])};
}

