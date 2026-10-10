const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const budgetCategories=['Combustível','Alimentação','Moradia','Transporte','Saúde','Lazer','Compras','Serviços','Outros'];
const fuel=/\b(combustivel|gasolina|diesel|etanol|abastec\w*|posto)\b/;
export function budgetSpent(data,budget){return (data.entries||[]).filter(e=>!e.deleted&&e.kind==='expense'&&(e.cardId?e.date:e.status==='paid'?(e.paidDate||e.date):null)?.startsWith(budget.month)&&(budget.category==='Combustível'?fuel.test(norm(e.description+' '+e.category)):e.category===budget.category)).reduce((sum,e)=>sum+e.cents,0)}
export function updateBudgetAlerts(data,previous,user,stamp){
 if(!data.budgetSettings?.enabled)return data;
 data.budgetAlerts||=[];
 for(const b of data.budgets||[]){if(b.deleted)continue;const spent=budgetSpent(data,b),old=budgetSpent(previous,b);if(spent>b.limitCents&&(spent>old||!previous.budgetSettings?.enabled||!previous.budgets?.some(x=>x.id===b.id&&x.limitCents===b.limitCents))){data.budgetAlerts.push({id:crypto.randomUUID(),budgetId:b.id,category:b.category,month:b.month,spentCents:spent,limitCents:b.limitCents,excessCents:spent-b.limitCents,createdAt:stamp,createdBy:user.name,response:null,note:'',version:0});}}
 return data;
}
export function mutateBudget(data,p,user,stamp){
 const fail=(s,status=400)=>{throw Object.assign(Error(s),{status})};
 if(p.action==='budgetSettings'){const version=data.budgetSettings?.version||0;if(p.version!==version)fail('O orçamento mudou em outro aparelho. Atualize.',409);if(typeof p.enabled!=='boolean')fail('Escolha ativar ou desativar.');data.budgetSettings={enabled:p.enabled,version:version+1,updatedBy:user.name,updatedAt:stamp};return data;}
 if(p.action==='budgetResponse'){const event=data.budgetAlerts?.find(x=>x.id===p.id);if(!event)fail('Aviso não encontrado neste financeiro.',404);if(event.version!==p.version)fail('Este motivo mudou em outro aparelho. Atualize.',409);if(!['note','skip'].includes(p.response)||p.response==='note'&&(typeof p.note!=='string'||!p.note.trim()||p.note.length>700))fail('Escreva o motivo (até 700 caracteres) ou escolha não justificar.');event.response=p.response;event.note=p.response==='note'?p.note.trim():'';event.respondedBy=user.name;event.respondedAt=stamp;event.version++;return data;}
 if(p.action!=='budget')fail('Ação de orçamento inválida.');
 if(!/^[0-9a-f-]{36}$/i.test(p.id)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)||!budgetCategories.includes(p.category)||!Number.isSafeInteger(p.limitCents)||p.limitCents<=0||p.limitCents>100000000000)fail('Confira o mês, a categoria e o limite mensal.');
 data.budgets||=[];const existing=data.budgets.find(x=>x.id===p.id);
 if(data.budgets.some(x=>x.id!==p.id&&x.month===p.month&&x.category===p.category&&!x.deleted))fail('Já existe um orçamento para esta categoria neste mês. Edite o limite existente.');
 if(existing){if(existing.version!==p.version)fail('Este limite mudou em outro aparelho. Atualize.',409);if(existing.month!==p.month||existing.category!==p.category)fail('Para outra categoria ou mês, crie um novo limite.');existing.changes||=[];existing.changes.push({limitCents:existing.limitCents,changedAt:stamp,changedBy:user.name});existing.limitCents=p.limitCents;existing.version++;existing.updatedAt=stamp;existing.updatedBy=user.name;}
 else data.budgets.push({id:p.id,category:p.category,month:p.month,limitCents:p.limitCents,version:1,createdAt:stamp,createdBy:user.name});
 return data;
}
export function budgetReply(text,data,today){
 const n=norm(text);if(!/\b(orcamento|meta|metas|ainda|resta|restante|posso|podemos|disponivel)\b/.test(n)||! /\b(quanto|qual|ver|mostre|posso|pode|orcamento)\b/.test(n)||/\b(gastei|paguei|comprei)\b/.test(n))return null;
 const category=fuel.test(n)?'Combustível':budgetCategories.find(c=>n.includes(norm(c)));
 if(!category&&!/\b(orcamento|metas)\b/.test(n))return null;
 if(!data.budgetSettings?.enabled)return 'O orçamento está desativado. Abra Orçamentos e ative a opção para definir seus limites mensais.';
 let month=today.slice(0,7);if(n.includes('mes passado')){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);month=d.toISOString().slice(0,7);}
 const budgets=(data.budgets||[]).filter(b=>!b.deleted&&b.month===month&&(!category||b.category===category));
 if(!budgets.length)return 'Ainda não há limite planejado '+(category?'para '+category.toLowerCase()+' ':'')+'neste mês. Defina em Orçamentos.';
 const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return 'Orçamento de '+month.split('-').reverse().join('/')+':\n'+budgets.map(b=>{const spent=budgetSpent(data,b),left=b.limitCents-spent;return b.category+': planejado '+money(b.limitCents)+', gasto '+money(spent)+'. '+(left>=0?'Ainda pode gastar '+money(left)+'.':'Passou do orçamento em '+money(-left)+'. Se quiser, registre o motivo em Orçamentos; é opcional.')}).join('\n')+'\nCartão conta pela data da compra; outras despesas, quando pagas. O pagamento da fatura não conta novamente.';
}

