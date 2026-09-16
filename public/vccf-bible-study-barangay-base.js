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

let timer=0,observer=null,observedHost=null,bindTimer=0;
function queue(){clearTimeout(timer);timer=setTimeout(()=>{patchCurrentSummary();patchGalleryAndPreview();patchLocationLabel()},60)}
function bindObserver(){
  const host=document.getElementById('serviceAttendancePanel')||document.getElementById('serviceSummaryHost');
  if(host===observedHost)return;
  observer?.disconnect();
  observedHost=host||null;
  if(!host)return;
  observer=new MutationObserver(queue);
  observer.observe(host,{childList:true,subtree:true});
  queue();
}
function scheduleBind(delay=60){clearTimeout(bindTimer);bindTimer=setTimeout(bindObserver,delay)}
document.addEventListener('change',e=>{if(e.target?.id==='serviceAttendanceType'||e.target?.id==='serviceStudyArea'||e.target?.id==='serviceStudyBarangay'){scheduleBind(0);queue()}},true);
document.addEventListener('input',e=>{if(e.target?.id==='serviceStudyBarangay')queue()},true);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-route="attendance"],[data-view="attendance"]'))setTimeout(()=>{scheduleBind(0);queue()},100)},true);
window.addEventListener('vccf-app-ready',()=>{scheduleBind(0);queue()});
window.addEventListener('focus',()=>{scheduleBind(0);queue()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scheduleBind(0);queue()},{once:true});else{scheduleBind(0);queue()}
setTimeout(()=>scheduleBind(0),700);
setTimeout(()=>scheduleBind(0),1600);
})();

/* Paint the giving sub-tabs as soon as the giving view enters its loading state.
   Start the Bible Study finance module in parallel so its data is already warm
   by the time the giving view finishes rendering. */
(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS_EARLY_V2__)return;
window.__VCCF_GIVING_TABS_EARLY_V2__=true;
let activeTab='sunday',queued=false,moduleRetry=0,givingObserver=null,observedGiving=null,wakeTimer=0;
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
  if(!root)return;
  const area=isArea||role()==='area_leader';
  const guard=area?'__VCCF_AREA_LEADER_BIBLE_STUDY_GIVING__':'__VCCF_BIBLE_STUDY_GIVING__';
  const attr=area?'data-vccf-area-bible-giving':'data-vccf-bible-giving';
  if(window[guard]||document.querySelector('script['+attr+']'))return;
  const s=document.createElement('script');
  s.src=area?'/vccf-area-leader-bible-study-giving.js?v=20260916-1':'/vccf-bible-study-giving.js?v=20260916-1';
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
    if(!bar){bar=createBar('vccfGivingSectionTabs');root.insertBefore(bar,loading)}
    paint(bar);
    pending(bar,'vccfBibleGivingPending','Loading Bible Study Tithes & Offerings…',activeTab==='bible');
    setVisible(loading,activeTab!=='bible');
    ensureBibleModule(root,false);
    return true;
  }
  let bar=document.getElementById('vccfGivingSectionTabs');
  if(!bar){bar=createBar('vccfGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}
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
    if(!bar){bar=createBar('vccfAreaGivingSectionTabs');root.insertBefore(bar,loading)}paint(bar);
    pending(bar,'vccfAreaBibleGivingPending','Loading Bible Study Tithes & Offerings for your area…',activeTab==='bible');
    setVisible(loading,activeTab!=='bible');
    ensureBibleModule(root,true);
    return true;
  }
  let bar=document.getElementById('vccfAreaGivingSectionTabs');
  if(!bar){bar=createBar('vccfAreaGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}paint(bar);
  const form=wrap.querySelector('.alg-form-card'),ledger=wrap.querySelector('.alg-ledger'),bible=document.getElementById('areaLeaderBibleStudyGiving'),clean=document.getElementById('vccfAreaSundayLedger');
  setVisible(form,activeTab==='sunday');
  if(ledger)setVisible(ledger,activeTab==='sunday'||!clean);
  setVisible(clean,activeTab==='sunday');
  setVisible(bible,activeTab==='bible');
  pending(bar,'vccfAreaBibleGivingPending','Loading Bible Study Tithes & Offerings for your area…',activeTab==='bible'&&!bible);
  ensureBibleModule(root,true);
  return true;
}
function bindGivingObserver(){
  const root=document.getElementById('giving');
  if(root===observedGiving)return root;
  givingObserver?.disconnect();
  observedGiving=root||null;
  if(root){givingObserver=new MutationObserver(schedule);givingObserver.observe(root,{childList:true,subtree:true})}
  return root;
}
function apply(){styles();syncTab();const root=bindGivingObserver()||document.getElementById('giving');if(!root)return;standard(root)||area(root)}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}
function wake(delay=0){clearTimeout(wakeTimer);wakeTimer=setTimeout(()=>{wakeTimer=0;apply()},delay)}
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-vccf-giving-tab]'))setTimeout(apply,0);
  if(e.target.closest?.('#areaLeaderGivingNav,[data-route="giving"]'))wake(80);
},false);
window.addEventListener('vccf-app-ready',()=>wake(120));
window.addEventListener('pageshow',()=>wake(0));
window.addEventListener('focus',()=>wake(0));
window.addEventListener('vccf-finance-access',e=>{if(e?.detail?.allowed===true)wake(0)});
wake(500);
setTimeout(()=>wake(0),1500);
})();

/* Load the heavier finance reconciler only after the main giving view has
   finished its own first fetch, so duplicate queries do not compete with the
   initial screen load. */
(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS_LOADER_V7__)return;
window.__VCCF_GIVING_TABS_LOADER_V7__=true;
let attempts=0,started=false,checkTimer=0,checks=0;
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
  s.src='/vccf-giving-tabs.js?v=20260916-1';
  s.async=true;
  s.dataset.vccfGivingTabs='1';
  s.onload=()=>{
    attempts=0;
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
function check(){
  checkTimer=0;
  if(started||window.__VCCF_GIVING_TABS__)return;
  if(ready()){started=true;setTimeout(()=>load(false),100);return}
  if(checks++<30)checkTimer=setTimeout(check,250);
}
function kick(reset=false){
  if(started||window.__VCCF_GIVING_TABS__)return;
  if(reset)checks=0;
  if(!checkTimer)checkTimer=setTimeout(check,0);
}
document.addEventListener('click',e=>{if(e.target.closest?.('#areaLeaderGivingNav,[data-route="giving"]'))kick(true)},true);
window.addEventListener('vccf-app-ready',()=>kick(true));
window.addEventListener('pageshow',()=>kick(false));
window.addEventListener('focus',()=>kick(false));
kick(true);
})();