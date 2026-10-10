import {canSee} from './privacy.js';
import {monthShift,monthDay,brazilDate} from './credit.js';
const fail=(text,status=400)=>{throw Object.assign(Error(text),{status});};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export function ensureFixedExpenses(state,stamp){
 const current=brazilDate(stamp).slice(0,7),end=monthShift(current,11);let data=null;
 for(const rule of state.fixedExpenses||[]){if(!rule.active)continue;const account=state.accounts.find(a=>a.id===rule.accountId&&!a.deleted);if(!account)continue;
  for(let cycle=rule.startMonth>current?rule.startMonth:current;cycle<=end&&(!rule.endMonth||cycle<=rule.endMonth);cycle=monthShift(cycle,1)){
   const id=rule.id.slice(0,30)+cycle.replace('-','');if((data||state).entries.some(e=>e.id===id))continue;
   data||=structuredClone(state);const due=monthDay(cycle,rule.dueDay);data.entries.push({id,version:1,kind:'expense',cents:rule.cents,description:rule.description,category:rule.category,accountId:rule.accountId,date:due,dueDate:due,status:'pending',paidDate:null,scope:rule.scope,recurringId:rule.id,createdBy:rule.createdBy,createdById:rule.createdById,createdAt:stamp,updatedBy:rule.createdBy,updatedAt:stamp,deleted:false});
  }
 }
 return data||state;
}
export function mutateFixedExpense(state,p,user,stamp){
 if(p.action==='fixedExpenseEnsure')return ensureFixedExpenses(state,stamp);
 const account=state.accounts.find(a=>a.id===p.accountId&&!a.deleted),old=state.fixedExpenses?.find(r=>r.id===p.id);
 if(p.action==='fixedExpenseStop'){
  if(!old)fail('Despesa fixa não encontrada.',404);const bank=state.accounts.find(a=>a.id===old.accountId);if(!canSee(bank,user))fail('Esta despesa é particular de outro usuário.',403);if(old.version!==p.version)fail('A despesa fixa mudou. Atualize a lista.',409);
  const data=structuredClone(state),rule=data.fixedExpenses.find(r=>r.id===p.id);rule.active=false;rule.version++;rule.updatedBy=user.name;rule.updatedAt=stamp;const current=brazilDate(stamp).slice(0,7);
  for(const e of data.entries)if(e.recurringId===rule.id&&e.status==='pending'&&!e.deleted&&e.dueDate.slice(0,7)>current){e.deleted=true;e.version++;e.updatedBy=user.name;e.updatedAt=stamp;}
  return data;
 }
 if(!uuid(p.id)||!account||!canSee(account,user))fail('Escolha uma conta deste financeiro que você pode acessar.',403);
 if(typeof p.description!=='string'||!p.description.trim()||p.description.length>300||typeof p.category!=='string'||!p.category.trim()||p.category.length>80||!Number.isSafeInteger(p.cents)||p.cents<=0||p.cents>100000000000||!Number.isInteger(p.dueDay)||p.dueDay<1||p.dueDay>31||!['casal','luciano','yasmin'].includes(p.scope))fail('Confira a descrição, o valor e o dia do vencimento.');
 const current=brazilDate(stamp).slice(0,7),valid=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m);
 if(!valid(p.startMonth)||p.startMonth<current||p.startMonth>monthShift(current,11)||(p.endMonth&&(!valid(p.endMonth)||p.endMonth<p.startMonth)))fail('Confira o mês inicial e final da despesa fixa.');
 const fields={description:p.description.trim(),category:p.category.trim(),cents:p.cents,accountId:p.accountId,dueDay:p.dueDay,startMonth:p.startMonth,endMonth:p.endMonth||null,scope:p.scope};
 if(old){if(Object.keys(fields).some(k=>fields[k]!==old[k]))fail('Esta despesa fixa já foi cadastrada com outros dados.',409);return ensureFixedExpenses(state,stamp);}
 if((state.fixedExpenses||[]).length>=100)fail('Este financeiro já tem 100 despesas fixas.');
 const data=structuredClone(state);data.fixedExpenses||=[];data.fixedExpenses.push({id:p.id,...fields,active:true,version:1,createdBy:user.name,createdById:user.id,createdAt:stamp});return ensureFixedExpenses(data,stamp);
}
