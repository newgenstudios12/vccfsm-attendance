(()=>{
'use strict';
if(window.__VCCF_MEMBER_SAVE_ISOLATION_V1__)return;
window.__VCCF_MEMBER_SAVE_ISOLATION_V1__=true;
let suppress=false;
const originalRefresh=window.refresh;
const originalLoadDb=window.loadDb;
window.refresh=function(...args){if(suppress){suppress=false;return Promise.resolve();}return typeof originalRefresh==='function'?originalRefresh.apply(this,args):Promise.resolve()};
window.loadDb=async function(...args){if(suppress)return;return typeof originalLoadDb==='function'?originalLoadDb.apply(this,args):undefined};
window.addEventListener('vccf-members-changed',()=>{suppress=true;setTimeout(()=>{suppress=false},1500)},{passive:true});
})();