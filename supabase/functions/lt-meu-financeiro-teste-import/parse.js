import {moneyCents,normalize,categoryOf} from './conversation.js';
const fail=m=>{throw Object.assign(Error(m),{status:400})};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function parseNotification(p,now=new Date().toISOString()){
 if(!p||typeof p!=='object')fail('Aviso inválido.');
 const text=[p.title,p.body,p.text].filter(v=>typeof v==='string'&&v.trim()).join('\n').trim();
 if(text.length>3000||String(p.merchant||'').length>300)fail('O aviso é muito longo.');
 const n=normalize(text);
 if(p.currency!==undefined&&!['BRL','R$','REAL','REAIS'].includes(String(p.currency).toUpperCase()))fail('A captura aceita apenas valores em reais.');
 if(/\b(senha|codigo de|codigo para|token|recusad\w*|negad\w*|estorno|cancelad\w*|saldo|limite|fatura|boleto|pix|transferencia|resgate|rendimento)\b/.test(n))fail('Este aviso não foi identificado como compra. Registre manualmente se necessário.');
 let cents=null;
 if(p.amount!==undefined){if(typeof p.amount!=='string'&&typeof p.amount!=='number')fail('Confira o valor.');cents=moneyCents(String(p.amount));}
 else {const values=[...text.matchAll(/R\$\s*(\d+(?:[.,]\d+)*)/gi)];if(values.length!==1)fail('O aviso precisa ter um único valor em reais.');cents=moneyCents(values[0][1]);}
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000000)fail('Confira o valor da compra.');
 const receivedAt=p.receivedAt===undefined?now:p.receivedAt;
 if(typeof receivedAt!=='string'||!Number.isFinite(Date.parse(receivedAt))||Math.abs(Date.parse(receivedAt)-Date.parse(now))>31*86400000)fail('Confira a data do aviso (até 31 dias).');
 const date=p.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(receivedAt));if(!validDate(date))fail('Confira a data da compra.');
 const lines=text.split(/\n/).map(v=>v.trim()).filter(Boolean);
 const description=String(p.merchant||lines.find(v=>!/^(sicredi|nubank|itau|banco|carteira|wallet|r\$)/i.test(v)&&!/^\d{1,2}:\d{2}$/.test(v))||'Compra recebida do banco').replace(/R\$\s*\d+(?:[.,]\d+)*/gi,'').trim().slice(0,300)||'Compra recebida do banco';
 if(!text&&!p.merchant)fail('Informe o estabelecimento ou texto do aviso.');
 if(p.eventId!==undefined&&(typeof p.eventId!=='string'||p.eventId.length>200))fail('Identificador do aviso inválido.');
 return {proposal:{cents,description,date,category:categoryOf(description),dateInferred:!p.date,sourceText:text},receivedAt:new Date(receivedAt).toISOString(),eventKey:p.eventId||normalize(text||description)+'|'+new Date(receivedAt).toISOString()};
}
export function possibleDuplicate(proposal,entry){
 return !entry.deleted&&entry.kind==='expense'&&entry.cents===proposal.cents&&entry.date===proposal.date&&(!proposal.cardId||entry.cardId===proposal.cardId);
}
