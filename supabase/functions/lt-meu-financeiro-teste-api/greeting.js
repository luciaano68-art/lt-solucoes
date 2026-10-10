export function greetingDay(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export async function greetingMessage(user,first,now=new Date()){
 const day=greetingDay(now),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(now));
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('teste-greeting:'+user.id+':'+day)));
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20,32);
 const text=first?'Bem-vindo ao Meu Financeiro! Seu dinheiro organizado começa com uma conversa. Vamos registrar sua primeira movimentação?':(hour<12?'Bom dia!':hour<18?'Boa tarde!':'Boa noite!')+' Tudo bem? O que vamos anotar hoje?';
 return {id,role:'bot',text,time:now.toISOString()};
}
