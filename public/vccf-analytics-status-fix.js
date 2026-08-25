(()=>{
'use strict';
window.__VCCF_SUITE_V1__=true;
function loadOnce(kind,src){if(document.querySelector(`script[src="${src}"]`)||document.querySelector(`link[href="${src}"]`))return;const el=document.createElement(kind==='css'?'link':'script');if(kind==='css'){el.rel='stylesheet';el.href=src}else{el.src=src;el.defer=true}document.head.appendChild(el)}
function boot(){loadOnce('css','/vccf-suite-v2.css');loadOnce('js','/vccf-suite-v2.js')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();