(()=>{
'use strict';
if(window.__VCCF_MODULE_HEALTH__)return;
window.__VCCF_MODULE_HEALTH__=true;

const CMS_ROUTES=new Set(['services','overview','areas','ministries','pastoral','reports','documents','access','events','leadership','prayer','announcements','audit']);
let patchedCms=null;
let syncedUser='';
let syncPromise=null;
const state=()=>window.VCCF?.getState?.()||{};
const userId=()=>state().session?.user?.id||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const delay=ms=>new Promise(r=>setTimeout(r,ms));

function cmsHost(){return document.getElementById('cmsContent')}
function cmsBusy(){return document.getElementById('cmsRefresh')?.disabled===true}
async function waitForCmsIdle(timeout=12000){
  const started=Date.now();
  while(cmsBusy()&&Date.now()-started<timeout)await delay(80);
  return !cmsBusy();
}
function cmsLoading(route){
  const host=cmsHost();
  if(!host)return;
  host.innerHTML='<section class="cms-panel card" style="padding:20px"><div class="cms-empty">Opening '+esc((route||'church module').replace(/_/g,' '))+'…</div></section>';
}
function cmsFailure(route,error,retry){
  const host=cmsHost();if(!host)return;
  host.innerHTML='<section class="cms-panel card" style="padding:20px"><h3 style="margin-top:0">Unable to open this module</h3><p class="cms-sub">The rest of VCCF Connect is still available. You can retry this module without reloading the whole app.</p><button id="vccfModuleRetry" class="btn secondary" type="button">Retry</button></section>';
  host.querySelector('#vccfModuleRetry')?.addEventListener('click',retry,{once:true});
  console.error('[VCCF module health]',route,error);
}

async function ensureCmsSynced(api,route){
  const uid=userId();
  if(!uid)return;
  if(syncedUser===uid)return;
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
    cmsLoading(route);
    const idle=await waitForCmsIdle();
    if(!idle)throw new Error('Church Management is still loading. Please retry this module.');
    await api.refresh?.();
    syncedUser=uid;
  })().finally(()=>{syncPromise=null});
  return syncPromise;
}

function patchChurchManagement(){
  const api=window.VCCFChurchManagement;
  if(!api||api===patchedCms||api.__moduleHealthPatched)return Boolean(api);
  const originalNavigate=typeof api.navigate==='function'?api.navigate.bind(api):null;
  if(!originalNavigate)return false;
  const originalRefresh=typeof api.refresh==='function'?api.refresh.bind(api):null;
  api.navigate=async route=>{
    const requested=route||'overview';
    try{
      if(CMS_ROUTES.has(requested))await ensureCmsSynced({refresh:originalRefresh},requested);
      originalNavigate(requested);
      requestAnimationFrame(()=>{
        const host=cmsHost();
        if(!host)return;
        if(!String(host.textContent||'').trim()&&CMS_ROUTES.has(requested))cmsFailure(requested,new Error('Module rendered no content.'),()=>api.navigate(requested));
      });
    }catch(error){cmsFailure(requested,error,()=>api.navigate(requested));}
  };
  api.refresh=async()=>{
    const idle=await waitForCmsIdle();
    if(!idle)throw new Error('Church Management is still loading.');
    try{await originalRefresh?.();syncedUser=userId();}
    catch(error){cmsFailure('refresh',error,()=>api.refresh());throw error;}
  };
  api.__moduleHealthPatched=true;
  patchedCms=api;
  return true;
}

function boot(){
  patchChurchManagement();
  if(!userId()){syncedUser='';syncPromise=null;}
}

document.addEventListener('click',e=>{
  const route=e.target.closest?.('[data-route]')?.dataset.route;
  if(route&&CMS_ROUTES.has(route))patchChurchManagement();
},true);
window.addEventListener('vccf-app-ready',()=>{syncedUser='';setTimeout(boot,40)});
window.addEventListener('vccf-signed-out',()=>{syncedUser='';syncPromise=null});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.VCCFModuleHealth={check:patchChurchManagement,patch:patchChurchManagement};
})();
