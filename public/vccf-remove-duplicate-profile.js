(()=>{
'use strict';
if(window.__VCCF_REMOVE_DUPLICATE_PROFILE_V3__)return;
window.__VCCF_REMOVE_DUPLICATE_PROFILE_V3__=true;
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
function loadSpecialEventAccess(){
  if(document.getElementById('vccfSpecialEventAccessScript'))return;
  const s=document.createElement('script');s.id='vccfSpecialEventAccessScript';s.src='/vccf-special-event-access.js';s.async=true;document.head.appendChild(s);
}
function loadAdminAccountManager(){
  if(document.getElementById('vccfAdminAccountManagerScript'))return;
  const s=document.createElement('script');s.id='vccfAdminAccountManagerScript';s.src='/vccf-admin-account-manager.js';s.async=true;document.head.appendChild(s);
}
function run(){removeDuplicateProfiles();loadSpecialEventAccess();loadAdminAccountManager();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
const observer=new MutationObserver(()=>removeDuplicateProfiles());
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
