(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V12__)return;
window.__VCCF_DASHBOARD_LOADER_V12__=true;
function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=202608271330`;s.async=false;(document.head||document.documentElement).appendChild(s)}
function css(href){if(document.querySelector(`link[href^="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${href}?v=202608271330`;(document.head||document.documentElement).appendChild(l)}
function boot(){
  css('/vccf-device-responsive.css');
  load('/vccf-dashboard-features-v3.js');
  load('/vccf-members-clean-v1.js');
  load('/vccf-install-app.js');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
