(()=>{
'use strict';
if(window.__VCCF_MEMBER_ADDRESS_FILTER__)return;
window.__VCCF_MEMBER_ADDRESS_FILTER__=true;

const state=()=>window.VCCF?.getState?.()||{};
const norm=v=>String(v||'').trim().toLocaleLowerCase('en-PH');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer=0,observer=null;

function controls(){
  return {
    toolbar:document.querySelector('#members .member-directory-toolbar')||document.querySelector('#members .toolbar'),
    search:document.getElementById('richMemberSearch')||document.getElementById('memberSearch'),
    area:document.getElementById('richAreaFilter')||document.getElementById('areaFilter'),
    tableHost:document.getElementById('richMemberTable')||document.getElementById('membersTable')
  };
}
function addressParts(m){return {barangay:String(m?.barangay||'').trim(),city:String(m?.city_municipality||'').trim(),province:String(m?.province||'').trim(),street:String(m?.address||'').trim()}}
function membersInArea(){const {area}=controls(),value=area?.value||'';return (state().members||[]).filter(m=>!value||String(m.area_id||'')===String(value))}
function uniqueValues(key){const map=new Map();membersInArea().forEach(m=>{const v=addressParts(m)[key];if(!v)return;const k=norm(v);if(k&&!map.has(k))map.set(k,v)});return [...map.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}))}
function group(label,key,values){if(!values.length)return '';return `<optgroup label="${esc(label)}">${values.map(v=>`<option value="${esc(key+':'+norm(v))}">${esc(v)}</option>`).join('')}</optgroup>`}
function fill(select){if(!select)return;const previous=select.value;select.innerHTML='<option value="">All addresses</option>'+group('Barangay / Cellgroup','barangay',uniqueValues('barangay'))+group('City / Municipality','city',uniqueValues('city'))+group('Province','province',uniqueValues('province'));if([...select.options].some(o=>o.value===previous))select.value=previous}
function matches(member,value){if(!value)return true;const i=value.indexOf(':');if(i<1)return true;const key=value.slice(0,i),wanted=value.slice(i+1);return norm(addressParts(member)[key])===wanted}
function memberForRow(row){const id=row.dataset.memberId;if(id)return (state().members||[]).find(m=>String(m.id)===String(id))||null;const code=norm(row.children?.[1]?.textContent||'');if(code)return (state().members||[]).find(m=>norm(m.member_code)===code)||null;const display=norm(row.children?.[0]?.querySelector('b')?.textContent||'');return (state().members||[]).find(m=>norm(m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' '))===display)||null}
function updateStats(visibleMembers){const stats=document.getElementById('memberDirectoryStats');if(!stats)return;const active=visibleMembers.filter(m=>m.is_active!==false&&String(m.status||'active').toLowerCase()!=='inactive').length,inactive=visibleMembers.length-active;stats.innerHTML=`<article class="member-stat-card"><span>Total shown</span><strong>${visibleMembers.length}</strong></article><article class="member-stat-card active"><span>Active</span><strong>${active}</strong></article><article class="member-stat-card inactive"><span>Inactive</span><strong>${inactive}</strong></article>`}
function apply(){
  const select=document.getElementById('memberAddressFilter'),{tableHost}=controls();if(!select||!tableHost)return;
  const rows=[...tableHost.querySelectorAll('tbody tr')],visibleMembers=[];
  rows.forEach(row=>{const m=memberForRow(row),show=!m||matches(m,select.value);row.hidden=!show;if(show&&m)visibleMembers.push(m)});
  updateStats(visibleMembers);
  let empty=document.getElementById('memberAddressFilterEmpty');const table=tableHost.querySelector('table');
  if(rows.length&&select.value&&!visibleMembers.length){if(!empty){empty=document.createElement('div');empty.id='memberAddressFilterEmpty';empty.className='empty';empty.textContent='No members match the selected address.';tableHost.appendChild(empty)}if(table)table.style.display='none'}else{empty?.remove();if(table)table.style.display='table'}
}
function mount(){
  const {toolbar,area}=controls();if(!toolbar||!area)return;
  let select=document.getElementById('memberAddressFilter');if(!select){select=document.createElement('select');select.id='memberAddressFilter';select.setAttribute('aria-label','Filter members by address');select.title='Filter members by address';area.insertAdjacentElement('afterend',select);select.addEventListener('change',apply)}
  fill(select);apply();
}
function styles(){if(document.getElementById('vccfMemberAddressFilterCss'))return;const s=document.createElement('style');s.id='vccfMemberAddressFilterCss';s.textContent=`#memberAddressFilter{min-height:42px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);font:inherit}#members .member-directory-toolbar{align-items:center}#richMemberSearch{flex:1 1 260px;min-width:180px}#richAreaFilter,#memberAddressFilter{flex:0 1 220px;min-width:150px}#richMemberTable tr[hidden],#membersTable tr[hidden]{display:none!important}@media(max-width:720px){#members .member-directory-toolbar{display:grid;grid-template-columns:1fr 1fr}#richMemberSearch{grid-column:1/-1;width:100%}#richAreaFilter,#memberAddressFilter{width:100%;min-width:0}.member-qr-print-tools{grid-column:1/-1}}@media(max-width:430px){#members .member-directory-toolbar{grid-template-columns:1fr}#richMemberSearch{grid-column:1}.member-qr-print-tools{grid-column:1}}`;document.head.appendChild(s)}
function queue(){clearTimeout(timer);timer=setTimeout(()=>{styles();mount();apply()},70)}
function watch(){if(observer)return;observer=new MutationObserver(records=>{const toolbar=document.querySelector('#members .member-directory-toolbar')||document.querySelector('#members .toolbar');if(toolbar&&!document.getElementById('memberAddressFilter')){queue();return}if(records.some(r=>r.target?.closest?.('#richMemberTable,#membersTable')))setTimeout(apply,0)});observer.observe(document.documentElement,{childList:true,subtree:true})}
document.addEventListener('input',e=>{if(['richMemberSearch','memberSearch'].includes(e.target?.id))setTimeout(apply,0)},true);
document.addEventListener('change',e=>{if(['richAreaFilter','areaFilter'].includes(e.target?.id))setTimeout(()=>{fill(document.getElementById('memberAddressFilter'));apply()},0)},true);
window.addEventListener('vccf-app-ready',queue);window.addEventListener('focus',queue);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{watch();queue()},{once:true});else{watch();queue()}
})();
