(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V16__)return;
window.__VCCF_DASHBOARD_LOADER_V16__=true;
function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=202608270700`;s.async=false;(document.head||document.documentElement).appendChild(s)}
function css(href){if(document.querySelector(`link[href^="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${href}?v=202608270700`;(document.head||document.head||document.documentElement).appendChild(l)}
function boot(){
  css('/vccf-device-responsive.css');
  load('/vccf-dashboard-features-v3.js');
  load('/vccf-members-clean-v1.js');
  load('/vccf-install-app.js');
  load('/vccf-dark-mode-fix.js');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
