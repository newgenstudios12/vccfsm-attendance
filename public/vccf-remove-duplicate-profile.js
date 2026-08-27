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

// Special Event frontend access for non-admin users.
// This file is loaded by index.html on every authenticated app session.
function loadSpecialEventAccess(){
  if(document.getElementById('vccfSpecialEventAccessScript'))return;
  const s=document.createElement('script');
  s.id='vccfSpecialEventAccessScript';
  s.src='/vccf-special-event-access.js';
  s.async=true;
  document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadSpecialEventAccess,{once:true});else loadSpecialEventAccess();
})();
