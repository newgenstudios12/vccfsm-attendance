(()=>{
'use strict';
if(window.__VCCF_BIBLE_STUDY_BARANGAY_BASE__)return;
window.__VCCF_BIBLE_STUDY_BARANGAY_BASE__=true;

const state=()=>window.VCCF?.getState?.()||{};
const norm=v=>String(v||'').trim().toLocaleLowerCase('en-PH');
const active=m=>m?.is_active!==false&&norm(m?.status)!=='inactive';

function currentBarangayBase(){
  if(document.getElementById('serviceAttendanceType')?.value!=='bible_study')return null;
  const areaId=document.getElementById('serviceStudyArea')?.value||'';
  const barangay=norm(document.getElementById('serviceStudyBarangay')?.value||'');
  if(!areaId||!barangay)return null;
  return (state().members||[]).filter(m=>active(m)&&String(m.area_id||'')===String(areaId)&&norm(m.barangay)===barangay).length;
}

function patchCurrentSummary(){
  if(document.getElementById('serviceAttendanceType')?.value!=='bible_study')return;
  const stats=document.querySelector('#serviceSummaryHost > .service-summary-card .service-summary-stats');
  const cell=stats?.children?.[1];
  if(!cell)return;
  const label=cell.querySelector('span'),value=cell.querySelector('strong'),count=currentBarangayBase();
  if(label&&label.textContent!=='Active members in Barangay / Cellgroup')label.textContent='Active members in Barangay / Cellgroup';
  if(value&&count!==null&&value.textContent!==String(count))value.textContent=String(count);
}

function patchGalleryAndPreview(){
  document.querySelectorAll('.service-summary-gallery-card .service-summary-gallery-metrics').forEach(metrics=>{
    const label=metrics.children?.[2]?.querySelector('span');
    if(label&&label.textContent!=='Barangay / Cellgroup Base')label.textContent='Barangay / Cellgroup Base';
  });
  const preview=document.querySelector('#serviceSummaryPreviewOverlay .service-summary-preview-stats');
  const previewLabel=preview?.children?.[2]?.querySelector('span');
  if(previewLabel&&previewLabel.textContent!=='Active members in Barangay / Cellgroup')previewLabel.textContent='Active members in Barangay / Cellgroup';
}

function patchLocationLabel(){
  const input=document.getElementById('serviceStudyBarangay'),label=input?.closest('label');
  if(!label)return;
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&norm(n.textContent)==='barangay');
  if(node)node.textContent='Barangay / Cellgroup';
}

let timer=0;
function queue(){clearTimeout(timer);timer=setTimeout(()=>{patchCurrentSummary();patchGalleryAndPreview();patchLocationLabel()},60)}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('change',e=>{if(e.target?.id==='serviceAttendanceType'||e.target?.id==='serviceStudyArea'||e.target?.id==='serviceStudyBarangay')queue()},true);
document.addEventListener('input',e=>{if(e.target?.id==='serviceStudyBarangay')queue()},true);
window.addEventListener('vccf-app-ready',queue);
window.addEventListener('focus',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();
