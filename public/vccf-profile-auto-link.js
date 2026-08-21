(()=>{
'use strict';
if(window.__VCCF_STABLE_LOGIN_V1__)return;
window.__VCCF_STABLE_LOGIN_V1__=true;
function install(){
 const form=document.getElementById('loginForm');
 const client=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
 if(!form||!client)return;
 form.onsubmit=async e=>{
  e.preventDefault();
  const btn=form.querySelector('button[type="submit"],button');
  const email=document.getElementById('loginUser')?.value.trim();
  const password=document.getElementById('loginPass')?.value||'';
  const setBusy=(busy)=>{if(btn){btn.disabled=busy;btn.textContent=busy?'Signing in…':'Sign in'}};
  try{
   setBusy(true);
   const {data,error}=await client.auth.signInWithPassword({email,password});
   if(error)throw error;
   if(!data?.user)throw new Error('Sign-in succeeded but no user session was returned.');
   const {data:p,error:pe}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',data.user.id).maybeSingle();
   if(pe)throw new Error(`Profile lookup failed: ${pe.message}`);
   if(!p)throw new Error('Your account is signed in but has no VCCF profile. Please ask an administrator to assign your account.');
   const {data:a}=await client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle();
   profile=p;
   session={username:p.user_id,name:p.display_name||data.user.email||'Member',role:p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member',area:a?.name||'',areaId:p.area_id,memberId:p.member_id,memberCode:null};
   window.profile=profile;window.session=session;
   document.getElementById('login').style.display='none';
   document.getElementById('app').classList.add('active');
   document.getElementById('currentName').textContent=session.name;
   document.getElementById('currentRole').textContent=session.role+(session.area?' · '+session.area:'');
   document.getElementById('avatar').textContent=(session.name||'M')[0].toUpperCase();
   document.getElementById('accountInfo').textContent=session.name+' · '+session.role;
   if(typeof refresh==='function')refresh();
   // Dashboard opens immediately. Full data loading is deliberately non-blocking.
   Promise.resolve(typeof loadDb==='function'?loadDb():null).then(()=>{if(typeof refresh==='function')refresh()}).catch(err=>console.warn('VCCF background data load deferred:',err));
  }catch(err){
   console.error('VCCF stable login:',err);
   if(typeof toast==='function')toast(err?.message||'Unable to sign in.');
  }finally{setBusy(false)}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,80),{once:true});else setTimeout(install,80);
})();
