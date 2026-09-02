/* VCCF_LOGIN_GUARD_V2
   Single Base44-style auth boundary.
   Authentication happens first; profile/feature data hydrates afterward.
*/
(()=>{
  'use strict';
  if(window.__VCCF_LOGIN_GUARD_V2__) return;
  window.__VCCF_LOGIN_GUARD_V2__=true;

  const TIMEOUT=12000;
  const race=(promise,ms)=>Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sign-in timed out. Please check your connection and try again.')),ms))
  ]);
  const getClient=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL||'',window.VCCF_SUPABASE_PUBLISHABLE_KEY||'');

  function getErrorBox(form){
    let box=document.getElementById('vccfLoginError');
    if(!box){
      box=document.createElement('div');
      box.id='vccfLoginError';
      box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap;min-height:12px';
      form.appendChild(box);
    }
    return box;
  }

  function busy(form,value){
    const button=form.querySelector('button[type="submit"],button');
    if(button){button.disabled=value;button.textContent=value?'Signing in…':'Sign in';}
  }

  function activate(user,identifier){
    const name=user?.user_metadata?.display_name||user?.user_metadata?.full_name||user?.email||identifier||'Member';
    const role=user?.user_metadata?.role||'Member';
    const next={username:user?.email||identifier,name,role,area:'',areaId:null,memberId:null,memberCode:null};
    try{window.session=next;session=next}catch{}

    const login=document.getElementById('login');
    const app=document.getElementById('app');
    if(login)login.style.display='none';
    if(app)app.classList.add('active');
    const nameEl=document.getElementById('currentName');if(nameEl)nameEl.textContent=name;
    const roleEl=document.getElementById('currentRole');if(roleEl)roleEl.textContent=role;
    const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=name.charAt(0).toUpperCase();
    const account=document.getElementById('accountInfo');if(account)account.textContent=`${name} · ${role}`;
    window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user}}));

    // Never block authentication on profiles, members, attendance, giving, or other modules.
    setTimeout(async()=>{
      try{
        if(typeof window.loadDb==='function')await race(window.loadDb(),10000);
        if(typeof window.refresh==='function')await window.refresh();
      }catch(e){
        console.warn('VCCF post-login hydration:',e);
        if(typeof window.toast==='function')window.toast('Signed in. Some VCCF data is still loading.');
      }
    },0);
  }

  async function signIn(form){
    if(form.dataset.vccfAuthBusy==='1')return;
    form.dataset.vccfAuthBusy='1';
    busy(form,true);
    const box=getErrorBox(form);
    box.textContent='';
    try{
      const identifier=document.getElementById('loginUser')?.value.trim()||'';
      const password=document.getElementById('loginPass')?.value||'';
      if(!identifier)throw new Error('Please enter your email or username.');
      if(!password)throw new Error('Please enter your password.');
      if(!window.VCCF_SUPABASE_URL||!window.VCCF_SUPABASE_PUBLISHABLE_KEY)throw new Error('Authentication configuration is missing.');

      const raw=identifier.toLowerCase();
      const username=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');
      const email=raw.includes('@')?raw:`${username}@vccf.local`;
      if(email==='@vccf.local')throw new Error('Please enter a valid username or email.');

      const client=getClient();
      if(!client)throw new Error('Authentication service is unavailable. Please refresh and try again.');

      const {data,error}=await race(client.auth.signInWithPassword({email,password}),TIMEOUT);
      if(error)throw new Error(error.message||'Unable to sign in.');
      if(!data?.user)throw new Error('Authentication returned no user session.');

      box.style.background='#ecfdf3';
      box.style.color='#027a48';
      box.textContent='Sign-in successful. Loading VCCF…';
      activate(data.user,identifier);
    }catch(e){
      console.error('VCCF login:',e);
      box.style.background='#fff1f1';
      box.style.color='#b42318';
      box.textContent=e?.message||'Unable to sign in.';
    }finally{
      form.dataset.vccfAuthBusy='0';
      busy(form,false);
    }
  }

  // Capture-phase ownership prevents legacy form.onsubmit assignments from taking over.
  document.addEventListener('submit',event=>{
    const form=event.target?.closest?.('#loginForm');
    if(!form)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    signIn(form);
  },true);

  // Restore an existing Supabase session without forcing a login or page reload.
  const restore=()=>{
    const client=getClient();
    if(!client)return;
    client.auth.getSession().then(({data})=>{
      const user=data?.session?.user;
      if(user&&document.getElementById('login'))activate(user,user.email||'');
    }).catch(e=>console.warn('VCCF session restore:',e));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',restore,{once:true});
  else restore();
})();
