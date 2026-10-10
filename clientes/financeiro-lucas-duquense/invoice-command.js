const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function invoiceCloseCommand(text,data,today,chosenCardId=null,selectedMonth=null){
 const n=norm(text),command=/\b(fechar|feche|fechou|fechamento|encerrar|encerre)\b/.test(n)&&/\b(fatura|cartao)\b/.test(n);
 if(!chosenCardId&&!command)return null;
 let month=selectedMonth;const date=n.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/)||n.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
 if(date)month=date[1].length===4?date[1]+'-'+date[2]:date[2]+'-'+date[1];
 const cards=data.cards||[];let candidates=chosenCardId?cards.filter(c=>c.id===chosenCardId):cards.filter(c=>n.includes(norm(c.name)));
 if(!chosenCardId&&!candidates.length){candidates=cards.filter(c=>norm(c.name).split(/[^a-z0-9]+/).some(word=>word.length>=3&&new RegExp('\\b'+word+'\\b').test(n)));if(!candidates.length)candidates=cards;}
 if(!candidates.length)return {error:'Cadastre um cartão antes de fechar uma fatura.'};
 if(candidates.length>1)return {choices:candidates,month};
 const card=candidates[0],open=(data.invoices||[]).filter(b=>b.cardId===card.id&&b.status==='open'&&(!month||b.cycle===month)).sort((a,b)=>a.cycle.localeCompare(b.cycle));
 const hasItems=b=>(data.entries||[]).some(e=>!e.deleted&&e.invoiceId===b.id);
 const invoice=open.find(hasItems)||open.find(b=>b.closeDate<=today)||open[0];
 return invoice?{card,invoice,month}:{error:'Não há fatura aberta'+(month?' de '+month.split('-').reverse().join('/'):'')+' do cartão '+card.name+'. Confira as faturas na aba Cartões.'};
}
