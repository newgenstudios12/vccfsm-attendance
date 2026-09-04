(()=>{
'use strict';
if(window.__VCCF_MEMBER_ADDRESS_FILTER__)return;
window.__VCCF_MEMBER_ADDRESS_FILTER__=true;

const state=()=>window.VCCF?.getState?.()||{};
const norm=v=>String(v||'').trim().toLocaleLowerCase('en-PH');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scheduled=0,observer=null;

function addressParts(m){
  return {
    barangay:String(m?.barangay||'').trim(),
    city:String(m?.city_municipality||'').trim(),
    province:String(m?.province||'').trim(),
    street:String(m?.address||'').trim()
  };
}
function membersForArea(){
  const area=document.getElementById('areaFilter')?.value||'';
  return (state().members||[]).filter(m=>!area||String(m.area_id||'')===String(area));
}
function uniqueValues(key){
  const map=new Map();
  membersForArea().forEach(m=>{const value=addressParts(m)[key];if(!value)return;const k=norm(value);if(k&&!map.has(k))map.set(k,value)});
  return [...map.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
}
function optionGroup(label,key,values){
  if(!values.length)return '';
  return `<optgroup label="${esc(label)}">${values.map(v=>`<option value="${esc(key+':'+norm(v))}">${esc(v)}</option>`).join('')}</optgroup>`;
}
function fillOptions(select){
  if(!select)return;
  const previous=select.value;
  select.innerHTML='<option value="">All addresses</option>'+optionGroup('Barangay / Cellgroup','barangay',uniqueValues('barangay'))+optionGroup('City / Municipality','city',uniqueValues('city'))+optionGroup('Province','province',uniqueValues('province'));
  if([...select.options].some(o=>o.value===previous))select.value=previous;
}
function matches(member,value){
  if(!value)return true;
  const split=value.indexOf(':');if(split<1)return true;
  const key=value.slice(0,split),wanted=value.slice(split+1),parts=addressParts(member);
  return norm(parts[key])===wanted;
}
function memberByRow(row){
  const code=norm(row.children?.[1]?.textContent||'');
  if(code)return (state().members||[]).find(m=>norm(m.member_code)===code)||null;
  const name=norm(row.children?.[0]?.querySelector('b')?.textContent||'');
  return (state().members||[]).find(m=>norm(m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' '))===name)||null;
}
function apply(){
  const select=document.getElementById('memberAddressFilter');if(!select)return;
  const value=select.value,rows=[...document.querySelectorAll('#membersTable tbody tr')];
  rows.forEach(row=>{const member=memberByRow(row);row.hidden=Boolean(member&&!matches(member,value))});
  const visible=rows.filter(r=>!r.hidden).length,table=document.querySelector('#membersTable table');
  let empty=document.getElementById('memberAddressFilterEmpty');
  if(rows.length&&value&&!visible){
    if(!empty){empty=document.createElement('div');empty.id='memberAddressFilterEmpty';empty.className='empty';empty.textContent='No members match the selected address.';document.getElementById('membersTable')?.appendChild(empty)}
    if(table)table.style.display='none';
  }else{
    empty?.remove();if(table)table.style.display='table';
  }
}
function mount(){
  const toolbar=document.querySelector('#members .toolbar'),area=document.getElementById('areaFilter');if(!toolbar||!area)return;
  let select=document.getElementById('memberAddressFilter');
  if(!select){
    select=document.createElement('select');select.id='memberAddressFilter';select.setAttribute('aria-label','Filter members by address');select.title='Filter members by address';area.insertAdjacentElement('afterend',select);
    select.addEventListener('change',apply);
    area.addEventListener('change',()=>setTimeout(()=>{fillOptions(select);apply()},0));
  }
  fillOptions(select);apply();
}
function styles(){if(document.getElementById('vccfMemberAddressFilterCss'))return;const s=document.createElement('style');s.id='vccfMemberAddressFilterCss';s.textContent=`#members .toolbar{justify-content:flex-start;align-items:center}#memberSearch{flex:1 1 260px;min-width:180px}#areaFilter,#memberAddressFilter{flex:0 1 220px;min-width:150px}#membersTable tr[hidden]{display:none!important}@media(max-width:680px){#members .toolbar{display:grid;grid-template-columns:1fr 1fr}#memberSearch{grid-column:1/-1;width:100%}#areaFilter,#memberAddressFilter{width:100%;min-width:0}}@media(max-width:430px){#members .toolbar{grid-template-columns:1fr}#memberSearch{grid-column:1}}`;document.head.appendChild(s)}
function queue(){clearTimeout(scheduled);scheduled=setTimeout(()=>{styles();mount();apply()},80)}
function observeTable(){if(observer)return;observer=new MutationObserver(()=>{if(document.getElementById('membersTable'))setTimeout(apply,0)});observer.observe(document.documentElement,{childList:true,subtree:true})}
document.addEventListener('input',e=>{if(e.target?.id==='memberSearch')setTimeout(apply,0)},true);
document.addEventListener('change',e=>{if(e.target?.id==='areaFilter')setTimeout(()=>{const s=document.getElementById('memberAddressFilter');fillOptions(s);apply()},0)},true);
window.addEventListener('vccf-app-ready',queue);window.addEventListener('focus',queue);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observeTable();queue()},{once:true});else{observeTable();queue()}
})();
