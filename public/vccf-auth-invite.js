(() => {
'use strict';
if(window.__VCCF_AUTH_SETUP__)return;
window.__VCCF_AUTH_SETUP__=true;
const client=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function showSetup({session,mode='invite'}){
  if(!session)return;
  document.getElementById('accountSetupOverlay')?.remove();
  const wrap=document.createElement('div');
  wrap.id='accountSetupOverlay';
  wrap.className='account-setup-overlay';
  const rawEmail=session.user?.email||'';
  const username=rawEmail.endsWith('@vccf.local')?rawEmail.slice(0,-11):'';
  const identity=username||rawEmail||'your account';
  const temporary=mode==='temporary';
  wrap.innerHTML='<div class="account-setup-card card"><div class="account-setup-brand"><img src="/vccf-logo-black.png?v=20260903-2" alt="VCCF Santa Maria"></div><span class="account-setup-kicker">'+(temporary?'FIRST SIGN-IN':'ACCOUNT INVITATION')+'</span><h1>'+(temporary?'Change your temporary password':'Welcome to VCCF Connect')+'</h1><p>'+esc(identity)+'</p><div class="account-setup-copy">'+(temporary?'For security, replace the temporary password provided by the administrator before continuing.':'Your account has been created by a VCCF administrator. Choose your password to finish activating the account.')+'</div><form id="accountSetupForm"><label>New password<input name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="At least 8 characters"></label><label>Confirm password<input name="confirm" type="password" minlength="8" autocomplete="new-password" required placeholder="Repeat your password"></label><button class="btn" type="submit">Set Password & Continue</button><div id="accountSetupMsg" class="account-setup-msg" role="status"></div></form></div>';
  document.body.appendChild(wrap);
  const form=wrap.querySelector('#accountSetupForm');
  form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const password=String(fd.get('password')||'');
    const confirm=String(fd.get('confirm')||'');
    const button=form.querySelector('button');
    const msg=wrap.querySelector('#accountSetupMsg');
    if(password.length<8){msg.textContent='Password must be at least 8 characters.';return}
    if(password!==confirm){msg.textContent='Passwords do not match.';return}
    button.disabled=true;button.textContent='Saving…';msg.textContent='';
    const sb=client();
    if(!sb){msg.textContent='Authentication service is unavailable. Reload VCCF Connect and try again.';button.disabled=false;button.textContent='Set Password & Continue';return}
    const updated=await sb.auth.updateUser({password});
    if(updated.error){msg.textContent=updated.error.message;button.disabled=false;button.textContent='Set Password & Continue';return}
    if(temporary){
      const clear=await sb.from('profiles').update({must_change_password:false,updated_at:new Date().toISOString()}).eq('user_id',session.user.id);
      if(clear.error){msg.textContent='Password changed, but account setup could not be completed. Please contact an administrator.';button.disabled=false;button.textContent='Set Password & Continue';return}
      const st=window.VCCF?.getState?.();
      if(st?.profile)st.profile.must_change_password=false;
    }
    msg.classList.add('good');
    msg.textContent='Password saved. Opening VCCF Connect…';
    setTimeout(()=>location.replace(location.origin+location.pathname),500);
  };
}

function showError(message){
  document.getElementById('accountSetupOverlay')?.remove();
  const wrap=document.createElement('div');
  wrap.id='accountSetupOverlay';
  wrap.className='account-setup-overlay';
  wrap.innerHTML='<div class="account-setup-card card"><div class="account-setup-brand"><img src="/vccf-logo-black.png?v=20260903-2" alt="VCCF Santa Maria"></div><span class="account-setup-kicker">ACCOUNT INVITATION</span><h1>Invitation could not be opened</h1><p class="account-setup-error">'+esc(message||'The invitation may have expired. Ask an administrator to create a new invitation.')+'</p><a class="btn secondary account-setup-login" href="'+location.pathname+'">Back to sign in</a></div>';
  document.body.appendChild(wrap);
}

async function handleInviteUrl(){
  const sb=client();
  if(!sb)return false;
  const query=new URLSearchParams(location.search);
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const type=hash.get('type')||query.get('type')||'';
  const providerError=hash.get('error_description')||query.get('error_description');
  const hasAuthLink=type==='invite'||query.has('code')||hash.has('access_token');
  if(!hasAuthLink)return false;
  if(providerError){showError(providerError);return true}
  try{
    if(hash.get('access_token')&&hash.get('refresh_token')){
      const r=await sb.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});
      if(r.error)throw r.error;
    }else if(query.get('code')){
      const r=await sb.auth.exchangeCodeForSession(query.get('code'));
      if(r.error)throw r.error;
    }
    const response=await sb.auth.getSession();
    if(response.error)throw response.error;
    if(!response.data?.session)throw new Error('This invitation is invalid or has expired.');
    showSetup({session:response.data.session,mode:'invite'});
  }catch(error){showError(error?.message||'Unable to open this invitation.')}
  return true;
}

