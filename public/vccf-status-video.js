(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V25__)return;
window.__VCCF_DASHBOARD_LOADER_V25__=true;
const stamp='202609011840';
const usernameEmail=value=>{const raw=String(value||'').trim().toLowerCase();if(!raw)return '';if(raw.includes('@'))return raw;const u=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');return u?`${u}@vccf.local`:'';};
const timeout=(promise,ms)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Authentication service did not respond. Please check your connection and try again.')),ms))]);
function showLoginMessage(text,ok=false){const form=document.getElementById('loginForm');if(!form)return;let box=document.getElementById('vccfLoginError');if(!box){box=document.createElement('div');box.id='vccfLoginError';box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;line-height:1.45;white-space:pre-wrap';form.appendChild(box)}box.style.background=ok?'#ecfdf3':'#fff1f1';box.style.color=ok?'#027a48':'#b42318';box.textContent=text;box.style.display='block';}
function enforceLoginHitArea(){
  const login=document.getElementById('login');
  if(!login)return;
  const visible=getComputedStyle(login).display!=='none'&&getComputedStyle(login).visibility!=='hidden'&&!login.classList.contains('hidden');
  if(!visible)return;
  login.style.setProperty('position','fixed','important');
  login.style.setProperty('inset','0','important');
  login.style.setProperty('z-index','2147483640','important');
  login.style.setProperty('pointer-events','auto','important');
  login.style.setProperty('touch-action','manipulation','important');
  document.querySelectorAll('body>*').forEach(el=>{
    if(el===login)return;
    el.style.setProperty('pointer-events','none','important');
  });
  login.querySelectorAll('*').forEach(el=>{
    el.style.setProperty('pointer-events','auto','important');
    if(el instanceof HTMLElement)el.style.setProperty('touch-action','manipulation','important');
  });
}
function releaseLoginHitArea(){
  document.querySelectorAll('body>*').forEach(el=>el.style.removeProperty('pointer-events'));
  const login=document.getElementById('login');
  if(login){login.style.removeProperty('position');login.style.removeProperty('inset');login.style.removeProperty('z-index');login.style.removeProperty('pointer-events');login.style.removeProperty('touch-action');}
}
function installLoginHitSafety(){
  enforceLoginHitArea();
  const observer=new MutationObserver(()=>{
    const app=document.getElementById('app');
    if(app?.classList.contains('active')){releaseLoginHitArea();observer.disconnect();return;}
    enforceLoginHitArea();
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  window.addEventListener('vccf-authenticated',()=>{releaseLoginHitArea();observer.disconnect();},{once:true});
  window.addEventListener('load',enforceLoginHitArea,{once:true});
}
function clearLegacySubmit(form){if(form)form.onsubmit=null;}
async function handleLogin(event){
  const form=event.target?.closest?.('#loginForm');
  if(!form)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
  if(window.__VCCF_LOGIN_ACTIVE__)return;
  window.__VCCF_LOGIN_ACTIVE__=true;
  const btn=form.querySelector('button[type="submit"],button');
  try{
    const raw=form.querySelector('#loginUser')?.value.trim()||'';
    const password=form.querySelector('#loginPass')?.value||'';
    const email=usernameEmail(raw);
    if(!raw||!password)throw new Error('Please enter your username/email and password.');
    if(!email)throw new Error('Please enter a valid username or email.');
    if(!window.supabase?.createClient)throw new Error('Authentication service is unavailable. Please refresh the page.');
    if(btn){btn.disabled=true;btn.textContent='Signing in…';}
    const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    const {data,error}=await timeout(client.auth.signInWithPassword({email,password}),12000);
    if(error)throw new Error(error.message||'Invalid username/email or password.');
    const user=data?.user;
    if(!user)throw new Error('Authentication succeeded but no session was returned.');
    const login=document.getElementById('login'),app=document.getElementById('app');
    if(login){releaseLoginHitArea();login.classList.add('hidden');login.style.display='none';login.setAttribute('aria-hidden','true');}
    if(app){app.classList.add('active');app.style.display='flex';app.removeAttribute('aria-hidden');}
    const temp={username:email,name:user.user_metadata?.display_name||user.email||raw,role:'Member',area:'',areaId:null,memberId:null,memberCode:null};
    window.session=temp;try{session=temp}catch{}
    const nameEl=document.getElementById('currentName');if(nameEl)nameEl.textContent=temp.name;
    const roleEl=document.getElementById('currentRole');if(roleEl)roleEl.textContent='Member';
    const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=(temp.name||'M').charAt(0).toUpperCase();
    const accountInfo=document.getElementById('accountInfo');if(accountInfo)accountInfo.textContent=temp.name+' · Member';
    showLoginMessage('Sign-in successful. Loading your account…',true);
    window.__VCCF_LOGIN_ACTIVE__=false;
    if(btn){btn.disabled=false;btn.textContent='Sign in';}
    setTimeout(()=>window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user}})),0);
    setTimeout(async()=>{
      try{
        const {data:p,error:pe}=await timeout(client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle(),10000);
        if(pe)throw pe;
        if(p){
          let area='';
          if(p.area_id){const {data:a}=await timeout(client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle(),10000);area=a?.name||'';}
          const next={username:email,name:p.display_name||user.email||raw,role:p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member',area,areaId:p.area_id||null,memberId:p.member_id||null,memberCode:null};
          window.profile=p;window.session=next;try{profile=p;session=next}catch{}
          if(nameEl)nameEl.textContent=next.name;
          if(roleEl)roleEl.textContent=next.role+(area?' · '+area:'');
          if(avatar)avatar.textContent=(next.name||'M').charAt(0).toUpperCase();
          if(accountInfo)accountInfo.textContent=next.name+' · '+next.role;
          window.dispatchEvent(new CustomEvent('vccf-profile-ready',{detail:{user,profile:p}}));
        }
      }catch(err){console.warn('VCCF deferred profile load:',err)}
    },0);
  }catch(err){console.error('VCCF login:',err);showLoginMessage(`Sign-in failed: ${err?.message||String(err)}`);}
  finally{window.__VCCF_LOGIN_ACTIVE__=false;if(btn){btn.disabled=false;btn.textContent='Sign in';}}
}
function neutralizeLegacyLogin(){const form=document.getElementById('loginForm');if(form)clearLegacySubmit(form);}
document.addEventListener('submit',handleLogin,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{neutralizeLegacyLogin();installLoginHitSafety()},{once:true});else{neutralizeLegacyLogin();installLoginHitSafety();}
})();