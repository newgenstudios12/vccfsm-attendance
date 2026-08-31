(()=>{
'use strict';
if(window.__VCCF_DASHBOARD_LOADER_V23__)return;
window.__VCCF_DASHBOARD_LOADER_V23__=true;
const stamp='202609011745';

function usernameEmail(value){const raw=String(value||'').trim().toLowerCase();if(!raw)return '';if(raw.includes('@'))return raw;const u=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');return u?`${u}@vccf.local`:'';}
function showLoginMessage(text,ok=false){
  const form=document.getElementById('loginForm');
  if(!form)return;
  let box=document.getElementById('vccfLoginError');
  if(!box){
    box=document.createElement('div');
    box.id='vccfLoginError';
    box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap;line-height:1.45';
    form.appendChild(box);
  }
  box.style.background=ok?'#ecfdf3':'#fff1f1';
  box.style.color=ok?'#027a48':'#b42318';
  box.textContent=text;
}

// The legacy app shell and older enhancement modules assign form.onsubmit themselves.
// Keep the capture-phase handler below as the only authentication owner and clear those
// property handlers after DOMContentLoaded has finished running all older installers.
function neutralizeLegacyLoginHandlers(){
  const form=document.getElementById('loginForm');
  if(!form)return;
  form.onsubmit=null;
  form.dataset.vccfLoginOwner='capture-v23';
  if(!form.querySelector('#vccfLoginError')){
    const box=document.createElement('div');
    box.id='vccfLoginError';
    box.setAttribute('role','status');
    box.setAttribute('aria-live','polite');
    box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap;line-height:1.45;display:none';
    form.appendChild(box);
  }
}

if(!window.__VCCF_LOGIN_CAPTURE_V3__){
  window.__VCCF_LOGIN_CAPTURE_V3__=true;
  document.addEventListener('submit',async event=>{
    const form=event.target?.closest?.('#loginForm');
    if(!form||window.__VCCF_LOGIN_ACTIVE__)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
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
      const auth=await client.auth.signInWithPassword({email,password});
      if(auth.error)throw new Error(auth.error.message||'Invalid username/email or password.');
      const user=auth.data?.user;
      if(!user)throw new Error('Authentication succeeded but no session was returned.');

      const login=document.getElementById('login');
      const app=document.getElementById('app');
      if(login){login.classList.add('hidden');login.style.display='none';login.setAttribute('aria-hidden','true');}
      if(app){app.classList.add('active');app.style.display='flex';app.removeAttribute('aria-hidden');}
      window.session={username:email,name:user.user_metadata?.display_name||user.email||raw,role:'Member',area:'',areaId:null,memberId:null,memberCode:null};
      try{session=window.session}catch{}
      const nameEl=document.getElementById('currentName');if(nameEl)nameEl.textContent=window.session.name;
      const roleEl=document.getElementById('currentRole');if(roleEl)roleEl.textContent='Member';
      const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=(window.session.name||'M').charAt(0).toUpperCase();
      const accountInfo=document.getElementById('accountInfo');if(accountInfo)accountInfo.textContent=window.session.name+' · Member';
      showLoginMessage('Sign-in successful. Loading your account…',true);
      const loginBox=document.getElementById('vccfLoginError');if(loginBox)loginBox.style.display='block';
      window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user}}));

      // Profile, role, area, and dashboard data are loaded only after the UI transition.
      Promise.resolve().then(async()=>{
        try{
          const {data:p,error:pe}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle();
          if(pe)throw pe;
          if(p){
            let area='';
            if(p.area_id){const {data:a}=await client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle();area=a?.name||'';}
            const next={username:email,name:p.display_name||user.email||raw,role:p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member',area,areaId:p.area_id||null,memberId:p.member_id||null,memberCode:null};
            window.profile=p;window.session=next;try{profile=p;session=next}catch{}
            if(nameEl)nameEl.textContent=next.name;
            if(roleEl)roleEl.textContent=next.role+(area?' · '+area:'');
            if(avatar)avatar.textContent=next.name.charAt(0).toUpperCase();
            if(accountInfo)accountInfo.textContent=next.name+' · '+next.role;
            window.dispatchEvent(new CustomEvent('vccf-profile-ready',{detail:{user,profile:p}}));
          }
          if(typeof window.loadDb==='function'){await window.loadDb();if(typeof window.refresh==='function')window.refresh();}
        }catch(err){console.warn('VCCF deferred profile/dashboard load:',err);}
      });
    }catch(err){
      console.error('VCCF login:',err);
      showLoginMessage(`Sign-in failed: ${err?.message||String(err)}`);
      const box=document.getElementById('vccfLoginError');if(box)box.style.display='block';
    }finally{
      window.__VCCF_LOGIN_ACTIVE__=false;
      if(btn){btn.disabled=false;btn.textContent='Sign in';}
    }
  },true);
}

function load(src){if(document.querySelector(`script[src^="${src}"]`))return;const s=document.createElement('script');s.src=`${src}?v=${stamp}`;s.async=true;(document.head||document.documentElement).appendChild(s)}
function css(href){if(document.querySelector(`link[href^="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${href}?v=${stamp}`;document.head.appendChild(l)}
function loadPostAuthModules(){if(window.__VCCF_POST_AUTH_MODULES_LOADED__)return;window.__VCCF_POST_AUTH_MODULES_LOADED__=true;css('/vccf-device-responsive.css');css('/vccf-mobile-hardening.css');load('/vccf-dashboard-features-v3.js');load('/vccf-members-clean-v1.js');load('/vccf-member-category-v1.js');load('/vccf-install-app.js');load('/vccf-dark-mode-fix.js');load('/vccf-special-events.js');load('/vccf-special-event-checkin.js')}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(neutralizeLegacyLoginHandlers,0),{once:true});
else setTimeout(neutralizeLegacyLoginHandlers,0);
window.addEventListener('vccf-authenticated',()=>setTimeout(loadPostAuthModules,0),{once:true});
})();