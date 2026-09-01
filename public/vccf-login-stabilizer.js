(()=>{
'use strict';
if(window.__VCCF_LOGIN_STABILIZER_V2__)return;
window.__VCCF_LOGIN_STABILIZER_V2__=true;
const $=id=>document.getElementById(id);
const withTimeout=async(p,ms,label)=>{
  let timer;
  try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label||'Request timed out. Please try again.')),ms)})]);}
  finally{clearTimeout(timer)}
};
function normalizeIdentifier(raw){const s=String(raw||'').trim();if(!s)return '';return s.includes('@')?s.toLowerCase():`${s.toLowerCase().replace(/[^a-z0-9._-]/g,'')}@vccf.local`}
function activate(profileRow,identifier){
  const roleLabel=profileRow.role==='admin'?'Admin':profileRow.role==='area_leader'?'Area Leader':'Member';
  window.session={username:identifier,name:profileRow.display_name||identifier,role:roleLabel,area:'',areaId:profileRow.area_id,memberId:profileRow.member_id,memberCode:null};
  window.profile=profileRow;
  const login=$('login'),app=$('app');
  if(login){login.style.display='none';login.setAttribute('aria-hidden','true')}
  if(app){app.classList.add('active');app.removeAttribute('aria-hidden')}
  const name=$('currentName'),role=$('currentRole'),avatar=$('avatar'),info=$('accountInfo');
  if(name)name.textContent=window.session.name;
  if(role)role.textContent=window.session.role;
  if(avatar)avatar.textContent=(window.session.name||'V').slice(0,1).toUpperCase();
  if(info)info.textContent=`${window.session.name} · ${window.session.role}`;
  window.dispatchEvent(new CustomEvent('vccf-authenticated'));
}
function install(){
  const form=$('loginForm');
  if(!form||form.dataset.vccfStableLogin==='1')return;
  form.dataset.vccfStableLogin='1';
  form.onsubmit=async e=>{
    e.preventDefault();
    e.stopPropagation();
    const identifier=String($('loginUser')?.value||'').trim();
    const password=String($('loginPass')?.value||'');
    const button=form.querySelector('button[type="submit"],button');
    let box=$('vccfLoginError');
    if(!box){box=document.createElement('div');box.id='vccfLoginError';box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap';form.appendChild(box)}
    box.textContent='';box.style.background='transparent';box.style.color='var(--text)';
    if(button){button.disabled=true;button.textContent='Signing in…'}
    try{
      if(!identifier)throw new Error('Please enter your username or email.');
      if(!password)throw new Error('Please enter your password.');
      if(!window.supabase?.createClient)throw new Error('Authentication service is unavailable. Please refresh and try again.');
      if(!window.VCCF_SUPABASE_URL||!window.VCCF_SUPABASE_PUBLISHABLE_KEY)throw new Error('Supabase configuration is missing.');
      const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      const auth=await withTimeout(client.auth.signInWithPassword({email:normalizeIdentifier(identifier),password}),12000,'Sign-in request timed out. Please check your connection and try again.');
      if(auth.error)throw new Error(auth.error.message);
      const user=auth.data?.user;if(!user)throw new Error('Authentication returned no user.');
      const profileResult=await withTimeout(client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle(),8000,'Your account signed in, but the VCCF profile lookup timed out. Please try again.');
      if(profileResult.error)throw new Error(`Profile lookup failed: ${profileResult.error.message}`);
      if(!profileResult.data)throw new Error('Authentication succeeded, but this account has no VCCF profile.');
      activate(profileResult.data,identifier);
      box.style.background='#ecfdf3';box.style.color='#027a48';box.textContent='Sign-in successful.';
      if(button){button.disabled=false;button.textContent='Sign in'}
      setTimeout(()=>{
        if(typeof window.loadDb==='function'){
          withTimeout(Promise.resolve().then(()=>window.loadDb()),15000,'Dashboard data is taking longer than expected.')
            .then(()=>{if(typeof window.refresh==='function')window.refresh()})
            .catch(err=>console.warn('Post-login dashboard load:',err));
        }
      },0);
      setTimeout(()=>{try{window.scrollTo({top:0,behavior:'smooth'})}catch{}},50);
    }catch(err){
      console.error('VCCF stable login:',err);box.style.background='#fff1f1';box.style.color='#b42318';box.textContent=`Sign-in failed: ${err?.message||String(err)}`;
      if(button){button.disabled=false;button.textContent='Sign in'}
    }
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
window.addEventListener('load',install);
})();
