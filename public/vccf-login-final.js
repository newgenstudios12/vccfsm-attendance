(()=>{
'use strict';
if(window.__VCCF_LOGIN_OWNER_V3__)return;
window.__VCCF_LOGIN_OWNER_V3__=true;
const $=id=>document.getElementById(id);
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
function toast(message,ok=false){const t=$('toast');if(!t)return;t.textContent=message;t.style.background=ok?'#027a48':'#b42318';t.classList.add('show');clearTimeout(window.__vccfLoginToast);window.__vccfLoginToast=setTimeout(()=>t.classList.remove('show'),3500)}
async function loadProfile(c,user){
  const {data,error}=await c.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Your account is authenticated but has no VCCF profile.');
  return data;
}
async function activate(user,p){
  const c=client();
  let area='';
  if(p.area_id){
    const {data,error}=await c.from('areas').select('id,name').eq('id',p.area_id).maybeSingle();
    if(error)throw error;
    area=data?.name||'';
  }
  const next={username:p.user_id,name:p.display_name||user.email||'Member',role:p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member',area,areaId:p.area_id,memberId:p.member_id,memberCode:null};
  window.vccfCurrentProfile=p;
  window.vccfSession=next;
  try{if(typeof profile!=='undefined' && typeof profile!=='function')profile=p}catch{}
  try{if(typeof session!=='undefined')session=next}catch{}
  window.profileData=p;
  window.sessionData=next;
  const login=$('login'),app=$('app');
  if(login)login.style.display='none';
  if(app){app.classList.add('active');app.style.display='flex';}
  const n=$('currentName');if(n)n.textContent=next.name;
  const r=$('currentRole');if(r)r.textContent=next.role+(area?' · '+area:'');
  const av=$('avatar');if(av)av.textContent=(next.name||'M')[0].toUpperCase();
  const ai=$('accountInfo');if(ai)ai.textContent=next.name+' · '+next.role;
  window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user,profile:p,session:next}}));
  requestAnimationFrame(()=>{
    try{if(typeof window.refresh==='function')window.refresh()}catch(e){console.warn('VCCF refresh deferred:',e)}
    setTimeout(async()=>{try{if(typeof window.loadDb==='function'){await window.loadDb();if(typeof window.refresh==='function')window.refresh()}}catch(e){console.warn('Dashboard data deferred:',e)}},0);
  });
}
function install(){
  const form=$('loginForm');if(!form||!window.supabase?.createClient)return false;
  form.onsubmit=async e=>{
    e.preventDefault();e.stopPropagation();
    const button=form.querySelector('button[type="submit"],button');
    try{
      if(button){button.disabled=true;button.textContent='Signing in…';}
      const email=$('loginUser')?.value.trim(),password=$('loginPass')?.value||'';
      if(!email||!password)throw new Error('Please enter your email and password.');
      const c=client();if(!c)throw new Error('Authentication service is unavailable.');
      const {data,error}=await c.auth.signInWithPassword({email,password});
      if(error)throw error;
      const user=data?.user;if(!user)throw new Error('Authentication succeeded but no user session was returned.');
      const p=await loadProfile(c,user);
      await activate(user,p);
      toast('Signed in successfully.',true);
    }catch(err){
      console.error('VCCF login:',err);
      toast(err?.message||'Unable to sign in.');
    }finally{if(button){button.disabled=false;button.textContent='Sign in';}}
    return false;
  };
  form.dataset.vccfLoginOwner='v3';
  return true;
}
function boot(){
  // vccf-config.js installs a legacy diagnostic handler on DOMContentLoaded.
  // Install one timer later so this module is the final owner of the form.
  setTimeout(()=>install(),0);
  setTimeout(()=>{if(!$('loginForm')?.dataset.vccfLoginOwner)install()},150);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
