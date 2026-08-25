(()=>{
'use strict';
if(window.__VCCF_REMOVE_DUPLICATE_PROFILE_V2__)return;
window.__VCCF_REMOVE_DUPLICATE_PROFILE_V2__=true;
function removeDuplicateProfiles(root=document){
  root.querySelectorAll('.sidebar .nav').forEach(nav=>{
    const items=[...nav.querySelectorAll('button,a')].filter(el=>{
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      const view=String(el.dataset?.view||'').toLowerCase();
      return text==='my profile'||view==='myprofile'||view==='my-profile'||view==='profile';
    });
    if(items.length>1){
      // Keep the first canonical My Profile entry and remove every duplicate.
      items.slice(1).forEach(el=>el.remove());
    }
  });
}
function run(){removeDuplicateProfiles();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
const observer=new MutationObserver(()=>removeDuplicateProfiles());
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
