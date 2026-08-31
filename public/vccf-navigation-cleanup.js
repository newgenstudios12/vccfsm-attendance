(()=>{
  'use strict';
  if(window.__VCCF_NAV_CLEANUP_V2__)return;
  window.__VCCF_NAV_CLEANUP_V2__=true;

  function loadResponsive(){
    if(document.getElementById('vccf-responsive-hardening'))return;
    const l=document.createElement('link');l.id='vccf-responsive-hardening';l.rel='stylesheet';l.href='/vccf-responsive-hardening.css';document.head.appendChild(l);
  }
  function loadSermonVisibility(){
    if(document.getElementById('vccf-sermon-visibility-loader'))return;
    const s=document.createElement('script');s.id='vccf-sermon-visibility-loader';s.src='/vccf-sermon-visibility.js';s.defer=true;document.head.appendChild(s);
  }
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  function clean(){
    loadResponsive();
    loadSermonVisibility();
    const nav=document.querySelector('.nav');
    if(!nav)return;

    // One authoritative Church Management hub. The legacy suite injector adds
    // Analytics / Events / Notifications / Profile nav items that duplicate
    // functionality already inside the hub.
    nav.querySelectorAll('[data-suite-v2]').forEach(el=>el.remove());

    // Keep exactly one dedicated My Profile entry.
    const profiles=[...nav.querySelectorAll('button,a')].filter(el=>norm(el.textContent)==='my profile');
    const canonical=profiles.find(el=>el.dataset?.view==='myprofile')||profiles[0];
    profiles.forEach(el=>{if(el!==canonical)el.remove()});
    if(canonical){
      canonical.dataset.view='myprofile';
      canonical.textContent='My Profile';
    }

    // Keep exactly one Church Management entry.
    const cms=[...nav.querySelectorAll('button,a')].filter(el=>norm(el.textContent)==='church management');
    cms.slice(1).forEach(el=>el.remove());

    // Sermons remains a single dedicated navigation item.
    const sermons=[...nav.querySelectorAll('button,a')].filter(el=>norm(el.textContent).replace(/^📖\s*/,'')==='sermons');
    const sermon=sermons[0];
    sermons.slice(1).forEach(el=>el.remove());
    if(sermon){sermon.dataset.view='sermons';sermon.textContent='📖 Sermons';}
  }

  function boot(){
    clean();
    setTimeout(clean,500);
    setTimeout(clean,1500);
    const obs=new MutationObserver(()=>clean());
    obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
