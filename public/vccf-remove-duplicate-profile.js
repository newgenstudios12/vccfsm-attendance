(()=>{
'use strict';
if(window.__VCCF_REMOVE_DUPLICATE_PROFILE_V1__)return;
window.__VCCF_REMOVE_DUPLICATE_PROFILE_V1__=true;
const normalize=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
function removeDuplicateProfiles(root=document){
  const navs=[...root.querySelectorAll('.sidebar .nav')];
  for(const nav of navs){
    const items=[...nav.querySelectorAll('button,a')].filter(el=>normalize(el.textContent)==='my profile');
    if(items.length>1)items.slice(1).forEach(el=>el.remove());
  }
}
removeDuplicateProfiles();
const observer=new MutationObserver(()=>removeDuplicateProfiles());
observer.observe(document.body,{childList:true,subtree:true});
})();
