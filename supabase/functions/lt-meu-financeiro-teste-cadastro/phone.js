export function normalizePhone(value){
 if(typeof value!=='string'||value.length>30)return null;
 let digits=value.replace(/\D/g,'');if((digits.length===12||digits.length===13)&&digits.startsWith('55'))digits=digits.slice(2);
 return /^[1-9][0-9][2-9][0-9]{7,8}$/.test(digits)?'55'+digits:null;
}
