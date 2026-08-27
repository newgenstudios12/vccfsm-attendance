(()=>{
'use strict';
/* Legacy Members UI disabled. The Members tab is now owned exclusively by vccf-members-clean-v1.js. */
window.__VCCF_MEMBER_UI_LEGACY_DISABLED__=true;

/* Keep the standalone Members controller isolated to the Members tab. */
if(window.__VCCF_MEMBER_ROUTE_ISOLATION__)return;
window.__VCCF_MEMBER_ROUTE_ISOLATION__=true;

function currentView(){
  const activeNav=document.querySelector('.nav button.active[data-view]');
  if(activeNav?.dataset.view)return activeNav.dataset.view;

  const activeView=document.querySelector('.main .view.active');
  if(activeView){
    const id=String(activeView.id||'').replace(/^suite2-/,'');
    if(id)return id;
  }

  const memberRoot=document.getElementById('members');
  if(memberRoot?.classList.contains('active'))return 'members';
  return 'dashboard';
}

function syncMemberVisibility(){
  const root=document.getElementById('members');
  if(!root)return;
  const visible=currentView()==='members';
  root.classList.toggle('hidden',!visible);
  root.setAttribute('aria-hidden',visible?'false':'true');
  root.dataset.routeVisibility=visible?'visible':'hidden';
}

function scheduleMemberVisibility(){
  syncMemberVisibility();
  requestAnimationFrame(syncMemberVisibility);
  setTimeout(syncMemberVisibility,0);
}

function initMemberRouteIsolation(){
  scheduleMemberVisibility();

  document.addEventListener('click',event=>{
    if(event.target.closest?.('.nav button[data-view]'))scheduleMemberVisibility();
  },true);

  const observer=new MutationObserver(()=>scheduleMemberVisibility());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-view']});

  window.addEventListener('hashchange',scheduleMemberVisibility);
  window.addEventListener('popstate',scheduleMemberVisibility);
  setInterval(syncMemberVisibility,1500);
}

function loadSpecialEvents(){
  if(document.querySelector('script[data-vccf-special-events]'))return;
  const s=document.createElement('script');
  s.src='/vccf-special-events.js?v=1';
  s.dataset.vccfSpecialEvents='1';
  s.async=true;
  document.head.appendChild(s);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{initMemberRouteIsolation();loadSpecialEvents()},{once:true});
else {initMemberRouteIsolation();loadSpecialEvents();}
})();
