/* VCCF_LOGIN_GUARD_V9
   One Supabase client + one authentication boundary.
   The login form is locked before legacy compatibility handlers can attach.
*/
(()=>{
'use strict';
if(window.__VCCF_LOGIN_GUARD_V9__)return;
window.__VCCF_LOGIN_GUARD_V9__=true;

const VCCF_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const VCCF_KEY='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const AUTH_TIMEOUT=15000;

window.VCCF_SUPABASE_URL=VCCF_URL;
window.VCCF_SUPABASE_PUBLISHABLE_KEY=VCCF_KEY;

const supabaseApi=window.supabase;
const nativeCreateClient=supabaseApi?.createClient;
let canonical=window.__VCCF_AUTH_CLIENT__||null;
if(!canonical&&nativeCreateClient){
  canonical=nativeCreateClient.call(supabaseApi,VCCF_URL,VCCF_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  window.__VCCF_AUTH_CLIENT__=canonical;
}
if(nativeCreateClient&&!window.__VCCF_CREATE_CLIENT_SINGLETON_V9__){
  window.__VCCF_CREATE_CLIENT_SINGLETON_V9__=true;
  const singleton=canonical;
  supabaseApi.createClient=function(url,key,options){
    if(singleton&&url===VCCF_URL&&key===VCCF_KEY)return singleton;
    return nativeCreateClient.call(this,url,key,options);
  };
}

function errorBox(form){
  let b=document.getElementById('vccfLoginError');
  if(!b){
    b=document.createElement('div');
    b.id='vccfLoginError';
    b.setAttribute('role','status');
    b.setAttribute('aria-live','polite');
    b.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap';
    form.appendChild(b);
  }
  return b;
}
function busy(form,on){
  const b=form.querySelector('button[type="submit"],button');
  if(b){b.disabled=on;b.textContent=on?'Signing in…':'Sign in';}
}
function activate(user,identifier){
  const meta=user?.user_metadata||{};
  const name=meta.display_name||meta.full_name||user?.email||identifier||'Member';
  window.session={username:user?.email||identifier,name,role:meta.role||'Member',area:'',areaId:null,memberId:null,memberCode:null};
  const login=document.getElementById('login'),app=document.getElementById('app');
  if(login){login.classList.add('hidden');login.style.display='none';login.setAttribute('aria-hidden','true');}
  if(app){app.classList.add('active');app.style.display='flex';app.removeAttribute('aria-hidden','true');}
  const n=document.getElementById('currentName');if(n)n.textContent=name;
  const r=document.getElementById('currentRole');if(r)r.textContent=meta.role||'Member';
  const a=document.getElementById('avatar');if(a)a.textContent=name.charAt(0).toUpperCase();
  window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user}}));
  setTimeout(async()=>{
    try{
      if(typeof window.loadDb==='function'){
        await Promise.race([window.loadDb(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('VCCF data hydration timed out.')),10000))]);
      }
      if(typeof window.refresh==='function')await window.refresh();
    }catch(e){
      console.warn('VCCF post-login hydration:',e);
      if(typeof window.toast==='function')window.toast('Signed in. Some VCCF data is still loading.');
    }
  },0);
}

async function signIn(form){
  if(form.dataset.vccfBusy==='1')return;
  form.dataset.vccfBusy='1';
  busy(form,true);
  const box=errorBox(form);
  box.textContent='';
  try{
    const rawId=document.getElementById('loginUser')?.value.trim()||'';
    const password=document.getElementById('loginPass')?.value||'';
    if(!rawId)throw new Error('Please enter your email or username.');
    if(!password)throw new Error('Please enter your password.');
    const raw=rawId.toLowerCase();
    const sanitized=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');
    const email=raw.includes('@')?raw:(sanitized?sanitized+'@vccf.local':'');
    if(!email)throw new Error('Please enter a valid email or username.');
    if(!canonical)throw new Error('Authentication client could not be initialized.');

    const result=await Promise.race([
      canonical.auth.signInWithPassword({email,password}),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sign-in timed out. Please try again.')),AUTH_TIMEOUT))
    ]);
    if(result.error)throw new Error(result.error.message);
    if(!result.data?.user||!result.data?.session)throw new Error('Authentication succeeded but no session was established.');

    box.style.background='#ecfdf3';
    box.style.color='#027a48';
    box.textContent='Sign-in successful. Loading VCCF…';
    activate(result.data.user,rawId);
  }catch(e){
    console.error('VCCF authentication:',e);
    box.style.background='#fff1f1';
    box.style.color='#b42318';
    box.textContent=String(e?.message||e||'Unable to sign in.');
  }finally{
    form.dataset.vccfBusy='0';
    busy(form,false);
  }
}

const intercept=e=>{
  const form=e.target?.closest?.('#loginForm');
  if(!form)return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  signIn(form);
};
document.addEventListener('submit',intercept,true);

function lockLoginForm(form){
  if(!form||form.__VCCF_LOGIN_LOCK_V9__)return;
  form.__VCCF_LOGIN_LOCK_V9__=true;
  try{form.onsubmit=null;form.removeAttribute('onsubmit');}catch{}
  try{
    Object.defineProperty(form,'onsubmit',{configurable:false,enumerable:false,get(){return null},set(){return null}});
  }catch(e){console.warn('VCCF login form lock:',e)}
}

// Lock immediately when the form appears, before DOMContentLoaded timers from legacy config can attach.
function scanLoginForm(){lockLoginForm(document.getElementById('loginForm'));}
scanLoginForm();
if(document.documentElement){
  const observer=new MutationObserver(scanLoginForm);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.__VCCF_LOGIN_FORM_OBSERVER_V9__=observer;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scanLoginForm,{once:true});
else scanLoginForm();
})();
