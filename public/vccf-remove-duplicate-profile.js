(()=>{
'use strict';
if(window.__VCCF_REMOVE_DUPLICATE_PROFILE_V5__)return;
window.__VCCF_REMOVE_DUPLICATE_PROFILE_V5__=true;
function removeDuplicateProfiles(root=document){
  root.querySelectorAll('.sidebar .nav').forEach(nav=>{
    const items=[...nav.querySelectorAll('button,a')].filter(el=>{
      const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      const view=String(el.dataset?.view||'').toLowerCase();
      return text==='my profile'||view==='myprofile'||view==='my-profile'||view==='profile';
    });
    if(items.length>1)items.slice(1).forEach(el=>el.remove());
  });
}
function cleanupStraySourceText(root=document){
  try{
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const bad=/m\(['\"]attendance['\"]\)\.insert|function\s+renderGallery\s*\(|document\.querySelectorAll\(['\"]\.nav button['\"]\)|supabaseClient\.auth\.signInWithPassword/;
    const nodes=[];
    let n;
    while((n=walker.nextNode())){
      const p=n.parentElement;
      if(!p||p.tagName==='SCRIPT'||p.tagName==='STYLE'||p.tagName==='TEXTAREA'||p.tagName==='NOSCRIPT')continue;
      const text=String(n.nodeValue||'');
      if(text.length>500&&bad.test(text))nodes.push(n);
    }
    nodes.forEach(n=>n.remove());
  }catch{}
}
function loadScript(id,src){
  if(document.getElementById(id))return;
  const s=document.createElement('script');s.id=id;s.src=src;s.async=true;document.head.appendChild(s);
}
function loadSpecialEventAccess(){loadScript('vccfSpecialEventAccessScript','/vccf-special-event-access.js')}
function maybeLoadAdminAccountManager(){
  const settings=document.getElementById('settings');
  if(settings?.classList.contains('active'))loadScript('vccfAdminAccountManagerScript','/vccf-admin-account-manager.js');
}
function run(){removeDuplicateProfiles();cleanupStraySourceText();loadSpecialEventAccess();maybeLoadAdminAccountManager()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
document.addEventListener('click',e=>{
  if(e.target.closest?.('.nav button[data-view="settings"]')){
    cleanupStraySourceText();
    setTimeout(maybeLoadAdminAccountManager,80);
  }
});
const observer=new MutationObserver(()=>{removeDuplicateProfiles();cleanupStraySourceText();maybeLoadAdminAccountManager()});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
