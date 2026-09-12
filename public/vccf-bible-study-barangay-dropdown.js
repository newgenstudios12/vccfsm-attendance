(()=>{
'use strict';
if(window.__VCCF_BIBLE_STUDY_BARANGAY_DROPDOWN__)return;
window.__VCCF_BIBLE_STUDY_BARANGAY_DROPDOWN__=true;

const state=()=>window.VCCF?.getState?.()||{};
const norm=v=>String(v||'').trim().toLocaleLowerCase('en-PH');
const active=m=>m?.is_active!==false&&norm(m?.status)!=='inactive';
let timer=0;

function barangays(areaId){
  const map=new Map();
  (state().members||[]).filter(m=>active(m)&&(!areaId||String(m.area_id||'')===String(areaId))).forEach(m=>{
    const value=String(m.barangay||'').trim();
    if(value&&!map.has(norm(value)))map.set(norm(value),value);
  });
  return [...map.values()].sort((a,b)=>a.localeCompare(b,'en-PH'));
}

function syncDropdown(){
  const input=document.getElementById('serviceStudyBarangay');
  const area=document.getElementById('serviceStudyArea');
  const type=document.getElementById('serviceAttendanceType');
  if(!input||!area||!type)return;

  const label=input.closest('label');
  let select=document.getElementById('serviceStudyBarangayDropdown');
  if(!select){
    select=document.createElement('select');
    select.id='serviceStudyBarangayDropdown';
    select.setAttribute('aria-label','Barangay / Cellgroup');
    select.style.width='100%';
    select.style.minHeight='44px';
    select.style.fontSize='16px';
    select.style.padding='11px 12px';
    select.style.border='1px solid var(--line)';
    select.style.borderRadius='11px';
    select.style.background='var(--input,var(--card))';
    select.style.color='var(--text)';
    select.style.outline='none';
    input.insertAdjacentElement('afterend',select);
    select.addEventListener('change',()=>{
      input.value=select.value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  const isBible=type.value==='bible_study';
  select.hidden=!isBible;
  input.hidden=isBible;
  if(label){
    const text=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&norm(n.textContent).includes('barangay'));
    const wanted=isBible?'Barangay / Cellgroup':'Barangay';
    if(text&&text.textContent!==wanted)text.textContent=wanted;
  }
  if(!isBible)return;

  const current=String(input.value||'').trim();
  const values=barangays(area.value||'');
  const key=String(area.value||'')+'|'+values.map(norm).join('|');
  const exists=current&&values.some(v=>norm(v)===norm(current));

  if(select.dataset.optionsKey!==key){
    select.innerHTML='<option value="">Select Barangay / Cellgroup</option>'+values.map(v=>'<option value="'+v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'">'+v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</option>').join('');
    select.dataset.optionsKey=key;
  }

  if(exists){
    const value=values.find(v=>norm(v)===norm(current))||'';
    if(select.value!==value)select.value=value;
    if(input.value!==value)input.value=value;
  }else if(current){
    input.value='';
    select.value='';
  }
}

function queue(){clearTimeout(timer);timer=setTimeout(syncDropdown,80)}
new MutationObserver(records=>{
  if(records.every(r=>r.target?.id==='serviceStudyBarangayDropdown'||r.target?.closest?.('#serviceStudyBarangayDropdown')))return;
  queue();
}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('change',e=>{if(['serviceAttendanceType','serviceStudyArea'].includes(e.target?.id))queue()},true);
window.addEventListener('vccf-app-ready',queue);
window.addEventListener('focus',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();
