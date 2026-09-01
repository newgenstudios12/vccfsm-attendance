(()=>{'use strict';
if(window.__VCCF_NAV_FINAL_FIX_V1__)return;window.__VCCF_NAV_FINAL_FIX_V1__=true;
const q=(s,c=document)=>c.querySelector(s);
const qa=(s,c=document)=>Array.from(c.querySelectorAll(s));
const views=new Set(['dashboard','members','attendance','selfcheck','gallery','about','settings','analytics','events','notifications','profile','sermons']);
const realSuite='/vccf-church-management-suite.js';
const coreIds={dashboard:'dashboard',members:'members',attendance:'attendance',selfcheck:'selfcheck',gallery:'gallery',about:'about',settings:'settings',analytics:'suite2-analytics',events:'suite2-events',notifications:'suite2-notifications',profile:'suite2-profile',sermons:'sermons'};
function markActive(btn){qa('.nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active')}
function closeMobile(){document.body.classList.remove('vccf-mobile-drawer-open');q('.vccf-mobile-backdrop')?.classList.remove('open');q('.sidebar')?.classList.remove('vccf-drawer-open')}
function setTitle(v){const labels={dashboard:'Dashboard',members:'Members',attendance:'Attendance',selfcheck:'Self Check-In',gallery:'Gallery',about:'About VCCF',settings:'Settings',analytics:'Analytics',events:'Events',notifications:'Notifications',profile:'My Profile',sermons:'Sermons','church-management':'Church Management'};const el=q('#pageTitle');if(el&&labels[v])el.textContent=labels[v]}
function activate(v,btn=null){
 if(v==='church-management')return showChurchManagement(btn);
 const id=coreIds[v]||v;const target=document.getElementById(id);if(!target)return false;
 qa('.main .view').forEach(x=>x.classList.remove('active'));target.classList.add('active');markActive(btn);setTitle(v);closeMobile();
 if(v==='members'&&typeof window.renderMembers==='function'){try{window.renderMembers()}catch(e){console.warn('renderMembers',e)}}
 if(v==='sermons'&&window.VCCFSermons?.open){try{window.VCCFSermons.open()}catch(e){console.warn('sermons',e)}}
 return true;
}
function showChurchManagement(btn=null){
 const direct=q('#churchSuiteView');
 if(direct){qa('.main .view').forEach(x=>x.classList.remove('active'));direct.classList.add('active');markActive(btn||q('[data-suite-nav]')||q('[data-vccf-final-church-nav]'));setTitle('church-management');closeMobile();return true}
 const suiteBtn=q('[data-suite-nav]');if(suiteBtn&&suiteBtn!==btn){try{suiteBtn.click();return true}catch{}}
 return false;
}
function ensureChurchLoader(){
 if(q('script[data-vccf-church-suite-loader="1"]')||window.__VCCF_CHURCH_SUITE__)return;
 const s=document.createElement('script');s.src=realSuite+'?v=final2';s.async=false;s.dataset.vccfChurchSuiteLoader='1';document.head.appendChild(s);
}
function ensureChurchFallback(){
 const nav=q('.nav');if(!nav)return;
 if(q('[data-suite-nav]',nav)||q('[data-vccf-final-church-nav]',nav))return;
 const b=document.createElement('button');b.type='button';b.dataset.vccfFinalChurchNav='1';b.dataset.view='church-management';b.innerHTML='<span aria-hidden="true">⛪</span> <span class="nav-label">Church Management</span>';b.title='Church Management';
 b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!showChurchManagement(b))ensureChurchLoader()});nav.appendChild(b);
}
function waitForSuite(){const started=Date.now();const tick=()=>{if(q('#churchSuiteView')||q('[data-suite-nav]'))return;if(Date.now()-started<10000){ensureChurchLoader();setTimeout(tick,250)}};tick()}
function bindNav(){
 const nav=q('.nav');if(!nav||nav.dataset.vccfFinalBound==='1')return;nav.dataset.vccfFinalBound='1';
 nav.addEventListener('click',e=>{
   const b=e.target.closest?.('button');if(!b||!nav.contains(b))return;
   const v=b.dataset.view||b.dataset.suiteV2||b.dataset.vccfCoreNav;
   if(v==='church-management'){e.preventDefault();e.stopPropagation();showChurchManagement(b)||ensureChurchLoader();return}
   if(!v||!views.has(v))return;
   const target=document.getElementById(coreIds[v]||v);
   if(target){e.preventDefault();e.stopPropagation();activate(v,b)}
 },true);
}
function addCss(){if(q('#vccf-nav-final-style'))return;const s=document.createElement('style');s.id='vccf-nav-final-style';s.textContent='.nav{overflow-y:auto!important;overflow-x:hidden!important;max-height:calc(100vh - 150px)!important;overscroll-behavior:contain!important;scrollbar-width:thin}.nav button{position:relative!important;z-index:25!important;pointer-events:auto!important;flex:none!important;touch-action:manipulation!important}.nav .nav-label{pointer-events:none!important}@media(max-width:700px){.nav{max-height:calc(100dvh - 165px)!important;padding-bottom:18px!important}}';document.head.appendChild(s)}
function boot(){addCss();ensureChurchLoader();ensureChurchFallback();bindNav();waitForSuite();const app=q('#app');if(app&&!app.dataset.vccfFinalObserved){app.dataset.vccfFinalObserved='1';new MutationObserver(()=>{if(app.classList.contains('active')){ensureChurchFallback();bindNav()}}).observe(app,{attributes:true,attributeFilter:['class'],childList:true,subtree:true})}setTimeout(()=>{ensureChurchFallback();bindNav()},500);setTimeout(()=>{ensureChurchFallback();bindNav()},1500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('vccf-authenticated',boot);window.addEventListener('vccf-app-ready',boot);
})();
