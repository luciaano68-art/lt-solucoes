export const categories=['Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Compras','Serviços','Outros'];
export function normalize(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
export function moneyCents(value){let s=String(value).replace(/R\$/gi,'').replace(/\s/g,'');if(!/^-?\d+(?:[.,]\d+)*$/.test(s))return null;let negative=s.startsWith('-');s=s.replace(/^-/,'');let whole=s,fraction='';if(s.includes(',')){if(s.indexOf(',')!==s.lastIndexOf(','))return null;[whole,fraction]=s.split(',');whole=whole.replace(/\./g,'');}else if(s.includes('.')){const parts=s.split('.');if(parts.length===2&&parts[1].length<=2){[whole,fraction]=parts}else if(parts.slice(1).every(p=>p.length===3)){whole=parts.join('')}else return null;}if(fraction.length>2||!/^[0-9]+$/.test(whole)||fraction&&!/^\d+$/.test(fraction))return null;const n=Number(whole)*100+Number((fraction+'00').slice(0,2));return Number.isSafeInteger(n)?(negative?-n:n):null}
function isoDate(y,m,d){const s=String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');return new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s?s:null}
export function shiftDate(date,n){let d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function categoryOf(text){const n=normalize(text);for(const [label,rx] of [['Alimentação',/mercado|comida|restaurante|almoco|jantar|lanche/],['Moradia',/aluguel|agua|luz|energia|internet|condominio/],['Transporte',/diesel|gasolina|combustivel|carro|trator|uber|pneu/],['Saúde',/farmacia|remedio|medico|dentista|psicolog|saude/],['Lazer',/cinema|passeio|lazer|viagem/],['Salário',/salario|pagamento do trabalho/],['Compras',/compra|roupa|loja/],['Serviços',/servico|manutencao|conserto|recarga|recarda|celular|telefone/]])if(rx.test(n))return label;return 'Outros'}
export function parseMessage(text,accounts,today,cards=[]){
 const n=normalize(text),p={};
 if(/\b(recebi|recebido|entrou|ganhei|vendi|venda|salario|entrada|a receber|para receber|vou receber)\b/.test(n))p.kind='income';
 if(/\b(gastei|paguei|pago|comprei|compra|despesa|saida|a pagar|vou pagar|para pagar)\b/.test(n))p.kind='expense';
 if(/\b(recebi|recebido|paguei|pago|pagou|paga|ja paguei|dinheiro saiu|ja caiu)\b/.test(n)&&!/(nao|ainda nao|nao foi)\s+(paguei|pago|recebi|recebido|paga)/.test(n))p.status='paid';
 if(/\b(a pagar|para pagar|a receber|para receber|pendente|vou pagar|vou receber|falta pagar|nao paguei|nao recebi|nao foi pago|nao foi recebido|nao esta pago|nao esta paga|ainda nao)\b/.test(n))p.status='pending';
 let match=text.match(/R\$\s*(\d[\d.,]*)/i)||text.match(/(\d[\d.,]*)\s*(?:reais|real)\b/i)||n.match(/\b(?:no valor|valor|quantia)\s+(?:de\s+)?(?:r\$\s*)?(\d[\d.,]*)/)||n.match(/(?:recebi|gastei|paguei|vendi|comprei|ganhei|entrada|saida|despesa)\s+(?:de\s+)?(?:r\$\s*)?(\d[\d.,]*)/);
 if(match){const v=moneyCents(match[1]);if(v!==null&&v>0)p.cents=v}
 const exact=accounts.filter(a=>n.includes(normalize(a.name)));if(exact.length===1)p.accountId=exact[0].id;
 if(n==='dinheiro'){const a=accounts.find(a=>normalize(a.name)==='dinheiro');if(a)p.accountId=a.id}
 let date=today;
 const d=n.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
 if(d){try{const year=d[3]?(d[3].length===2?2000+Number(d[3]):Number(d[3])):Number(today.slice(0,4));date=isoDate(year,+d[2],+d[1]);}catch{date=null}if(!date)p.invalidDate=true}
 else if(/\bamanha\b/.test(n))date=shiftDate(today,1);else if(/\bontem\b/.test(n))date=shiftDate(today,-1);
 if(d||/\b(hoje|amanha|ontem)\b/.test(n)){if(!(p.status==='pending'&&/\b(a pagar|para pagar|a receber|para receber|vou pagar|vou receber|vence|vencimento)\b/.test(n)))p.date=date;p.dueDate=date}
 if(/\b(luciano|meu pessoal)\b/.test(n))p.scope='luciano';else if(/\byasmin\b/.test(n))p.scope='yasmin';else if(/\b(casal|nosso|nossa|compartilhado)\b/.test(n))p.scope='casal';
 const credit=/\b(cartao|credito)\b/.test(n)&&! /\bdebito\b/.test(n);const matches=cards.filter(c=>n.includes(normalize(c.name)));if(matches.length===1)p.cardId=matches[0].id;if(credit){p.credit=true;p.kind='expense';p.status='pending';delete p.accountId;}
 p.category=categoryOf(text);
 return p;
}
