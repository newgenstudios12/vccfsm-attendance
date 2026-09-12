(()=>{
'use strict';
if(window.__VCCF_ADMIN_PASSWORD_RESET_HELPER__)return;
window.__VCCF_ADMIN_PASSWORD_RESET_HELPER__=true;

function enhanceManager(){
  const manager=document.getElementById('vccfAdminAccountManager');
  if(manager){
    const sub=manager.querySelector('.vccf-ac-sub');
    if(sub&&!sub.dataset.passwordResetHelp){
      sub.dataset.passwordResetHelp='1';
      sub.textContent='Edit existing user accounts, roles, areas, member links and e-mail addresses. To reset a forgotten password, open Edit, enter a new password, then save.';
    }
    manager.querySelectorAll('[data-ac-edit]').forEach(button=>{
      if(button.dataset.passwordResetHelp)return;
      button.dataset.passwordResetHelp='1';
      button.textContent='Edit / Reset Password';
      button.title='Edit this account or set a new password if the user forgot it';
    });
  }

  const dialog=document.getElementById('vccfAdminAccountDialog');
  if(dialog?.classList.contains('open')){
    const password=dialog.querySelector('#acPassword');
    if(password&&!password.dataset.resetHelp){
      password.dataset.resetHelp='1';
      const field=password.closest('.field');
      const label=field?.querySelector('label');
      if(label)label.innerHTML='Reset password <span style="color:var(--muted);font-weight:500">(leave blank to keep current password)</span>';
      const note=document.createElement('div');
      note.className='vccf-ac-sub';
      note.style.marginTop='6px';
      note.textContent='If the user forgot their password, enter a new password of at least 8 characters here and save the account. The old password cannot be viewed.';
      field?.appendChild(note);
    }
  }
}

const observer=new MutationObserver(enhanceManager);
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',()=>setTimeout(enhanceManager,250));
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-route="settings"],.nav button[data-view="settings"],[data-ac-edit]'))setTimeout(enhanceManager,160);
});
setTimeout(enhanceManager,800);
})();