window.addEventListener('vccf-force-password-change',async()=>{
  const response=await client()?.auth.getSession();
  if(response?.data?.session)showSetup({session:response.data.session,mode:'temporary'});
});
handleInviteUrl();
})();

function loadVccfEnhancement(key,src){
  if(document.querySelector(`script[data-vccf-${key}]`))return;
  const s=document.createElement('script');
  s.src=src;
  s.dataset[`vccf${key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())}`]='1';
  s.defer=true;
  document.head.appendChild(s);
}

const ENHANCEMENTS=[
  ['member-360','/vccf-member-360.js?v=20260903-6'],
  ['member-attendance-performance','/vccf-member-attendance-performance.js?v=20260904-1'],
  ['member-profile-polish','/vccf-member-profile-polish.js?v=20260904-1'],
  ['member-followup-alerts','/vccf-member-followup-alerts.js?v=20260904-1'],
  ['member-contact-info','/vccf-member-contact-info.js?v=20260904-1'],
  ['pwa','/vccf-pwa.js?v=20260904-6'],
  ['notification-ux','/vccf-notification-ux.js?v=20260904-7'],
  ['notification-actions-leadership-photo','/vccf-notification-actions-leadership-photo.js?v=20260904-1'],
  ['visual-hierarchy','/vccf-visual-hierarchy.js?v=20260904-2'],
  ['service-attendance-v2','/vccf-service-attendance-v2.js?v=20260904-1'],
  ['event-attendance-gallery','/vccf-event-attendance-gallery.js?v=20260904-1'],
  ['events-gallery','/vccf-events-gallery.js?v=20260904-1'],
  ['attendance-nav-reconcile','/vccf-attendance-nav-reconcile.js?v=20260904-1'],
  ['service-summary-gallery','/vccf-service-summary-gallery.js?v=20260904-2'],
  ['bible-study-summary-photos','/vccf-bible-study-summary-photos.js?v=20260905-1'],
  ['event-attendance-area-stats','/vccf-event-attendance-area-stats.js?v=20260904-1'],
  ['bible-study-giving','/vccf-bible-study-giving.js?v=20260904-1'],
  ['bible-study-barangay-base','/vccf-bible-study-barangay-base.js?v=20260904-1'],
  ['bible-study-barangay-dropdown','/vccf-bible-study-barangay-dropdown.js?v=20260904-1'],
  ['member-address-filter','/vccf-member-address-filter.js?v=20260904-2'],
  ['band-fund','/vccf-band-fund.js?v=20260904-1']
];

function installBsgPreviewDedupe(){
  if(window.__VCCF_BSG_PREVIEW_DEDUPE__)return;
  window.__VCCF_BSG_PREVIEW_DEDUPE__=true;
  const clean=()=>{
    const overlay=document.getElementById('serviceSummaryPreviewOverlay');
    if(!overlay)return;
    const blocks=[...overlay.querySelectorAll('.bsg-preview-finance')];
    blocks.slice(1).forEach(node=>node.remove());
  };
  const observer=new MutationObserver(clean);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('vccf-app-ready',clean);
  setTimeout(clean,0);
}

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

