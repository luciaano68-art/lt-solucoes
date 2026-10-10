import {normalize,moneyCents} from './conversation.js';
export function investmentIntent(text){
 const n=normalize(text);
 const subject=/\b(aplicacao|aplicacoes|investimento|investimentos|caixinha|caixinhas|poupanca|caixa no nubank)\b/.test(n);
 const deposit=/\b(guardei|guardar|apliquei|aplicar|investi|investir|aportei|aportar)\b/.test(n);
 const withdraw=/\b(resgatei|resgatar|retirei|retirar)\b/.test(n)&&subject;
 const update=subject&&/\b(atualizar|atualize|atualiza|saldo atual|saldo.*(?:e de|esta em|agora e))\b/.test(n);
 const query=subject&&/\b(saldo|quanto|ver|mostr|tenho|total)\b/.test(n);
 if(!deposit&&!withdraw&&!update&&!query)return null;
 const m=text.match(/(?:R\$\s*)?(\d[\d.,]*)/i),amount=m?moneyCents(m[1]):null;
 return {kind:update?'balance':withdraw?'withdraw':deposit?'deposit':'query',cents:amount};
}
export function namedChoice(text,items){
 const n=normalize(text).replace(/[.!?]+$/,'').trim();
 const exact=items.filter(i=>normalize(i.name)===n);if(exact.length)return exact;
 const matches=items.filter(i=>n.includes(normalize(i.name)));
 const max=Math.max(0,...matches.map(i=>normalize(i.name).length));
 return matches.filter(i=>normalize(i.name).length===max);
}
