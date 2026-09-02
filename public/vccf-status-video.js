(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V24__)return;
window.__VCCF_DASHBOARD_LOADER_V24__=true;
const stamp='202609020300';

// Authentication is owned exclusively by vccf-login-guard.js.
// This module must never register, replace, or capture the login form.
function load(src){
  if(document.querySelector(`script[src^="${src}"]`))return;
  const s=document.createElement('script');
  s.src=`${src}?v=${stamp}`;
  s.async=true;
  (document.head||document.documentElement).appendChild(s);
}
function css(href){
  if(document.querySelector(`link[href^="${href}"]`))return;
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href=`${href}?v=${stamp}`;
  document.head.appendChild(l);
}
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
window.addEventListener('vccf-authenticated',()=>setTimeout(loadPostAuthModules,0),{once:true});
})();
