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
loadVccfEnhancement('login-password-toggle','/vccf-login-password-toggle.js?v=20260912-1');
const ENHANCEMENTS=[
  ['member-360','/vccf-member-360.js?v=20260913-2'],
  ['member-attendance-performance','/vccf-member-attendance-performance.js?v=20260913-2'],
  ['member-profile-polish','/vccf-member-profile-polish.js?v=20260904-1'],
  ['member-followup-alerts','/vccf-member-followup-alerts.js?v=20260904-1'],
  ['member-contact-info','/vccf-member-contact-info.js?v=20260913-2'],
  ['pwa','/vccf-pwa.js?v=20260904-6'],
  ['notification-ux','/vccf-notification-ux.js?v=20260904-7'],
  ['notification-actions-leadership-photo','/vccf-notification-actions-leadership-photo.js?v=20260904-1'],
  ['visual-hierarchy','/vccf-visual-hierarchy.js?v=20260904-2'],
  ['service-attendance-v2','/vccf-service-attendance-v2.js?v=20260913-2'],
  ['event-attendance-gallery','/vccf-event-attendance-gallery.js?v=20260904-1'],
  ['events-gallery','/vccf-events-gallery.js?v=20260904-1'],
  ['attendance-nav-reconcile','/vccf-attendance-nav-reconcile.js?v=20260904-1'],
  ['service-summary-gallery','/vccf-service-summary-gallery.js?v=20260904-2'],
  ['bible-study-summary-photos','/vccf-bible-study-summary-photos.js?v=20260905-1'],
  ['event-attendance-area-stats','/vccf-event-attendance-area-stats.js?v=20260904-1'],
  ['bible-study-giving','/vccf-bible-study-giving.js?v=20260904-1'],
  ['bible-study-barangay-base','/vccf-bible-study-barangay-base.js?v=20260904-1'],
  ['bible-study-barangay-dropdown','/vccf-bible-study-barangay-dropdown.js?v=20260904-1'],
  ['member-address-filter','/vccf-member-address-filter.js?v=20260913-2'],
  ['band-fund','/vccf-band-fund.js?v=20260904-1']
];
function installBsgPreviewDedupe(){if(window.__VCCF_BSG_PREVIEW_DEDUPE__)return;window.__VCCF_BSG_PREVIEW_DEDUPE__=true;const clean=()=>{const overlay=document.getElementById('serviceSummaryPreviewOverlay');if(!overlay)return;const blocks=[...overlay.querySelectorAll('.bsg-preview-finance')];blocks.slice(1).forEach(node=>node.remove())};const observer=new MutationObserver(clean);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('vccf-app-ready',clean);setTimeout(clean,0)}
function loadAuthenticatedEnhancements(){
  const st=window.VCCF?.getState?.();
  if(!st?.session?.user)return;
  if(window.__VCCF_AUTH_ENHANCEMENTS_LOADED__)return;
  window.__VCCF_AUTH_ENHANCEMENTS_LOADED__=true;
  ENHANCEMENTS.forEach(([key,src])=>loadVccfEnhancement(key,src));
  installBsgPreviewDedupe();
}
window.addEventListener('vccf-app-ready',loadAuthenticatedEnhancements);
setTimeout(()=>{if(document.getElementById('app')?.classList.contains('show'))loadAuthenticatedEnhancements()},1200);

/* Login recovery: stale/invalid persisted Supabase refresh tokens can leave a browser session
   waiting on an auth refresh lock. An explicit sign-in should always start from a clean local
   auth client, then reload into the normal app bootstrap after a successful password login. */
(()=>{
'use strict';
if(window.__VCCF_LOGIN_RECOVERY__)return;
window.__VCCF_LOGIN_RECOVERY__=true;
const form=document.getElementById('loginForm');
if(!form)return;
const projectRef='hvnlstaecjqhjtiojutd';
const storagePrefix='sb-'+projectRef+'-auth-token';
const clearAuthStorage=()=>{
  for(const storage of [window.localStorage,window.sessionStorage]){
    try{
      for(let i=storage.length-1;i>=0;i--){
        const key=storage.key(i);
        if(key&&(key===storagePrefix||key.startsWith(storagePrefix)))storage.removeItem(key);
      }
    }catch(_){ }
  }
};
const withTimeout=(promise,ms)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Authentication request timed out. Please check your connection and try again.')),ms);
  Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)});
});
const setLoginMessage=(text,good=false)=>{const node=document.getElementById('loginMsg');if(!node)return;node.textContent=text;node.style.color=good?'#167647':'#b42318'};
form.addEventListener('submit',async event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const button=document.getElementById('loginBtn');
  const emailInput=document.getElementById('email');
  const passwordInput=document.getElementById('password');
  const raw=String(emailInput?.value||'').trim().toLowerCase();
  const password=String(passwordInput?.value||'');
  if(!raw||!password){setLoginMessage('Enter your email/username and password.');return}
  const normalized=raw.includes('@')?raw:raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'')+'@vccf.local';
  if(button){button.disabled=true;button.textContent='Signing in…'}
  setLoginMessage('');
  try{
    try{window.VCCF?.sb?.auth?.stopAutoRefresh?.()}catch(_){ }
    clearAuthStorage();
    const url=window.VCCF_SUPABASE_URL,key=window.VCCF_SUPABASE_PUBLISHABLE_KEY;
    if(!window.supabase?.createClient||!url||!key)throw new Error('Authentication service did not initialize. Reload VCCF Connect and try again.');
    const fresh=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    if(window.VCCF)window.VCCF.sb=fresh;
    const response=await withTimeout(fresh.auth.signInWithPassword({email:normalized,password}),10000);
    if(response?.error)throw response.error;
    if(!response?.data?.session)throw new Error('No authenticated session returned.');
    setLoginMessage('Signed in successfully. Opening VCCF Connect…',true);
    setTimeout(()=>location.reload(),120);
  }catch(error){
    console.error('VCCF login recovery',error);
    setLoginMessage(error?.message||'Unable to sign in.');
    if(button){button.disabled=false;button.textContent='Sign in'}
  }
},true);
})();

