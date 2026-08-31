(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V21__)return;
window.__VCCF_DASHBOARD_LOADER_V21__=true;
const stamp='202609011710';

// Capture login submissions before any later inline/module handler can replace the form owner.
if(!window.__VCCF_LOGIN_CAPTURE_V1__){
  window.__VCCF_LOGIN_CAPTURE_V1__=true;
  document.addEventListener('submit',async event=>{
    const form=event.target?.closest?.('#loginForm');
    if(!form || window.__VCCF_LOGIN_CAPTURE_ACTIVE__)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    window.__VCCF_LOGIN_CAPTURE_ACTIVE__=true;
    const btn=form.querySelector('button[type="submit"],button');
    const userInput=document.getElementById('loginUser');
    const passInput=document.getElementById('loginPass');
    const showError=message=>{
      const toast=document.getElementById('toast');
      if(toast){toast.textContent=message;toast.classList.add('show');clearTimeout(window.__vccfLoginToast);window.__vccfLoginToast=setTimeout(()=>toast.classList.remove('show'),3500)}
    };
    try{
      const email=userInput?.value.trim()||'';
      const password=passInput?.value||'';
      if(!email||!password)throw new Error('Please enter your email and password.');
      if(!window.supabase?.createClient)throw new Error('Authentication service is unavailable. Please refresh the page.');
      if(btn){btn.disabled=true;btn.textContent='Signing in…'}
      const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      const user=data?.user;
      if(!user)throw new Error('Authentication succeeded but no user session was returned.');
      const {data:p,error:pe}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle();
      if(pe)throw pe;
      if(!p)throw new Error('Your account is authenticated but has no VCCF profile. Please contact an administrator.');
      let area='';
      if(p.area_id){const {data:a}=await client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle();area=a?.name||''}
      const next={username:p.user_id,name:p.display_name||user.email||'Member',role:p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member',area,areaId:p.area_id,memberId:p.member_id,memberCode:null};
      window.profile=p;window.session=next;
      try{if(typeof profile!=='undefined')profile=p;if(typeof session!=='undefined')session=next}catch{}
      const login=document.getElementById('login'),app=document.getElementById('app');
      if(login)login.style.display='none';
      if(app)app.classList.add('active');
      const n=document.getElementById('currentName');if(n)n.textContent=next.name;
      const r=document.getElementById('currentRole');if(r)r.textContent=next.role+(area?' · '+area:'');
      const av=document.getElementById('avatar');if(av)av.textContent=(next.name||'M')[0].toUpperCase();
      const ai=document.getElementById('accountInfo');if(ai)ai.textContent=next.name+' · '+next.role;
      window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user,profile:p}}));
      try{if(typeof window.refresh==='function')window.refresh()}catch{}
      Promise.resolve().then(async()=>{try{if(typeof window.loadDb==='function'){await window.loadDb();if(typeof window.refresh==='function')window.refresh()}}catch(err){console.warn('Dashboard data deferred:',err)}});
    }catch(err){console.error('VCCF login capture:',err);showError(err?.message||'Unable to sign in.')}finally{
      window.__VCCF_LOGIN_CAPTURE_ACTIVE__=false;
      if(btn){btn.disabled=false;btn.textContent='Sign in'}
    }
  },true);
}

function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=${stamp}`;s.async=true;(document.head||document.documentElement).appendChild(s)}
function css(href){if(document.querySelector(`link[href^="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${href}?v=${stamp}`;document.head.appendChild(l)}
function loadPostAuthModules(){
  if(window.__VCCF_POST_AUTH_MODULES_LOADED__)return;
  window.__VCCF_POST_AUTH_MODULES_LOADED__=true;
  css('/vccf-device-responsive.css');
  css('/vccf-mobile-hardening.css');
  load('/vccf-dashboard-features-v3.js');
  load('/vccf-members-clean-v1.js');
  load('/vccf-member-category-v1.js');
  load('/vccf-install-app.js');
  load('/vccf-dark-mode-fix.js');
  load('/vccf-special-events.js');
  load('/vccf-special-event-checkin.js');
}
load('/vccf-login-early-fix.js');
window.addEventListener('vccf-authenticated',()=>setTimeout(loadPostAuthModules,0),{once:true});
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    css('/vccf-device-responsive.css');
    css('/vccf-mobile-hardening.css');
    if(window.session||window.profile||document.getElementById('app')?.classList.contains('active'))loadPostAuthModules();
  },{once:true});
}else{
  css('/vccf-device-responsive.css');
  css('/vccf-mobile-hardening.css');
  if(window.session||window.profile||document.getElementById('app')?.classList.contains('active'))loadPostAuthModules();
}
})();
