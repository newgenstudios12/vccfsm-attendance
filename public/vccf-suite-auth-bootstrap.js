(()=>{
  'use strict';
  if (window.__VCCF_SUITE_AUTH_BOOTSTRAP__) return;
  window.__VCCF_SUITE_AUTH_BOOTSTRAP__ = true;

  function bootSuite(){
    try{
      if (!document.getElementById('app')?.classList.contains('active')) return;
      const existing=document.getElementById('churchSuiteView');
      const suiteRoot=document.getElementById('vccfSuite');
      if(existing && suiteRoot) return;

      // The suite script can be loaded before authentication and sets its global
      // guard even when no user exists. Clear that guard and load it once again
      // after authentication so the suite gets a valid Supabase user context.
      if(window.__VCCF_CHURCH_SUITE__) delete window.__VCCF_CHURCH_SUITE__;

      const current=document.querySelector('script[data-vccf-suite-auth-reload="1"]');
      if(current) return;
      const s=document.createElement('script');
      s.src='/vccf-church-management-suite.js?authboot='+Date.now();
      s.async=false;
      s.dataset.vccfSuiteAuthReload='1';
      s.onload=()=>setTimeout(()=>{
        try{
          if(typeof window.__VCCF_NAV_REPAIR__==='function') window.__VCCF_NAV_REPAIR__();
        }catch{}
      },50);
      document.head.appendChild(s);
    }catch(e){console.warn('VCCF suite auth bootstrap:',e)}
  }

  window.addEventListener('vccf-authenticated',()=>setTimeout(bootSuite,80));
  window.addEventListener('vccf-app-ready',()=>setTimeout(bootSuite,80));
  window.addEventListener('load',()=>setTimeout(bootSuite,250));
  if(document.readyState!=='loading') setTimeout(bootSuite,250);
  else document.addEventListener('DOMContentLoaded',()=>setTimeout(bootSuite,250),{once:true});
})();
