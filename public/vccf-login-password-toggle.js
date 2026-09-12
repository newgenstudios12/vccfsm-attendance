(()=>{
'use strict';
if(window.__VCCF_LOGIN_PASSWORD_TOGGLE__)return;
window.__VCCF_LOGIN_PASSWORD_TOGGLE__=true;
function install(){
  const input=document.getElementById('password');
  if(!input||document.getElementById('vccfLoginPasswordToggle'))return;
  const field=input.closest('.field');
  if(!field)return;
  const wrap=document.createElement('div');
  wrap.className='vccf-login-password-wrap';
  input.parentNode.insertBefore(wrap,input);
  wrap.appendChild(input);
  const button=document.createElement('button');
  button.type='button';
  button.id='vccfLoginPasswordToggle';
  button.className='vccf-login-password-toggle';
  button.setAttribute('aria-label','Show password');
  button.setAttribute('aria-pressed','false');
  button.textContent='Show';
  button.onclick=()=>{
    const showing=input.type==='text';
    input.type=showing?'password':'text';
    button.textContent=showing?'Show':'Hide';
    button.setAttribute('aria-label',showing?'Show password':'Hide password');
    button.setAttribute('aria-pressed',String(!showing));
    input.focus({preventScroll:true});
  };
  wrap.appendChild(button);
  if(!document.getElementById('vccfLoginPasswordToggleStyle')){
    const style=document.createElement('style');
    style.id='vccfLoginPasswordToggleStyle';
    style.textContent='.vccf-login-password-wrap{position:relative}.vccf-login-password-wrap #password{padding-right:70px}.vccf-login-password-toggle{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:0;border-radius:8px;background:transparent;color:#6b7280;padding:6px 8px;font-size:.76rem;font-weight:800;cursor:pointer}.vccf-login-password-toggle:hover,.vccf-login-password-toggle:focus-visible{background:#f3f4f6;color:#15171c;outline:none}';
    document.head.appendChild(style);
  }
}
function loadAdminResetHelper(){
  if(document.querySelector('script[data-vccf-admin-password-reset-helper]'))return;
  const script=document.createElement('script');
  script.src='/vccf-admin-password-reset-helper.js?v=20260912-2';
  script.defer=true;
  script.dataset.vccfAdminPasswordResetHelper='1';
  document.head.appendChild(script);
}
function loadAdminAccountManager(){
  if(document.querySelector('script[data-vccf-admin-account-manager]')){loadAdminResetHelper();return;}
  const script=document.createElement('script');
  script.src='/vccf-admin-account-manager.js?v=20260912-2';
  script.defer=true;
  script.dataset.vccfAdminAccountManager='1';
  script.onload=()=>loadAdminResetHelper();
  document.head.appendChild(script);
}
function maybeLoadAdminAccountManager(){
  const settings=document.getElementById('settings');
  if(settings?.classList.contains('active'))loadAdminAccountManager();
}
function loadAttendanceSelfOnly(){
  if(document.querySelector('script[data-vccf-attendance-self-only]'))return;
  const script=document.createElement('script');
  script.src='/vccf-attendance-self-only.js?v=20260912-1';
  script.defer=true;
  script.dataset.vccfAttendanceSelfOnly='1';
  document.head.appendChild(script);
}
function loadMemberImportToolbarFix(){
  if(document.querySelector('script[data-vccf-member-import-toolbar-fix]'))return;
  const script=document.createElement('script');
  script.src='/vccf-member-import-toolbar-fix.js?v=20260912-1';
  script.defer=true;
  script.dataset.vccfMemberImportToolbarFix='1';
  document.head.appendChild(script);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('vccf-signed-out',install);
window.addEventListener('vccf-app-ready',()=>{setTimeout(maybeLoadAdminAccountManager,180);loadAttendanceSelfOnly();loadMemberImportToolbarFix();});
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-route="settings"],.nav button[data-view="settings"]'))setTimeout(maybeLoadAdminAccountManager,180);
});
setTimeout(()=>{if(document.getElementById('app')?.classList.contains('show')){maybeLoadAdminAccountManager();loadAttendanceSelfOnly();loadMemberImportToolbarFix()}},1400);
})();