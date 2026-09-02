/* VCCF_LOGIN_GUARD_V10
   Single login boundary. Uses the Supabase Auth token endpoint directly so legacy
   compatibility wrappers and competing GoTrue clients cannot block sign-in.
*/
(()=>{
'use strict';
if(window.__VCCF_LOGIN_GUARD_V10__) return;
window.__VCCF_LOGIN_GUARD_V10__ = true;

const SUPABASE_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const SUPABASE_KEY='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const TIMEOUT=15000;
const STORAGE_KEY='sb-hvnlstaecjqhjtiojutd-auth-token';
window.VCCF_SUPABASE_URL=SUPABASE_URL;
window.VCCF_SUPABASE_PUBLISHABLE_KEY=SUPABASE_KEY;

const errBox=form=>{
  let b=document.getElementById('vccfLoginError');
  if(!b){b=document.createElement('div');b.id='vccfLoginError';b.setAttribute('role','status');b.setAttribute('aria-live','polite');b.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap';form.appendChild(b)}
  return b;
};
const busy=(form,on)=>{const b=form?.querySelector('button[type="submit"],button');if(b){b.disabled=on;b.textContent=on?'Signing in…':'Sign in'}};
const emailFor=id=>{
  const raw=String(id||'').trim().toLowerCase();
  if(raw.includes('@')) return raw;
  const clean=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');
  return clean?`${clean}@vccf.local`:'';
};
const persistSession=s=>{
  const payload={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)};
  localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));
  window.__VCCF_AUTH_SESSION__=payload;
};
const activate=(user,identifier)=>{
  const meta=user?.user_metadata||{};
  const name=meta.display_name||meta.full_name||user?.email||identifier||'Member';
  const role=meta.role||'Member';
  window.session={username:user?.email||identifier,name,role,area:'',areaId:null,memberId:null,memberCode:null};
  try{session=window.session}catch{}
  const login=document.getElementById('login'),app=document.getElementById('app');
  if(login){login.classList.add('hidden');login.style.display='none';login.setAttribute('aria-hidden','true')}
  if(app){app.classList.add('active');app.style.display='flex';app.removeAttribute('aria-hidden')}
  const n=document.getElementById('currentName');if(n)n.textContent=name;
  const r=document.getElementById('currentRole');if(r)r.textContent=role;
  const a=document.getElementById('avatar');if(a)a.textContent=name.charAt(0).toUpperCase();
  const ai=document.getElementById('accountInfo');if(ai)ai.textContent=`${name} · ${role}`;
  window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user,session:window.__VCCF_AUTH_SESSION__}}));
  setTimeout(async()=>{
    try{
      if(typeof window.loadDb==='function') await Promise.race([window.loadDb(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('VCCF data loading timed out.')),10000))]);
      if(typeof window.refresh==='function') await window.refresh();
    }catch(e){console.warn('VCCF post-login hydration:',e);if(typeof window.toast==='function')window.toast('Signed in. Some VCCF data is still loading.')}
  },0);
};

async function authenticate(form){
  if(form.dataset.vccfBusy==='1') return;
  form.dataset.vccfBusy='1';busy(form,true);
  const box=errBox(form);box.textContent='';box.style.background='#fff1f1';box.style.color='#b42318';
  try{
    const id=document.getElementById('loginUser')?.value||'';
    const password=document.getElementById('loginPass')?.value||'';
    if(!String(id).trim()) throw new Error('Please enter your email or username.');
    if(!password) throw new Error('Please enter your password.');
    const email=emailFor(id);if(!email) throw new Error('Please enter a valid email or username.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT);
    let response;
    try{response=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,password}),signal:controller.signal});}
    catch(e){if(e?.name==='AbortError')throw new Error('Sign-in timed out. Please try again.');throw new Error('Unable to contact VCCF authentication service. Please try again.');}
    finally{clearTimeout(timer)}
    let data={};try{data=await response.json()}catch{}
    if(!response.ok) throw new Error(data?.msg||data?.message||data?.error_description||data?.error||`Authentication failed (${response.status}).`);
    if(!data?.access_token||!data?.user||!data?.refresh_token) throw new Error('Authentication returned an incomplete session.');
    persistSession(data);
    box.style.background='#ecfdf3';box.style.color='#027a48';box.textContent='Sign-in successful. Loading VCCF…';
    activate(data.user,id);
  }catch(e){console.error('VCCF authentication:',e);box.style.background='#fff1f1';box.style.color='#b42318';box.textContent=String(e?.message||e||'Unable to sign in.')}finally{form.dataset.vccfBusy='0';busy(form,false)}
}

const intercept=e=>{const form=e.target?.closest?.('#loginForm');if(!form)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();authenticate(form)};
// Capture phase ensures legacy bubble-phase submit handlers never execute.
document.addEventListener('submit',intercept,true);

function lock(form){
  if(!form||form.__VCCF_LOGIN_LOCK_V10__)return;
  form.__VCCF_LOGIN_LOCK_V10__=true;
  try{form.onsubmit=null;form.removeAttribute('onsubmit');Object.defineProperty(form,'onsubmit',{configurable:false,enumerable:false,get(){return null},set(){return null}})}catch{}
}
function scan(){lock(document.getElementById('loginForm'))}
scan();
if(document.documentElement){const mo=new MutationObserver(scan);mo.observe(document.documentElement,{childList:true,subtree:true});window.__VCCF_LOGIN_FORM_OBSERVER_V10__=mo}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});

// Restore an existing Supabase session without querying it during initial script execution.
function restore(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const s=JSON.parse(raw);if(!s?.access_token||!s?.user)return;const exp=s.expires_at||0;if(exp&&exp<Math.floor(Date.now()/1000))return;window.__VCCF_AUTH_SESSION__=s;activate(s.user,s.user.email||'')}catch(e){console.warn('VCCF session restore:',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});else restore();
})();
