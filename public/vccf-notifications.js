(()=>{
'use strict';
if(window.__VCCF_NOTIFICATIONS_BRIDGE__)return;window.__VCCF_NOTIFICATIONS_BRIDGE__=true;
const load=src=>new Promise(resolve=>{const s=document.createElement('script');s.src=src;s.defer=true;s.onload=resolve;s.onerror=resolve;document.head.appendChild(s)});
load('https://vccfsm-attendance-d4rd75vao-newgenstudios12s-projects.vercel.app/vccf-notifications.js?v=20260904-1')
  .then(()=>load('/vccf-notifications-v2.js?v=20260904-2'));
})();
