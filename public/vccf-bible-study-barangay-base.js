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

/* Paint the giving sub-tabs synchronously as soon as the giving DOM exists. The
   heavier finance reconciler still loads below and can correct totals/ledger
   data in the background without holding up the navigation UI. */
(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS_EARLY__)return;
window.__VCCF_GIVING_TABS_EARLY__=true;
let activeTab='sunday',queued=false;
try{activeTab=sessionStorage.getItem('vccf-giving-subtab')==='bible'?'bible':'sunday'}catch(_){ }

function styles(){
  if(document.getElementById('vccfGivingTabsEarlyStyle'))return;
  const s=document.createElement('style');s.id='vccfGivingTabsEarlyStyle';s.textContent=`
.vccf-giving-tabs{display:flex;gap:8px;align-items:center;margin:14px 0 16px;padding:5px;border:1px solid var(--line);border-radius:14px;background:var(--card-soft,var(--card));overflow-x:auto;-webkit-overflow-scrolling:touch}
.vccf-giving-tab{border:0;background:transparent;color:var(--muted);padding:10px 14px;border-radius:10px;font:inherit;font-size:.78rem;font-weight:900;white-space:nowrap;cursor:pointer;min-height:42px}
.vccf-giving-tab.active{background:var(--card);color:var(--brand);box-shadow:0 1px 4px rgba(15,23,42,.08)}
.vccf-giving-tab-placeholder{padding:18px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:.8rem;text-align:center;background:var(--card-soft,var(--card));margin:0 0 16px}
@media(max-width:700px){.vccf-giving-tabs{display:grid;grid-template-columns:1fr 1fr}.vccf-giving-tab{white-space:normal;line-height:1.25;padding:10px 8px}}
`;document.head.appendChild(s);
}
function remember(tab){activeTab=tab==='bible'?'bible':'sunday';try{sessionStorage.setItem('vccf-giving-subtab',activeTab)}catch(_){ }apply()}
function createBar(id){
  const bar=document.createElement('div');bar.id=id;bar.className='vccf-giving-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Tithes and Offerings sections');
  bar.innerHTML='<button type="button" class="vccf-giving-tab" data-vccf-giving-tab="sunday" role="tab">Sunday Tithes &amp; Offerings</button><button type="button" class="vccf-giving-tab" data-vccf-giving-tab="bible" role="tab">Bible Study Tithes &amp; Offerings</button>';
  bar.querySelectorAll('[data-vccf-giving-tab]').forEach(b=>b.addEventListener('click',()=>remember(b.dataset.vccfGivingTab)));
  return bar;
}
function paint(bar){bar?.querySelectorAll('[data-vccf-giving-tab]').forEach(b=>{const on=b.dataset.vccfGivingTab===activeTab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1})}
function pending(bar,id,text,show){let p=document.getElementById(id);if(show&&!p){p=document.createElement('div');p.id=id;p.className='vccf-giving-tab-placeholder';p.textContent=text;bar.insertAdjacentElement('afterend',p)}else if(!show)p?.remove()}
function standard(root){
  const hero=root.querySelector('.giving-hero');if(!hero)return false;
  let bar=document.getElementById('vccfGivingSectionTabs');if(!bar){bar=createBar('vccfGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}paint(bar);
  [root.querySelector('.sunday-giving'),root.querySelector('#givingStats'),root.querySelector('.giving-ledger'),root.querySelector('.giving-privacy-note')].filter(Boolean).forEach(n=>n.hidden=activeTab!=='sunday');
  const add=root.querySelector('#addGivingRecord');if(add)add.hidden=activeTab!=='sunday';
  const bible=root.querySelector('#bibleStudyGivingFinance');if(bible)bible.hidden=activeTab!=='bible';
  pending(bar,'vccfBibleGivingPending','Loading Bible Study Tithes & Offerings…',activeTab==='bible'&&!bible);return true;
}
function area(root){
  const wrap=root.querySelector('.alg-wrap'),hero=wrap?.querySelector('.alg-hero');if(!wrap||!hero)return false;
  let bar=document.getElementById('vccfAreaGivingSectionTabs');if(!bar){bar=createBar('vccfAreaGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}paint(bar);
  const form=wrap.querySelector('.alg-form-card'),ledger=wrap.querySelector('.alg-ledger'),bible=document.getElementById('areaLeaderBibleStudyGiving'),clean=document.getElementById('vccfAreaSundayLedger');
  if(form)form.hidden=activeTab!=='sunday';if(ledger)ledger.hidden=activeTab!=='sunday'&&!!clean;if(clean)clean.hidden=activeTab!=='sunday';if(bible)bible.hidden=activeTab!=='bible';
  pending(bar,'vccfAreaBibleGivingPending','Loading Bible Study Tithes & Offerings for your area…',activeTab==='bible'&&!bible);return true;
}
function apply(){styles();const root=document.getElementById('giving');if(!root)return;standard(root)||area(root)}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',apply);window.addEventListener('pageshow',apply);window.addEventListener('focus',apply);apply();
})();

(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS_LOADER_V3__)return;
window.__VCCF_GIVING_TABS_LOADER_V3__=true;
let attempts=0;
function load(force=false){
  if(window.__VCCF_GIVING_TABS__)return;
  let old=document.querySelector('script[data-vccf-giving-tabs]');
  if(old&&!force)return;
  if(old)old.remove();
  const s=document.createElement('script');
  s.src='/vccf-giving-tabs.js?v=20260915-3';
  s.async=true;
  s.dataset.vccfGivingTabs='1';
  s.onload=()=>{attempts=0};
  s.onerror=()=>{if(++attempts<3)setTimeout(()=>load(true),350)};
  document.head.appendChild(s);
}
load(false);
window.addEventListener('vccf-app-ready',()=>load(false));
window.addEventListener('pageshow',()=>load(false));
window.addEventListener('focus',()=>load(false));
setTimeout(()=>{if(!window.__VCCF_GIVING_TABS__)load(true)},650);
})();
