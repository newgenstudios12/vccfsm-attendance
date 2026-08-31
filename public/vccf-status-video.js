(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V20__)return;
window.__VCCF_DASHBOARD_LOADER_V20__=true;
const stamp='202609011700';
function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=${stamp}`;s.async=true;(document.head||document.documentElement).appendChild(s)}
function css(href){if(document.querySelector(`link[href^="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${href}?v=${stamp}`;document.head.appendChild(l)}
function loadPostAuthModules(){
  if(window.__VCCF_POST_AUTH_MODULES_LOADED__)return;
  window.__VCCF_POST_AUTH_MODULES_LOADED__=true;
  css('/vccf-device-responsive.css');
  css('/vccf-mobile-hardening.css');
  load('/vccf-dashboard-features-v3.js');
  load('/vccf-members-clean-v1.js');
  load('/vccf-member-category-v1.js');
  load('/vccf-install-app.js');
  load('/vccf-dark-mode-fix.js');
  load('/vccf-special-events.js');
  load('/vccf-special-event-checkin.js');
}
// Keep authentication responsive: only the lightweight login handler runs before sign-in.
load('/vccf-login-early-fix.js');
window.addEventListener('vccf-authenticated',()=>setTimeout(loadPostAuthModules,0),{once:true});
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    css('/vccf-device-responsive.css');
    css('/vccf-mobile-hardening.css');
    if(window.session||window.profile||document.getElementById('app')?.classList.contains('active'))loadPostAuthModules();
  },{once:true});
}else{
  css('/vccf-device-responsive.css');
  css('/vccf-mobile-hardening.css');
  if(window.session||window.profile||document.getElementById('app')?.classList.contains('active'))loadPostAuthModules();
}
})();
