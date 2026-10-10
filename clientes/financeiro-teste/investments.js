const limit=100000000000;
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const cents=(n,zero=false)=>Number.isSafeInteger(n)&&n>=(zero?0:1)&&n<=limit;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function investmentAccountDelta(data,accountId){return (data.investmentMovements||[]).filter(m=>m.accountId===accountId).reduce((v,m)=>v+(m.kind==='withdraw'?m.cents:m.kind==='deposit'?-m.cents:0),0)}
export function investmentEstimate(investment,newCents){
 const base=investment.checkpointCents??investment.balanceCents;
 const deposits=investment.sinceDeposits||0,withdrawals=investment.sinceWithdrawals||0;
 const gainCents=newCents-base-deposits+withdrawals;
 return {gainCents,percent:base>0&&!deposits&&!withdrawals?gainCents/base*100:null,from:investment.checkpointDate};
}
export function mutateInvestment(state,p,user,stamp){
 const data=structuredClone(state);data.investments||=[];data.investmentMovements||=[];
 if(!uuid(p.id)||!validDate(p.date))throw Error('Confira a data e o identificador.');
 if(p.action==='investmentCreate'){
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!cents(p.cents,true))throw Error('Confira o nome e o saldo inicial da aplicação.');
  const existing=data.investments.find(i=>i.id===p.id);
  if(existing){if(existing.name===p.name.trim()&&existing.openingCents===p.cents)return state;throw Object.assign(Error('Esta aplicação já foi cadastrada.'),{status:409})}
  if(data.investments.some(i=>i.name.toLocaleLowerCase()===p.name.trim().toLocaleLowerCase()))throw Error('Já existe uma aplicação com esse nome.');
  data.investments.push({id:p.id,name:p.name.trim(),openingCents:p.cents,balanceCents:p.cents,checkpointCents:p.cents,checkpointDate:p.date,sinceDeposits:0,sinceWithdrawals:0,version:1,createdBy:user.name,createdAt:stamp});return data;
 }
 if(!['investmentDeposit','investmentWithdraw','investmentBalance'].includes(p.action))throw Error('Operação de investimento inválida.');
 const kind={investmentDeposit:'deposit',investmentWithdraw:'withdraw',investmentBalance:'balance'}[p.action];
 const previous=data.investmentMovements.find(m=>m.id===p.id);
 if(previous){if(previous.investmentId===p.investmentId&&previous.kind===kind&&previous.cents===p.cents&&previous.date===p.date&&previous.accountId===(p.accountId||null))return state;throw Object.assign(Error('Esta confirmação já foi usada. Atualize a tela.'),{status:409})}
 const investment=data.investments.find(i=>i.id===p.investmentId);
 if(!investment)throw Error('Escolha uma aplicação deste financeiro.');
 if(investment.version!==p.version)throw Object.assign(Error('Esta aplicação mudou em outro aparelho. Atualize e confira novamente.'),{status:409});
 const latestDate=data.investmentMovements.filter(m=>m.investmentId===investment.id).reduce((v,m)=>m.date>v?m.date:v,investment.checkpointDate);
 if(p.date<latestDate)throw Error('Use uma data a partir da última movimentação ou conferência de saldo.');
 if(!cents(p.cents,kind==='balance'))throw Error('Informe um valor válido.');
 let estimate=null;
 if(kind==='balance'){
  if(p.accountId)throw Error('A atualização do saldo não movimenta contas.');
  estimate=investmentEstimate(investment,p.cents);investment.balanceCents=investment.checkpointCents=p.cents;investment.checkpointDate=p.date;investment.sinceDeposits=investment.sinceWithdrawals=0;
 }else{
  const account=data.accounts.find(a=>a.id===p.accountId&&!a.deleted);if(!account)throw Error('Escolha uma conta deste financeiro.');
  if(kind==='withdraw'&&p.cents>investment.balanceCents)throw Error('O resgate é maior que o saldo registrado na aplicação. Atualize o saldo primeiro.');
  investment.balanceCents+=kind==='deposit'?p.cents:-p.cents;
  if(!cents(investment.balanceCents,true))throw Error('Saldo da aplicação fora do limite permitido.');
  investment[kind==='deposit'?'sinceDeposits':'sinceWithdrawals']+=p.cents;
 }
 investment.version++;investment.updatedAt=stamp;investment.updatedBy=user.name;
 data.investmentMovements.push({id:p.id,investmentId:investment.id,kind,cents:p.cents,date:p.date,accountId:p.accountId||null,...(estimate?{estimate}:{}),createdBy:user.name,createdAt:stamp});
 return data;
}
