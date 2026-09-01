(()=>{
'use strict';
if(window.__VCCF_REMOVE_DUPLICATE_PROFILE_V8__)return;
window.__VCCF_REMOVE_DUPLICATE_PROFILE_V8__=true;
function start(){
  function removeDuplicates(root=document){
    root.querySelectorAll('.sidebar .nav').forEach(nav=>{
      const groups=new Map();
      [...nav.querySelectorAll('button,a')].forEach(el=>{
        const text=String(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        const view=String(el.dataset?.view||'').toLowerCase();
        const key=(text.includes('church attendance')||['attendance','church-attendance','churchattendance'].includes(view))?'attendance':(text==='my profile'||['myprofile','my-profile','profile'].includes(view))?'profile':(text==='church management'||view==='church-management')?'church-management':(view||text);
        if(!key)return;const arr=groups.get(key)||[];arr.push(el);groups.set(key,arr);
      });
      groups.forEach((items,key)=>{if(['attendance','profile','church-management'].includes(key)&&items.length>1)items.slice(1).forEach(el=>el.remove());});
      const att=nav.querySelector('button[data-view="attendance"],a[data-view="attendance"]');if(att){att.innerHTML='<span aria-hidden="true">✓</span><span class="nav-label">Church Attendance</span>';att.title='Church Attendance';}
    });
  }
  function cleanupStraySourceText(root=document){try{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const bad=/m\(['\"]attendance['\"]\)\.insert|function\s+renderGallery\s*\(|document\.querySelectorAll\(['\"]\.nav button['\"]\)|supabaseClient\.auth\.signInWithPassword/;const nodes=[];let n;while((n=walker.nextNode())){const p=n.parentElement;if(!p||p.tagName==='SCRIPT'||p.tagName==='STYLE'||p.tagName==='TEXTAREA'||p.tagName==='NOSCRIPT')continue;const t=String(n.nodeValue||'');if(t.length>500&&bad.test(t))nodes.push(n)}nodes.forEach(n=>n.remove())}catch{}}
  function loadScript(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.async=true;document.head.appendChild(s)}
  function run(){
    if(!document.getElementById('app')?.classList.contains('active'))return;
    removeDuplicates();cleanupStraySourceText();
    loadScript('vccfAuthoritativeShellScript','/vccf-authoritative-shell.js');
    loadScript('vccfMemberGivingScript','/vccf-member-giving.js?authoritative=1');
    loadScript('vccfSpecialEventAccessScript','/vccf-special-event-access.js');
    if(document.getElementById('settings')?.classList.contains('active'))loadScript('vccfAdminAccountManagerScript','/vccf-admin-account-manager.js');
    loadScript('vccfNavigationCleanupScript','/vccf-navigation-cleanup.js');
  }
  if(document.getElementById('app')?.classList.contains('active'))run();else window.addEventListener('vccf-authenticated',run,{once:true});
  new MutationObserver(()=>{if(document.getElementById('app')?.classList.contains('active')){removeDuplicates();run()}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();