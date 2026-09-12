(()=>{
'use strict';
if(window.__VCCF_MEMBER_IMPORT_TOOLBAR_FIX__)return;
window.__VCCF_MEMBER_IMPORT_TOOLBAR_FIX__=true;
let timer=0;
function mountBridge(){
  const root=document.getElementById('members');
  if(!root)return;
  const actions=root.querySelector('.vccf-clean-actions');
  if(!actions)return;
  let bridge=actions.querySelector('.toolbar[data-vccf-import-toolbar]');
  if(!bridge){
    bridge=document.createElement('span');
    bridge.className='toolbar';
    bridge.dataset.vccfImportToolbar='1';
    bridge.style.display='contents';
    actions.appendChild(bridge);
  }
}
function queue(){clearTimeout(timer);timer=setTimeout(mountBridge,60)}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-route="members"],[data-view="members"]'))queue()},true);
window.addEventListener('vccf-app-ready',()=>setTimeout(mountBridge,400));
new MutationObserver(rs=>{if(rs.some(r=>r.addedNodes?.length))queue()}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(mountBridge,1000);
})();