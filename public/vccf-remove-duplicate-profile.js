(()=>{
'use strict';
if(window.__VCCF_REMOVE_DUPLICATE_PROFILE_V7__)return;
window.__VCCF_REMOVE_DUPLICATE_PROFILE_V7__=true;
function start(){
  function removeDuplicates(root=document){
    root.querySelectorAll('.sidebar .nav').forEach(nav=>{
      const groups=new Map();
      [...nav.querySelectorAll('button,a')].forEach(el=>{
        const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        const view=String(el.dataset?.view||'').toLowerCase();
        let key=view||text;
        if(text==='church attendance'||view==='church-attendance'||view==='churchattendance')key='church-attendance';
        if(view==='attendance')key='attendance';
        if(text==='my profile'||['myprofile','my-profile','profile'].includes(view))key='profile';
        if(text==='church management'||view==='church-management')key='church-management';
        if(!key)return;
        const arr=groups.get(key)||[];arr.push(el);groups.set(key,arr);
      });
      groups.forEach((items,key)=>{
        if(['church-attendance','attendance','profile','church-management'].includes(key)&&items.length>1)items.slice(1).forEach(el=>el.remove());
      });
    });
  }
  function cleanupStraySourceText(root=document){try{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const bad=/m\(['\"]attendance['\"]\)\.insert|function\s+renderGallery\s*\(|document\.querySelectorAll\(['\"]\.nav button['\"]\)|supabaseClient\.auth\.signInWithPassword/;const nodes=[];let n;while((n=walker.nextNode())){const p=n.parentElement;if(!p||p.tagName==='SCRIPT'||p.tagName==='STYLE'||p.tagName==='TEXTAREA'||p.tagName==='NOSCRIPT')continue;const t=String(n.nodeValue||'');if(t.length>500&&bad.test(t))nodes.push(n)}nodes.forEach(n=>n.remove())}catch{}}
  function loadScript(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=true;document.head.appendChild(s)}
  function run(){
    if(!document.getElementById('app')?.classList.contains('active'))return;
    removeDuplicates();cleanupStraySourceText();
    loadScript('vccfAuthoritativeShellScript','/vccf-authoritative-shell.js');
    loadScript('vccfSpecialEventAccessScript','/vccf-special-event-access.js');
    if(document.getElementById('settings')?.classList.contains('active'))loadScript('vccfAdminAccountManagerScript','/vccf-admin-account-manager.js');
    loadScript('vccfNavigationCleanupScript','/vccf-navigation-cleanup.js');
  }
  if(document.getElementById('app')?.classList.contains('active'))run();else window.addEventListener('vccf-authenticated',run,{once:true});
  new MutationObserver(()=>{if(document.getElementById('app')?.classList.contains('active')){removeDuplicates();run()}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();