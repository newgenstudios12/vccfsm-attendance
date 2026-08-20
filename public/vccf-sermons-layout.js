(()=>{
'use strict';
if(window.__VCCF_SERMONS_LAYOUT_FIX__)return;
window.__VCCF_SERMONS_LAYOUT_FIX__=true;
function fix(){
  const view=document.getElementById('vccf-sermons-view');
  const main=document.querySelector('.main');
  if(!view||!main)return;
  if(view.parentElement!==main)main.appendChild(view);
  view.style.position='static';
  view.style.width='100%';
  view.style.maxWidth='none';
  view.style.margin='0';
  view.style.float='none';
  view.style.inset='auto';
  view.style.zIndex='auto';
  view.classList.toggle('active',document.querySelector('.nav button[data-view="sermons"]')?.classList.contains('active')===true);
}
function boot(){
  fix();
  setTimeout(fix,200);
  setTimeout(fix,800);
  setTimeout(fix,1800);
  new MutationObserver(fix).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
