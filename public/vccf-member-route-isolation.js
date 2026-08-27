(()=>{
'use strict';
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

function sync(){
  const root=document.getElementById('members');
  if(!root)return;

  const view=currentView();
  const show=view==='members';
  root.classList.toggle('hidden',!show);
  root.setAttribute('aria-hidden',show?'false':'true');
  root.dataset.routeVisibility=show?'visible':'hidden';
}

function schedule(){
  sync();
  requestAnimationFrame(sync);
  setTimeout(sync,0);
}

function init(){
  schedule();

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.nav button[data-view]');
    if(button) schedule();
  },true);

  const observer=new MutationObserver(()=>schedule());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-view']});

  window.addEventListener('hashchange',schedule);
  window.addEventListener('popstate',schedule);

  setInterval(sync,1500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
