const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function chatMessageBody(message){
 const text=String(message.text||'');
 const saved=message.role!=='me'&&text.match(/^(Compra no cartão|Entrada|Despesa) de (R\$\s*[\d.]+,\d{2}) registrada em (.+), (paga\/recebida|pendente)\.(.*)$/s);
 if(saved){
  const [,kind,amount,account,status,note]=saved;
  const detail=kind==='Compra no cartão'?'Na fatura do cartão':status==='pendente'?'Pendente de pagamento ou recebimento':'Pagamento / recebimento registrado';
  return '<div class="chat-saved"><div class="chat-saved-heading"><span class="chat-saved-check" aria-hidden="true">✓</span><strong>Lançamento registrado</strong></div><div class="chat-saved-amount">'+escape(amount)+'</div><div class="chat-saved-account">'+escape(account)+'</div><div class="chat-saved-detail">'+escape(detail)+'</div>'+(note.trim()?'<div class="chat-saved-note">'+escape(note.trim())+'</div>':'')+'</div>';
 }
 return '<div class="message-text">'+escape(text).replace(/R\$\s*[\d.]+,\d{2}/g,'<strong>$&</strong>')+'</div>';
}
