(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_NAV_RECONCILE__)return;
window.__VCCF_ATTENDANCE_NAV_RECONCILE__=true;

const state=()=>window.VCCF?.getState?.()||{};
const role=()=>String(state().profile?.role||'').toLowerCase();
const shouldHaveAttendance=()=>Boolean(role())&&!['member','treasurer'].includes(role());
let replayed=false;

function attendanceButton(){return document.querySelector('.nav [data-route="attendance"]')}
function shellReady(){return Boolean(window.__VCCF_APP_SHELL_V2__&&document.querySelector('.sidebar .nav'))}
function reconcile(){
  if(!shellReady()||!state().profile)return false;
  const should=shouldHaveAttendance(),has=Boolean(attendanceButton());
  if(should&&!has&&!replayed){
    replayed=true;
    window.dispatchEvent(new CustomEvent('vccf-app-ready',{detail:{reason:'attendance-nav-reconcile'}}));
    setTimeout(()=>{replayed=false;if(shouldHaveAttendance()&&!attendanceButton())window.dispatchEvent(new CustomEvent('vccf-app-ready',{detail:{reason:'attendance-nav-retry'}}))},180);
    return true;
  }
  if(!should&&has&&!replayed){
    replayed=true;
    window.dispatchEvent(new CustomEvent('vccf-app-ready',{detail:{reason:'attendance-nav-role-sync'}}));
    setTimeout(()=>{replayed=false},180);
    return true;
  }
  return false;
}

function schedule(){[80,300,800,1600,3000].forEach(ms=>setTimeout(reconcile,ms))}
window.addEventListener('vccf-app-ready',()=>setTimeout(reconcile,120));
window.addEventListener('vccf-authenticated',schedule);
window.addEventListener('focus',()=>setTimeout(reconcile,100));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
