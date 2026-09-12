(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_SELF_ONLY__)return;
window.__VCCF_ATTENDANCE_SELF_ONLY__=true;

const state=()=>window.VCCF?.getState?.()||{};
const role=()=>String(state().profile?.role||'member').toLowerCase();
const selfOnly=()=>['member','treasurer','guest'].includes(role());

function setAttendanceHeading(){
  const title=document.getElementById('title');
  const hint=document.querySelector('.top .hint');
  if(title)title.textContent='Attendance';
  if(hint)hint.textContent='Check in the member profile linked to your account.';
}

function activateAttendanceButton(button){
  document.querySelectorAll('.sidebar [data-route]').forEach(node=>node.classList.remove('active'));
  button?.classList.add('active');
}

function apply(){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar||!selfOnly())return;

  const buttons=[...sidebar.querySelectorAll('[data-route]')];
  let selfButton=buttons.find(button=>button.dataset.vccfSelfAttendance==='1')||buttons.find(button=>button.dataset.route==='selfcheck');
  const fullAttendance=buttons.find(button=>button.dataset.route==='attendance'&&button!==selfButton);

  // Guest-style accounts previously received the manager workspace because they are not
  // included in the legacy memberLike() check. Remove that route and use self check-in only.
  if(fullAttendance)fullAttendance.remove();
  if(!selfButton)return;

  selfButton.dataset.route='attendance';
  selfButton.dataset.vccfSelfAttendance='1';
  const label=selfButton.querySelector('.nav-label');
  if(label)label.textContent='Attendance';
  selfButton.setAttribute('aria-label','Attendance');

  if(selfButton.dataset.vccfAttendanceBound!=='1'){
    selfButton.dataset.vccfAttendanceBound='1';
    selfButton.addEventListener('click',()=>{
      // The shell's existing click handler reads dataset.route at click time. Temporarily
      // restore selfcheck so the private router opens the safe linked-account view.
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

const observer=new MutationObserver(()=>apply());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',()=>setTimeout(apply,120));
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-route="attendance"],[data-route="selfcheck"]'))setTimeout(apply,80);
});
setTimeout(apply,900);
})();