/* Login page: always use a light login surface and provide a return path to the public guest view. */
(()=>{
'use strict';
if(window.__VCCF_LOGIN_GUEST_LIGHT__)return;
window.__VCCF_LOGIN_GUEST_LIGHT__=true;
function installLoginGuestLight(){
  const login=document.getElementById('loginScreen'),card=login?.querySelector('.login-card');
  if(!login||!card)return;
  login.dataset.loginTheme='light';
  if(!document.getElementById('vccfLoginLightStyle')){
    const style=document.createElement('style');
    style.id='vccfLoginLightStyle';
    style.textContent=`
#loginScreen[data-login-theme="light"]{color-scheme:light;--bg:#f5f6f8;--card:#fff;--card-soft:#fafafa;--text:#15171c;--muted:#6b7280;--line:#e5e7eb;--brand:#d71920;--brand2:#ff8a18;--brand-soft:#fff0ed;--input:#fff;--hover:#f6f7f9;--shadow:0 12px 32px rgba(15,23,42,.08);background:#f7f7f8!important;color:#15171c!important}
#loginScreen[data-login-theme="light"] .login-panel{background:rgba(250,250,251,.98)!important;border-color:rgba(15,23,42,.08)!important;color:#15171c!important}
#loginScreen[data-login-theme="light"] .login-card{background:#fff!important;color:#15171c!important;border-color:#e5e7eb!important;box-shadow:0 12px 32px rgba(15,23,42,.08)!important}
#loginScreen[data-login-theme="light"] .login-brand img{filter:none!important}
#loginScreen[data-login-theme="light"] .login-brand h1,#loginScreen[data-login-theme="light"] .field label{color:#15171c!important}
#loginScreen[data-login-theme="light"] .login-brand p{color:#6b7280!important}
#loginScreen[data-login-theme="light"] .field input{background:#fff!important;color:#15171c!important;border-color:#e5e7eb!important;box-shadow:none}
#loginScreen[data-login-theme="light"] .field input::placeholder{color:#9ca3af!important}
#loginScreen[data-login-theme="light"] .field input:focus{border-color:#d71920!important;box-shadow:0 0 0 3px rgba(215,25,32,.08)!important}
#loginScreen[data-login-theme="light"] #loginBtn{background:linear-gradient(135deg,#d71920,#f0442f 50%,#ff8a18)!important;color:#fff!important}
#loginScreen[data-login-theme="light"] .msg{color:#b42318}
.vccf-guest-return{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:10px;padding:11px 14px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;color:#374151;text-decoration:none;font-size:.78rem;font-weight:800;transition:background .16s,border-color .16s,color .16s,transform .16s}
.vccf-guest-return:hover{background:#f9fafb;border-color:#d1d5db;color:#d71920}.vccf-guest-return:active{transform:scale(.99)}.vccf-guest-return:focus-visible{outline:3px solid rgba(215,25,32,.18);outline-offset:2px}
@media(max-width:600px){#loginScreen[data-login-theme="light"]{background:url('/Churchfront_login.png?v=20260903-2') center/cover no-repeat!important}#loginScreen[data-login-theme="light"] .login-panel{background:transparent!important;border:0!important}#loginScreen[data-login-theme="light"] .login-card{background:rgba(255,255,255,.94)!important}.vccf-guest-return{min-height:44px}}
`;
    document.head.appendChild(style);
  }
  if(!document.getElementById('guestReturnLink')){
    const link=document.createElement('a');
    link.id='guestReturnLink';
    link.className='vccf-guest-return';
    link.href='/';
    link.setAttribute('aria-label','Back to guest page');
    link.innerHTML='← <span>Back to Guest Page</span>';
    card.appendChild(link);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installLoginGuestLight,{once:true});else installLoginGuestLight();
window.addEventListener('vccf-signed-out',installLoginGuestLight);
})();