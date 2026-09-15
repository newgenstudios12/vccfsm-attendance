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

/* Paint the giving sub-tabs as soon as the giving view enters its loading state.
   The finance data can continue loading below without blocking navigation. */
(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS_EARLY_V2__)return;
window.__VCCF_GIVING_TABS_EARLY_V2__=true;
let activeTab='sunday',queued=false,moduleRetry=0;
const appState=()=>window.VCCF?.getState?.()||{};
const role=()=>String(appState().profile?.role||'').toLowerCase();

function syncTab(){try{activeTab=sessionStorage.getItem('vccf-giving-subtab')==='bible'?'bible':'sunday'}catch(_){activeTab=activeTab==='bible'?'bible':'sunday'}}
syncTab();

function styles(){
  if(document.getElementById('vccfGivingTabsEarlyStyle'))return;
  const s=document.createElement('style');s.id='vccfGivingTabsEarlyStyle';s.textContent=`
.vccf-giving-tabs{display:flex;gap:8px;align-items:center;margin:14px 0 16px;padding:5px;border:1px solid var(--line);border-radius:14px;background:var(--card-soft,var(--card));overflow-x:auto;-webkit-overflow-scrolling:touch}
.vccf-giving-tab{border:0;background:transparent;color:var(--muted);padding:10px 14px;border-radius:10px;font:inherit;font-size:.78rem;font-weight:900;white-space:nowrap;cursor:pointer;min-height:42px}
.vccf-giving-tab.active{background:var(--card);color:var(--brand);box-shadow:0 1px 4px rgba(15,23,42,.08)}
.vccf-giving-tab-placeholder{padding:18px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:.8rem;text-align:center;background:var(--card-soft,var(--card));margin:0 0 16px}
.vccf-giving-managed-hidden{display:none!important}
@media(max-width:700px){.vccf-giving-tabs{display:grid;grid-template-columns:1fr 1fr}.vccf-giving-tab{white-space:normal;line-height:1.25;padding:10px 8px}}
`;document.head.appendChild(s);
}
function setVisible(node,show){if(!node)return;node.hidden=!show;node.classList.toggle('vccf-giving-managed-hidden',!show)}
function remember(tab){activeTab=tab==='bible'?'bible':'sunday';try{sessionStorage.setItem('vccf-giving-subtab',activeTab)}catch(_){ }apply()}
function createBar(id){
  const bar=document.createElement('div');bar.id=id;bar.className='vccf-giving-tabs';bar.dataset.vccfEarlyBar='1';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Tithes and Offerings sections');
  bar.innerHTML='<button type="button" class="vccf-giving-tab" data-vccf-giving-tab="sunday" role="tab">Sunday Tithes &amp; Offerings</button><button type="button" class="vccf-giving-tab" data-vccf-giving-tab="bible" role="tab">Bible Study Tithes &amp; Offerings</button>';
  bar.querySelectorAll('[data-vccf-giving-tab]').forEach(b=>b.addEventListener('click',()=>remember(b.dataset.vccfGivingTab)));
  return bar;
}
function paint(bar){bar?.querySelectorAll('[data-vccf-giving-tab]').forEach(b=>{const on=b.dataset.vccfGivingTab===activeTab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1})}
function pending(bar,id,text,show){if(!bar)return;let p=document.getElementById(id);if(show&&!p){p=document.createElement('div');p.id=id;p.className='vccf-giving-tab-placeholder';p.textContent=text;bar.insertAdjacentElement('afterend',p)}else if(!show)p?.remove()}

function ensureBibleModule(root,isArea=false){
  if(activeTab!=='bible'||!root)return;
  if(root.querySelector('.giving-loading'))return;
  const loadingArea=[...root.querySelectorAll('.card')].some(x=>String(x.textContent||'').toLowerCase().includes('loading area giving'));
  if(loadingArea)return;
  const area=isArea||role()==='area_leader';
  const guard=area?'__VCCF_AREA_LEADER_BIBLE_STUDY_GIVING__':'__VCCF_BIBLE_STUDY_GIVING__';
  const attr=area?'data-vccf-area-bible-giving':'data-vccf-bible-giving';
  if(window[guard]||document.querySelector('script['+attr+']'))return;
  const s=document.createElement('script');
  s.src=area?'/vccf-area-leader-bible-study-giving.js?v=20260915-2':'/vccf-bible-study-giving.js?v=20260915-2';
  s.async=true;s.setAttribute(attr,'1');
  s.onload=()=>{moduleRetry=0;if(area)setTimeout(()=>window.dispatchEvent(new CustomEvent('vccf-profile-updated')),20);schedule()};
  s.onerror=()=>{s.remove();if(++moduleRetry<3)setTimeout(()=>ensureBibleModule(root,area),300)};
  document.head.appendChild(s);
}

