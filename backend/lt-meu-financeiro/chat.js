const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid=()=>{throw Object.assign(Error('Mensagem inválida. Atualize a conversa e tente novamente.'),{status:400})};
export function chatRows(messages,user,now=Date.now()){
 if(!Array.isArray(messages)||!messages.length||messages.length>20)invalid();
 return messages.map(m=>{if(!m||!uuid.test(m.id)||!['me','bot'].includes(m.role)||typeof m.text!=='string'||!m.text.trim()||m.text.length>50000||!Number.isFinite(Date.parse(m.time))||Date.parse(m.time)<Date.parse('2020-01-01')||Date.parse(m.time)>now+300000)invalid();return {user_id:user.id,message_id:m.id.toLowerCase(),role:m.role,text:m.text,created_at:new Date(m.time).toISOString()};});
}
export function chatQuery(user,before){
 let query='?user_id=eq.'+user.id+'&select=message_id,role,text,created_at&order=created_at.desc,message_id.desc&limit=121';
 if(before){if(!uuid.test(before.id)||!Number.isFinite(Date.parse(before.time)))invalid();const time=new Date(before.time).toISOString();query+='&or='+encodeURIComponent('(created_at.lt.'+time+',and(created_at.eq.'+time+',message_id.lt.'+before.id.toLowerCase()+'))');}
 return query;
}
export function chatPage(rows){const more=rows.length>120,list=rows.slice(0,120).reverse().map(m=>({id:m.message_id,role:m.role,text:m.text,time:new Date(m.created_at).toISOString()}));return {messages:list,hasOlder:more,before:list.length?{id:list[0].id,time:list[0].time}:null};}
