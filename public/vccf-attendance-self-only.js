(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_SELF_ONLY__)return;
window.__VCCF_ATTENDANCE_SELF_ONLY__=true;

const state=()=>window.VCCF?.getState?.()||{};
const role=()=>String(state().profile?.role||'member').toLowerCase();
const selfOnly=()=>['member','treasurer','guest'].includes(role());
let applyTimer=0;

function setAttendanceHeading(){
  const title=document.getElementById('title');
  const hint=document.querySelector('.top .hint');
  if(title&&title.textContent!=='Attendance')title.textContent='Attendance';
  const wanted='Check in the member profile linked to your account.';
  if(hint&&hint.textContent!==wanted)hint.textContent=wanted;
}

function activateAttendanceButton(button){
  document.querySelectorAll('.sidebar [data-route].active').forEach(node=>{if(node!==button)node.classList.remove('active')});
  if(button&&!button.classList.contains('active'))button.classList.add('active');
}

function apply(){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar||!selfOnly())return;

  const buttons=[...sidebar.querySelectorAll('[data-route]')];
  const selfButton=buttons.find(button=>button.dataset.vccfSelfAttendance==='1')||buttons.find(button=>button.dataset.route==='selfcheck');
  const fullAttendance=buttons.find(button=>button.dataset.route==='attendance'&&button!==selfButton);

  if(fullAttendance)fullAttendance.remove();
  if(!selfButton)return;

  if(selfButton.dataset.route!=='attendance')selfButton.dataset.route='attendance';
  if(selfButton.dataset.vccfSelfAttendance!=='1')selfButton.dataset.vccfSelfAttendance='1';
  const label=selfButton.querySelector('.nav-label');
  if(label&&label.textContent!=='Attendance')label.textContent='Attendance';
  if(selfButton.getAttribute('aria-label')!=='Attendance')selfButton.setAttribute('aria-label','Attendance');

  if(selfButton.dataset.vccfAttendanceBound!=='1'){
    selfButton.dataset.vccfAttendanceBound='1';
    selfButton.addEventListener('click',()=>{
      selfButton.dataset.route='selfcheck';
      queueMicrotask(()=>{selfButton.dataset.route='attendance'});
      setTimeout(()=>{
        selfButton.dataset.route='attendance';
        setAttendanceHeading();
        activateAttendanceButton(selfButton);
      },40);
    },true);
  }

  if(document.getElementById('selfcheck')?.classList.contains('active')){
    setAttendanceHeading();
    activateAttendanceButton(selfButton);
  }
}

function queueApply(delay=40){
  clearTimeout(applyTimer);
  applyTimer=setTimeout(apply,delay);
}

const observer=new MutationObserver(records=>{
  if(!selfOnly())return;
  const meaningful=records.some(record=>{
    const target=record.target;
    return !target?.closest?.('[data-vccf-self-attendance="1"]');
  });
  if(meaningful)queueApply();
});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',()=>queueApply(120));
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-route="attendance"],[data-route="selfcheck"]'))queueApply(80);
});
queueApply(900);
})();

(()=>{
'use strict';
if(window.__VCCF_AREA_LEADER_GIVING_LOADER__)return;
window.__VCCF_AREA_LEADER_GIVING_LOADER__=true;
const state=()=>window.VCCF?.getState?.()||{};
function load(){
  if(String(state().profile?.role||'').toLowerCase()!=='area_leader')return;
  if(document.querySelector('script[data-vccf-area-leader-giving]'))return;
  const s=document.createElement('script');
  s.src='/vccf-area-leader-giving.js?v=20260912-1';
  s.defer=true;
  s.dataset.vccfAreaLeaderGiving='1';
  document.head.appendChild(s);
}
window.addEventListener('vccf-app-ready',()=>setTimeout(load,120));
window.addEventListener('vccf-profile-updated',()=>setTimeout(load,80));
setTimeout(load,1000);
})();

(()=>{
'use strict';
if(window.__VCCF_MUSIC_MINISTRY_READONLY_LOADER__)return;
window.__VCCF_MUSIC_MINISTRY_READONLY_LOADER__=true;
const state=()=>window.VCCF?.getState?.()||{};
function load(){
  if(!state().session?.user||!state().profile)return;
  if(document.querySelector('script[data-vccf-music-ministry-readonly]'))return;
  const s=document.createElement('script');
  s.src='/vccf-music-ministry-member-readonly.js?v=20260912-1';
  s.defer=true;
  s.dataset.vccfMusicMinistryReadonly='1';
  document.head.appendChild(s);
}
window.addEventListener('vccf-app-ready',()=>setTimeout(load,500));
window.addEventListener('vccf-profile-updated',()=>setTimeout(load,350));
setTimeout(load,1300);
})();