function standard(root){
  const hero=root.querySelector('.giving-hero');
  if(!hero){
    const loading=root.querySelector('.giving-loading');
    if(!loading)return false;
    let bar=document.getElementById('vccfGivingSectionTabs');
    if(!bar&&!window.__VCCF_GIVING_TABS__){bar=createBar('vccfGivingSectionTabs');root.insertBefore(bar,loading)}
    paint(bar);
    pending(bar,'vccfBibleGivingPending','Loading Bible Study Tithes & Offerings…',activeTab==='bible');
    setVisible(loading,activeTab!=='bible');
    return true;
  }
  let bar=document.getElementById('vccfGivingSectionTabs');
  if(!bar&&!window.__VCCF_GIVING_TABS__){bar=createBar('vccfGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}
  paint(bar);
  [root.querySelector('.sunday-giving'),root.querySelector('#givingStats'),root.querySelector('.giving-ledger'),root.querySelector('.giving-privacy-note')].filter(Boolean).forEach(n=>setVisible(n,activeTab==='sunday'));
  const add=root.querySelector('#addGivingRecord');setVisible(add,activeTab==='sunday');
  const bible=root.querySelector('#bibleStudyGivingFinance');setVisible(bible,activeTab==='bible');
  pending(bar,'vccfBibleGivingPending','Loading Bible Study Tithes & Offerings…',activeTab==='bible'&&!bible);
  ensureBibleModule(root,false);
  return true;
}
function area(root){
  const wrap=root.querySelector('.alg-wrap'),hero=wrap?.querySelector('.alg-hero');
  if(!wrap||!hero){
    const loading=[...root.querySelectorAll('.card')].find(x=>String(x.textContent||'').toLowerCase().includes('loading area giving'));
    if(!loading)return false;
    let bar=document.getElementById('vccfAreaGivingSectionTabs');
    if(!bar&&!window.__VCCF_GIVING_TABS__){bar=createBar('vccfAreaGivingSectionTabs');root.insertBefore(bar,loading)}paint(bar);
    pending(bar,'vccfAreaBibleGivingPending','Loading Bible Study Tithes & Offerings for your area…',activeTab==='bible');
    setVisible(loading,activeTab!=='bible');
    return true;
  }
  let bar=document.getElementById('vccfAreaGivingSectionTabs');
  if(!bar&&!window.__VCCF_GIVING_TABS__){bar=createBar('vccfAreaGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}paint(bar);
  const form=wrap.querySelector('.alg-form-card'),ledger=wrap.querySelector('.alg-ledger'),bible=document.getElementById('areaLeaderBibleStudyGiving'),clean=document.getElementById('vccfAreaSundayLedger');
  setVisible(form,activeTab==='sunday');
  if(ledger)setVisible(ledger,activeTab==='sunday'||!clean);
  setVisible(clean,activeTab==='sunday');
  setVisible(bible,activeTab==='bible');
  pending(bar,'vccfAreaBibleGivingPending','Loading Bible Study Tithes & Offerings for your area…',activeTab==='bible'&&!bible);
  ensureBibleModule(root,true);
  return true;
}
function apply(){styles();syncTab();const root=document.getElementById('giving');if(!root)return;standard(root)||area(root)}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-vccf-giving-tab]'))setTimeout(apply,0)},false);
window.addEventListener('vccf-app-ready',apply);window.addEventListener('pageshow',apply);window.addEventListener('focus',apply);apply();
})();

/* Load the heavier finance reconciler only after the main giving view has
   finished its own first fetch, so duplicate queries do not compete with the
   initial screen load. */
(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS_LOADER_V6__)return;
window.__VCCF_GIVING_TABS_LOADER_V6__=true;
let attempts=0,started=false,watcher=null;
function ready(){
  const root=document.getElementById('giving');if(!root)return false;
  if(root.querySelector('.giving-loading'))return false;
  if([...root.querySelectorAll('.card')].some(x=>String(x.textContent||'').toLowerCase().includes('loading area giving')))return false;
  return Boolean(root.querySelector('.giving-hero,.alg-wrap'));
}
function load(force=false){
  if(window.__VCCF_GIVING_TABS__)return;
  let old=document.querySelector('script[data-vccf-giving-tabs]');
  if(old&&!force)return;
  if(old)old.remove();
  const s=document.createElement('script');
  s.src='/vccf-giving-tabs.js?v=20260915-5';
  s.async=true;
  s.dataset.vccfGivingTabs='1';
  s.onload=()=>{
    attempts=0;
    document.querySelectorAll('.vccf-giving-tabs[data-vccf-early-bar="1"]').forEach(x=>x.remove());
    let wakeAttempts=0;
    const wake=()=>{
      window.dispatchEvent(new Event('focus'));
      if(!document.querySelector('#vccfGivingSectionTabs,#vccfAreaGivingSectionTabs')&&wakeAttempts++<6)setTimeout(wake,120);
    };
    setTimeout(wake,0);
  };
  s.onerror=()=>{if(++attempts<3)setTimeout(()=>load(true),350)};
  document.head.appendChild(s);
}
function start(){
  if(started||window.__VCCF_GIVING_TABS__)return;
  if(!ready())return;
  started=true;
  watcher?.disconnect();
  setTimeout(()=>load(false),120);
}
watcher=new MutationObserver(start);watcher.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',start);window.addEventListener('pageshow',start);window.addEventListener('focus',start);start();
setTimeout(()=>{if(!started&&ready()){started=true;watcher?.disconnect();load(false)}},2500);
})();
