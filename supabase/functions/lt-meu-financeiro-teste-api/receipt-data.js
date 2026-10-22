// Only bounded, plain data from a user-reviewed receipt can enter the ledger.
export function validateReceiptData(input){
 if(input==null)return undefined;
 if(typeof input!=='object'||Array.isArray(input)||input.source!=='photo-ocr')throw Error('Dados da notinha inválidos.');
 if(input.imageHash!=null&&!/^[a-f0-9]{64}$/.test(input.imageHash))throw Error('Identificação da foto inválida.');
 const out={source:'photo-ocr'},texts={merchant:300,cnpj:30,date:10,time:8,paymentMethod:80,documentNumber:40,cardLast4:4,rawText:24000,imageHash:64};
 for(const [key,max] of Object.entries(texts)){const v=input[key];if(v==null)continue;if(typeof v!=='string'||v.length>max)throw Error('Dados da notinha excedem o limite.');out[key]=v;}
 for(const key of ['totalCents','subtotalCents','discountCents','feesCents','taxesCents','changeCents','tenderedCents']){const v=input[key];if(v==null)continue;if(!Number.isSafeInteger(v)||Math.abs(v)>100000000000)throw Error('Valor da notinha inválido.');out[key]=v;}
 if(input.installments!=null){if(!Number.isInteger(input.installments)||input.installments<1||input.installments>60)throw Error('Parcelas inválidas.');out.installments=input.installments;}
 if(input.confidence!=null){if(!Number.isFinite(input.confidence)||input.confidence<0||input.confidence>100)throw Error('Qualidade da leitura inválida.');out.confidence=input.confidence;}
 if(input.items!=null){if(!Array.isArray(input.items)||input.items.length>150)throw Error('Até 150 linhas de itens por notinha.');out.items=input.items.map(item=>{if(!item||typeof item.line!=='string'||item.line.length>500)throw Error('Item da notinha inválido.');const row={line:item.line};for(const key of ['quantity','unit'])if(item[key]!=null){if(typeof item[key]!=='string'||item[key].length>30)throw Error('Quantidade da notinha inválida.');row[key]=item[key];}for(const key of ['unitCents','totalCents'])if(item[key]!=null){if(!Number.isSafeInteger(item[key])||Math.abs(item[key])>100000000000)throw Error('Preço da notinha inválido.');row[key]=item[key];}return row;});}
 if(JSON.stringify(out).length>52000)throw Error('Notinha muito extensa. Divida a imagem e confira os dados antes de lançar.');
 return out;
}
