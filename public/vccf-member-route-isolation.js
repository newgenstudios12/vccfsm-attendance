(()=>{
'use strict';
if(window.__VCCF_MEMBER_ROUTE_ISOLATION_V2__)return;
window.__VCCF_MEMBER_ROUTE_ISOLATION_V2__=true;
function currentView(){const n=document.querySelector('.nav button.active[data-view]');if(n?.dataset.view)return n.dataset.view;const v=document.querySelector('.main .view.active');if(v){const id=String(v.id||'').replace(/^suite2-/,'');if(id)return id}const m=document.getElementById('members');if(m?.classList.contains('active'))return 'members';return 'dashboard'}
function sync(){const root=document.getElementById('members');if(!root)return;const show=currentView()==='members';const hidden=!show,aria=show?'false':'true',route=show?'visible':'hidden';if(root.classList.contains('hidden')!==hidden)root.classList.toggle('hidden',hidden);if(root.getAttribute('aria-hidden')!==aria)root.setAttribute('aria-hidden',aria);if(root.dataset.routeVisibility!==route)root.dataset.routeVisibility=route}
function init(){sync();document.addEventListener('click',e=>{if(e.target.closest?.('.nav button[data-view]'))setTimeout(sync,0)},true);window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);}
function start(){if(!document.getElementById('app')?.classList.contains('active'))return;if(window.__VCCF_MEMBER_ROUTE_STARTED__)return;window.__VCCF_MEMBER_ROUTE_STARTED__=true;init()}
window.addEventListener('vccf-authenticated',()=>setTimeout(start,0),{once:true});
if(document.getElementById('app')?.classList.contains('active'))start();
})();
