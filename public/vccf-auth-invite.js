(() => {
'use strict';
if(window.__VCCF_AUTH_SETUP__)return;
window.__VCCF_AUTH_SETUP__=true;
const client=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showSetup({session,mode='invite'}){
  if(!session)return;
  document.getElementById('accountSetupOverlay')?.remove();
  const wrap=document.createElement('div');wrap.id='accountSetupOverlay';wrap.className='account-setup-overlay';
  const rawEmail=session.user?.email||'',username=rawEmail.endsWith('@vccf.local')?rawEmail.slice(0,-11):'',identity=username||rawEmail||'your account',temporary=mode==='temporary';
  wrap.innerHTML='<div class="account-setup-card card"><div class="account-setup-brand"><img src="/vccf-logo-black.png?v=20260903-2" alt="VCCF Santa Maria"></div><span class="account-setup-kicker">'+(temporary?'FIRST SIGN-IN':'ACCOUNT INVITATION')+'</span><h1>'+(temporary?'Change your temporary password':'Welcome to VCCF Connect')+'</h1><p>'+esc(identity)+'</p><div class="account-setup-copy">'+(temporary?'For security, replace the temporary password provided by the administrator before continuing.':'Your account has been created by a VCCF administrator. Choose your password to finish activating the account.')+'</div><form id="accountSetupForm"><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters"></label><label>Confirm password<input name="confirm" type="password" minlength="8" autocomplete="new-password" required placeholder="Repeat your password"></label><button class="btn" type="submit">Set Password & Continue</button><div id="accountSetupMsg" class="account-setup-msg" role="status"></div></form></div>';
  document.body.appendChild(wrap);
  const form=wrap.querySelector('#accountSetupForm');
  form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),password=String(fd.get('password')||''),confirm=String(fd.get('confirm')||''),button=form.querySelector('button'),msg=wrap.querySelector('#accountSetupMsg');if(password.length<8){msg.textContent='Password must be at least 8 characters.';return}if(password!==confirm){msg.textContent='Passwords do not match.';return}button.disabled=true;button.textContent='Saving…';msg.textContent='';const sb=client(),updated=await sb.auth.updateUser({password});if(updated.error){msg.textContent=updated.error.message;button.disabled=false;button.textContent='Set Password & Continue';return}if(temporary){const clear=await sb.from('profiles').update({must_change_password:false,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);if(clear.error){msg.textContent='Password changed, but account setup could not be completed. Please contact an administrator.';button.disabled=false;button.textContent='Set Password & Continue';return}const st=window.VCCF?.getState?.();if(st?.profile)st.profile.must_change_password=false}msg.classList.add('good');msg.textContent='Password saved. Opening VCCF Connect…';setTimeout(()=>location.replace(location.origin+location.pathname),500)};
}
function showError(message){document.getElementById('accountSetupOverlay')?.remove();const wrap=document.createElement('div');wrap.id='accountSetupOverlay';wrap.className='account-setup-overlay';wrap.innerHTML='<div class="account-setup-card card"><div class="account-setup-brand"><img src="/vccf-logo-black.png?v=20260903-2" alt="VCCF Santa Maria"></div><span class="account-setup-kicker">ACCOUNT INVITATION</span><h1>Invitation could not be opened</h1><p class="account-setup-error">'+esc(message||'The invitation may have expired. Ask an administrator to create a new invitation.')+'</p><a class="btn secondary account-setup-login" href="'+location.pathname+'">Back to sign in</a></div>';document.body.appendChild(wrap)}
async function handleInviteUrl(){const sb=client();if(!sb)return false;const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,'')),type=hash.get('type')||query.get('type')||'',providerError=hash.get('error_description')||query.get('error_description'),hasAuthLink=type==='invite'||query.has('code')||hash.has('access_token');if(!hasAuthLink)return false;if(providerError){showError(providerError);return true}try{if(hash.get('access_token')&&hash.get('refresh_token')){const r=await sb.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});if(r.error)throw r.error}else if(query.get('code')){const r=await sb.auth.exchangeCodeForSession(query.get('code'));if(r.error)throw r.error}const response=await sb.auth.getSession();if(response.error)throw response.error;if(!response.data?.session)throw new Error('This invitation is invalid or has expired.');showSetup({session:response.data.session,mode:'invite'})}catch(error){showError(error?.message||'Unable to open this invitation.')}return true}
window.addEventListener('vccf-force-password-change',async()=>{const response=await client()?.auth.getSession();if(response?.data?.session)showSetup({session:response.data.session,mode:'temporary'})});
handleInviteUrl();
})();
function loadVccfEnhancement(key,src){if(document.querySelector(`script[data-vccf-${key}]`))return;const s=document.createElement('script');s.src=src;s.dataset[`vccf${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';s.defer=true;document.head.appendChild(s)}
loadVccfEnhancement('member-360','/vccf-member-360.js?v=20260903-6');
loadVccfEnhancement('pwa','/vccf-pwa.js?v=20260904-6');
loadVccfEnhancement('notification-ux','/vccf-notification-ux.js?v=20260904-7');
loadVccfEnhancement('service-attendance-v2','/vccf-service-attendance-v2.js?v=20260904-1');
loadVccfEnhancement('event-attendance-gallery','/vccf-event-attendance-gallery.js?v=20260904-1');
loadVccfEnhancement('events-gallery','/vccf-events-gallery.js?v=20260904-1');
loadVccfEnhancement('attendance-nav-reconcile','/vccf-attendance-nav-reconcile.js?v=20260904-1');
loadVccfEnhancement('service-summary-gallery','/vccf-service-summary-gallery.js?v=20260904-1');
loadVccfEnhancement('event-attendance-area-stats','/vccf-event-attendance-area-stats.js?v=20260904-1');
loadVccfEnhancement('bible-study-giving','/vccf-bible-study-giving.js?v=20260904-1');
loadVccfEnhancement('bible-study-barangay-base','/vccf-bible-study-barangay-base.js?v=20260904-1');
loadVccfEnhancement('bible-study-barangay-dropdown','/vccf-bible-study-barangay-dropdown.js?v=20260904-1');
(()=>{if(window.__VCCF_BSG_PREVIEW_DEDUPE__)return;window.__VCCF_BSG_PREVIEW_DEDUPE__=true;const clean=()=>{const overlay=document.getElementById('serviceSummaryPreviewOverlay');if(!overlay)return;const blocks=[...overlay.querySelectorAll('.bsg-preview-finance')];blocks.slice(1).forEach(node=>node.remove())};const observer=new MutationObserver(clean);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('vccf-app-ready',clean);setTimeout(clean,0)})();
