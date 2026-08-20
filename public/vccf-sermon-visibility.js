(()=>{
'use strict';
if(window.__VCCF_SERMON_VISIBILITY__)return;
window.__VCCF_SERMON_VISIBILITY__=true;

function setVisible(el,visible){
  if(!el)return;
  el.hidden=!visible;
  el.style.display=visible?'':'none';
  el.setAttribute('aria-hidden',visible?'false':'true');
}

function sync(){
  const sermonView=document.getElementById('vccf-sermons-view');
  const main=document.querySelector('.main');
  const active=document.querySelector('.view.active');
  const isSermons=!!(active&&active.id==='vccf-sermons-view');

  // Sermons must behave like Gallery: a normal full-width view inside .main,
  // never as a sibling of .main inside the flex .app shell.
  if(sermonView&&main&&sermonView.parentElement!==main)main.appendChild(sermonView);
  if(sermonView){
    sermonView.style.position='static';
    sermonView.style.width='100%';
    sermonView.style.maxWidth='none';
    sermonView.style.margin='0';
    sermonView.style.float='none';
    sermonView.style.inset='auto';
    sermonView.style.zIndex='auto';
  }

  setVisible(sermonView,isSermons);

  document.querySelectorAll('.sermons-shell,.sermon-admin,.sermon-list').forEach(el=>{
    if(el===sermonView)return;
    const inside=!!el.closest('#vccf-sermons-view');
    if(!inside)setVisible(el,false);
  });
}

function onNavigationClick(e){
  const btn=e.target.closest?.('.nav [data-view]');
  if(btn)setTimeout(sync,0);
}

document.addEventListener('click',onNavigationClick,true);
window.addEventListener('hashchange',sync);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
window.VCCFSermonVisibility={sync};
})();
