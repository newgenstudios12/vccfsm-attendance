(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V6__)return;
window.__VCCF_DASHBOARD_LOADER_V6__=true;
function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=202608262140`;s.async=false;(document.head||document.documentElement).appendChild(s)}
function boot(){
  load('/vccf-dashboard-features-v3.js');
  load('/vccf-add-member-v4.js');
  load('/vccf-member-save-isolation.js');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();