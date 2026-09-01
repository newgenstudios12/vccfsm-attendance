(()=>{
'use strict';
if(window.__VCCF_NAV_FINAL_FIX_V5__)return;
window.__VCCF_NAV_FINAL_FIX_V5__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const labels={dashboard:'Dashboard',members:'Members',attendance:'Attendance',selfcheck:'Self Check-In',gallery:'Gallery',about:'About VCCF',settings:'Settings',analytics:'Analytics',events:'Events',notifications:'Notifications',profile:'My Profile',sermons:'Sermons','church-management':'Church Management'};
const ids={dashboard:'dashboard',members:'members',attendance:'attendance',selfcheck:'selfcheck',gallery:'gallery',about:'about',settings:'settings',analytics:'suite2-analytics',events:'suite2-events',notifications:'suite2-notifications',profile:'suite2-profile',sermons:'sermons'};
const textOf=(el)=>(String(el?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase());

function setTitle(v){const t=$('#pageTitle');if(t&&labels[v])t.textContent=labels[v]}
function markActive(btn){$$('.nav button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active')}
function closeDrawer(){$('body')?.classList.remove('vccf-mobile-drawer-open');$('.vccf-mobile-backdrop')?.classList.remove('open');$('.sidebar')?.classList.remove('vccf-drawer-open')}

function showView(view,button){
  if(view==='church-management')return showChurchManagement(button);
  const target=$(('#'+(ids[view]||view)));
  if(!target)return false;
  $$('.main .view').forEach(v=>v.classList.remove('active'));
  target.classList.add('active');
  markActive(button);
  setTitle(view);
  closeDrawer();
  try{
    if(view==='members'&&typeof window.renderMembers==='function')window.renderMembers();
    if(view==='sermons'&&window.VCCFSermons?.open)window.VCCFSermons.open();
    if(view==='analytics'&&typeof window.renderAnalytics==='function')window.renderAnalytics();
  }catch(e){console.warn('VCCF navigation render:',e)}
  return true;
}

function ensureChurchSuiteLoader(){
  if($('script[data-vccf-church-suite-loader="1"]'))return;
  const s=document.createElement('script');
  s.src='/vccf-church-management-suite.js?v=final6';
  s.async=false;
  s.dataset.vccfChurchSuiteLoader='1';
  document.head.appendChild(s);
}

function ensureChurchManagement(){
  const main=$('.main');
  if(!main)return null;
  let hub=$('#churchSuiteView');
  if(hub)return hub;
  hub=document.createElement('section');
  hub.id='churchSuiteView';
  hub.className='view';
  hub.innerHTML='<div id="vccfSuite"></div>';
  main.appendChild(hub);
  return hub;
}

function showChurchManagement(button){
  const hub=ensureChurchManagement();
  if(!hub){ensureChurchSuiteLoader();return false}
  $$('.main .view').forEach(v=>v.classList.remove('active'));
  hub.classList.add('active');
  markActive(button||$('.nav [data-vccf-church-nav="1"]')||$('.nav [data-suite-nav]'));
  setTitle('church-management');
  closeDrawer();
  ensureChurchSuiteLoader();
  return true;
}

function ensureChurchNav(){
  const nav=$('.nav');
  if(!nav)return;
  let b=nav.querySelector('[data-vccf-church-nav="1"]');
  if(b)return b;
  b=document.createElement('button');
  b.type='button';
  b.dataset.view='church-management';
  b.dataset.vccfChurchNav='1';
  b.title='Church Management';
  b.innerHTML='<span aria-hidden="true">⛪</span><span class="nav-label">Church Management</span>';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showChurchManagement(b)});
  nav.appendChild(b);
  return b;
}

function removeDuplicateChurchAttendance(){
  const nav=$('.nav');
  if(!nav)return;
  const items=$$('button,a',nav);
  const churchAttendance=items.filter(el=>{
    const text=textOf(el);
    const view=String(el.dataset?.view||'').toLowerCase();
    return text==='church attendance' || view==='church-attendance' || view==='churchattendance';
  });
  if(churchAttendance.length>1)churchAttendance.slice(1).forEach(el=>el.remove());
  const attendance=Array.from(nav.querySelectorAll('button[data-view="attendance"],a[data-view="attendance"]'));
  if(attendance.length>1)attendance.slice(1).forEach(el=>el.remove());
}

function removeDuplicateProfileButtons(){
  const nav=$('.nav');
  if(!nav)return;
  const items=$$('button,a',nav).filter(el=>{
    const text=textOf(el);
    const view=String(el.dataset?.view||'').toLowerCase();
    return text==='my profile'||view==='myprofile'||view==='my-profile'||view==='profile';
  });
  if(items.length>1)items.slice(1).forEach(x=>x.remove());
}

function dedupeNavigation(){removeDuplicateChurchAttendance();removeDuplicateProfileButtons();}

function repairShellVisibility(){
  const login=$('#login'),app=$('#app');
  if(!login||!app)return;
  const appActive=app.classList.contains('active');
  if(appActive){
    login.style.setProperty('display','none','important');
    app.style.setProperty('display','flex','important');
    if(!$('.main .view.active')){
      const dash=$('#dashboard');
      if(dash)dash.classList.add('active');
    }
  }else{
    app.style.setProperty('display','none','important');
    login.style.setProperty('display','grid','important');
  }
}

function installResponsiveSafetyStyle(){
  if($('#vccf-nav-final-v5-style'))return;
  const s=document.createElement('style');
  s.id='vccf-nav-final-v5-style';
  s.textContent='.nav{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important}.nav button{pointer-events:auto!important;touch-action:manipulation!important;flex:0 0 auto!important}.nav-label{pointer-events:none}@media(max-width:700px){html,body{max-width:100%;overflow-x:hidden}.main{width:100%!important;margin-left:0!important;padding-bottom:96px!important}.sidebar{max-width:100vw}.nav{max-width:100%;min-width:0}}';
  document.head.appendChild(s);
}

function bindNav(){
  const nav=$('.nav');
  if(!nav||nav.dataset.vccfNavV5Bound==='1')return;
  nav.dataset.vccfNavV5Bound='1';
  nav.addEventListener('click',e=>{
    const b=e.target.closest?.('button');
    if(!b||!nav.contains(b))return;
    const view=b.dataset.view||b.dataset.suiteV2||b.dataset.vccfCoreNav;
    if(!view)return;
    if(view==='church-management'){e.preventDefault();e.stopPropagation();showChurchManagement(b);return}
    if(ids[view]||$('#'+view)||$('#suite2-'+view)){e.preventDefault();e.stopPropagation();showView(view,b)}
  },true);
}

function boot(){
  installResponsiveSafetyStyle();
  repairShellVisibility();
  ensureChurchNav();
  dedupeNavigation();
  bindNav();
  const app=$('#app');
  if(app&&!app.dataset.vccfNavVisibilityObserved){
    app.dataset.vccfNavVisibilityObserved='1';
    new MutationObserver(()=>repairShellVisibility()).observe(app,{attributes:true,attributeFilter:['class']});
  }
  const nav=$('.nav');
  if(nav&&!nav.dataset.vccfNavDedupeObserved){
    nav.dataset.vccfNavDedupeObserved='1';
    new MutationObserver(()=>{ensureChurchNav();dedupeNavigation();bindNav();}).observe(nav,{childList:true});
  }
}

window.addEventListener('error',()=>setTimeout(repairShellVisibility,0));
window.addEventListener('unhandledrejection',()=>setTimeout(repairShellVisibility,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('load',boot);
window.addEventListener('vccf-authenticated',()=>setTimeout(boot,80));
window.addEventListener('vccf-app-ready',()=>setTimeout(boot,80));
window.__VCCF_NAV_REPAIR__=boot;
})();