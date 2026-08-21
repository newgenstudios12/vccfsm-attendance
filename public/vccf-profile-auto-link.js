(()=>{
'use strict';
if(window.__VCCF_PROFILE_AUTO_LINK_V2__)return;
window.__VCCF_PROFILE_AUTO_LINK_V2__=true;

// This file used to auto-link a member and force location.reload(), which could
// race the login handler and prevent the freshly authenticated session from
// reaching the dashboard. Keep login ownership in index.html only.
function installStableLogin(){
  const form=document.getElementById('loginForm');
  if(!form||typeof window.supabase?.createClient!=='function')return;
  const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  form.onsubmit=async e=>{
    e.preventDefault();
    const button=form.querySelector('button[type="submit"],button');
    const setError=(message,ok=false)=>{
      let box=document.getElementById('vccfLoginError');
      if(!box){box=document.createElement('div');box.id='vccfLoginError';box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap';form.appendChild(box)}
      box.style.background=ok?'#ecfdf3':'#fff1f1';box.style.color=ok?'#027a48':'#b42318';box.textContent=message;
    };
    try{
      if(button){button.disabled=true;button.textContent='Signing in…'}
      const email=document.getElementById('loginUser')?.value.trim();
      const password=document.getElementById('loginPass')?.value||'';
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error('Authentication succeeded but no user session was returned.');
      setError('Authentication succeeded. Loading Dashboard…',true);

      // Build the minimum session first so a non-critical data query cannot
      // strand the user on the login screen.
      const {data:p,error:pe}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',data.user.id).maybeSingle();
      if(pe)throw new Error(`Profile lookup failed: ${pe.message}`);
      if(!p)throw new Error('Your account is authenticated but has no VCCF profile. An administrator must assign your role.');
      const role=p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member';
      const areas=await client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle();
      const area=areas.data?.name||'';
      window.profile=p;
      window.session={username:p.user_id,name:p.display_name||data.user.email||'Member',role,area,areaId:p.area_id,memberId:p.member_id,memberCode:null};
      session=window.session;
      profile=window.profile;

      document.getElementById('login').style.display='none';
      document.getElementById('app').classList.add('active');
      document.getElementById('currentName').textContent=session.name;
      document.getElementById('currentRole').textContent=session.role+(session.area?' · '+session.area:'');
      document.getElementById('avatar').textContent=(session.name||'M')[0].toUpperCase();
      document.getElementById('accountInfo').textContent=session.name+' · '+session.role;
      if(typeof refresh==='function')refresh();

      // Full dashboard data is non-blocking. If one optional table is denied,
      // the authenticated dashboard remains usable instead of returning to login.
      try{await loadDb();refresh();}catch(loadError){console.warn('VCCF dashboard data load deferred:',loadError)}
      setError('',true);
      const box=document.getElementById('vccfLoginError');if(box)box.remove();
    }catch(err){
      console.error('VCCF stable login:',err);
      setError(err?.message||'Unable to sign in.');
    }finally{
      if(button){button.disabled=false;button.textContent='Sign in'}
    }
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installStableLogin,60),{once:true});
else setTimeout(installStableLogin,60);
})();