/* Explicit login recovery.
   Authenticate through Supabase Auth REST, then persist the returned session under the same
   storage key used by supabase-js. This avoids creating a second GoTrue client for the same
   browser storage key, which can race the page's primary client and cause a login/reload loop. */
(()=>{
'use strict';
if(window.__VCCF_LOGIN_RECOVERY__)return;
window.__VCCF_LOGIN_RECOVERY__=true;
const form=document.getElementById('loginForm');
if(!form)return;
const projectRef='hvnlstaecjqhjtiojutd';
const fallbackUrl='https://hvnlstaecjqhjtiojutd.supabase.co';
const fallbackKey='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const storageKey='sb-'+projectRef+'-auth-token';
const TIMEOUT=15000;

const setLoginMessage=(text,good=false)=>{
  const node=document.getElementById('loginMsg');
  if(!node)return;
  node.textContent=text;
  node.style.color=good?'#167647':'#b42318';
};

const clearStoredSession=()=>{
  for(const storage of [window.localStorage,window.sessionStorage]){
    try{
      for(let i=storage.length-1;i>=0;i--){
        const key=storage.key(i);
        if(key&&(key===storageKey||key.startsWith(storageKey)))storage.removeItem(key);
      }
    }catch(_){ }
  }
};

const persistSession=session=>{
  const saved={...session};
  if(!saved.expires_at)saved.expires_at=Math.floor(Date.now()/1000)+Number(saved.expires_in||3600);
  localStorage.setItem(storageKey,JSON.stringify(saved));
  return saved;
};

const toEmail=value=>{
  const raw=String(value||'').trim().toLowerCase();
  if(raw.includes('@'))return raw;
  const clean=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');
  return clean?clean+'@vccf.local':'';
};

async function passwordGrant(url,key,email,password){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT);
  try{
    const response=await fetch(url+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':key},
      body:JSON.stringify({email,password}),
      signal:controller.signal
    });
    let data={};
    try{data=await response.json()}catch(_){ }
    if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||('Authentication failed ('+response.status+').'));
    if(!data?.access_token||!data?.refresh_token||!data?.user)throw new Error('Authentication returned an incomplete session.');
    return data;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Authentication request timed out. Please check your connection and try again.');
    throw error;
  }finally{clearTimeout(timer)}
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const button=document.getElementById('loginBtn');
  const emailInput=document.getElementById('email');
  const passwordInput=document.getElementById('password');
  const email=toEmail(emailInput?.value||'');
  const password=String(passwordInput?.value||'');
  if(!email||!password){setLoginMessage('Enter your email/username and password.');return}
  if(button){button.disabled=true;button.textContent='Signing in…'}
  setLoginMessage('');
  try{
    const url=window.VCCF_SUPABASE_URL||fallbackUrl;
    const key=window.VCCF_SUPABASE_PUBLISHABLE_KEY||fallbackKey;
    window.VCCF_SUPABASE_URL=url;
    window.VCCF_SUPABASE_PUBLISHABLE_KEY=key;
    const session=await passwordGrant(url,key,email,password);
    clearStoredSession();
    persistSession(session);
    const persisted=localStorage.getItem(storageKey);
    if(!persisted)throw new Error('Your browser did not save the login session. Please allow website data for VCCF Connect and try again.');
    setLoginMessage('Signed in successfully. Opening VCCF Connect…',true);
    setTimeout(()=>location.reload(),350);
  }catch(error){
    console.error('VCCF login recovery',error);
    setLoginMessage(error?.message||'Unable to sign in.');
    if(button){button.disabled=false;button.textContent='Sign in'}
  }
},true);
})();
