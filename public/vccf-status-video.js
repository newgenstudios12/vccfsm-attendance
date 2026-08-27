(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V11__)return;
window.__VCCF_DASHBOARD_LOADER_V11__=true;
function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=202608271130`;s.async=false;(document.head||document.documentElement).appendChild(s)}
function boot(){
  load('/vccf-dashboard-features-v3.js');
  load('/vccf-members-clean-v1.js');
  load('/vccf-install-app.js');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
