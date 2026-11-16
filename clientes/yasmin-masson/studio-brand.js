(function(root){
'use strict';
const oldName=/^yasmin\s+masson(?:\s*[—–·-]\s*estética especializada)?$/i;
const name=value=>oldName.test(String(value||'').trim())?'Salão · Estética':value;
const professional=value=>oldName.test(String(value||'').trim())?'Profissional 1':value;
const logo=value=>/(?:^|\/)logo\.jpg(?:[?#].*)?$/i.test(String(value||''))?'./salon-mark.svg':value;
function catalog(value){if(!value)return value;return {...value,business:value.business?{...value.business,name:name(value.business.name),logo:logo(value.business.logo)}:value.business,barbers:Array.isArray(value.barbers)?value.barbers.map(b=>({...b,name:professional(b.name)})):value.barbers};}
function hours(rows){return Array.isArray(rows)?rows.map(h=>({...h,catalog:h.catalog&&h.catalog.barber?{...h.catalog,barber:{...h.catalog.barber,name:professional(h.catalog.barber.name)}}:h.catalog})):rows;}
function state(value){return {...value,catalog:catalog(value.catalog),hours:hours(value.hours)};}
function panel(value){const c=catalog(value);return {...value,business:c.business,barbers:c.barbers};}
root.StudioBrand=Object.freeze({catalog,hours,state,panel});
})(window);
