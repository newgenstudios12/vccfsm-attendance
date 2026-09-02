/* VCCF_AUTH_CORE_V1
   Base44-style auth boundary: one submit owner, auth first, app state second.
   No profile/table query is allowed to block authentication.
*/
(()=>{
  'use strict';
  if(window.__VCCF_AUTH_CORE_V1__) return;
  window.__VCCF_AUTH_CORE_V1__=true;

  const TIMEOUT=12000;
  const race=(promise,ms)=>Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sign-in timed out. Please check your connection and try again.')),ms))
  ]);

  const client=()=>window.supabase?.createClient?.(
    window.VCCF_SUPABASE_URL||'',
    window.VCCF_SUPABASE_PUBLISHABLE_KEY||''
  );

  function errorBox(form){
    let box=document.getElementById('vccfLoginError');
    if(!box){
      box=document.createElement('div');
      box.id='vccfLoginError';
      box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap;min-height:12px';
      form.appendChild(box);
    }
    return box;
  }

  function setBusy(form,busy){
    const button=form.querySelector('button[type="submit"],button');
    if(button){
      button.disabled=busy;
      button.textContent=busy?'Signing in…':'Sign in';
    }
  }

  function activate(user,identifier){
    const name=user?.user_metadata?.display_name||user?.user_metadata?.full_name||user?.email||identifier||'Member';
    const role=(user?.user_metadata?.role||'Member');
    const next={username:user?.email||identifier,name,role,area:'',areaId:null,memberId:null,memberCode:null};
    try{ window.session=next; session=next; }catch{}

    const login=document.getElementById('login');
    const app=document.getElementById('app');
    if(login) login.style.display='none';
    if(app) app.classList.add('active');
    const nameEl=document.getElementById('currentName'); if(nameEl) nameEl.textContent=name;
    const roleEl=document.getElementById('currentRole'); if(roleEl) roleEl.textContent=role;
    const avatar=document.getElementById('avatar'); if(avatar) avatar.textContent=name.charAt(0).toUpperCase();
    const account=document.getElementById('accountInfo'); if(account) account.textContent=`${name} · ${role}`;
    window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user}}));

    // Data hydration is deliberately post-auth and non-blocking.
    setTimeout(async()=>{
      try{
        if(typeof window.loadDb==='function') await race(window.loadDb(),10000);
        if(typeof window.refresh==='function') await window.refresh();
      }catch(e){
        console.warn('VCCF post-login hydration:',e);
        const toast=window.toast;
        if(typeof toast==='function') toast('Signed in. Some VCCF data is still loading.');
      }
    },0);
  }

  async function signIn(form){
    if(form.dataset.vccfAuthBusy==='1') return;
    form.dataset.vccfAuthBusy='1';
    setBusy(form,true);
    const box=errorBox(form);
    box.textContent='';
    box.style.background='#fff1f1';
    box.style.color='#b42318';

    try{
      const identifier=document.getElementById('loginUser')?.value.trim()||'';
      const password=document.getElementById('loginPass')?.value||'';
      if(!identifier) throw new Error('Please enter your email or username.');
      if(!password) throw new Error('Please enter your password.');
      if(!window.VCCF_SUPABASE_URL||!window.VCCF_SUPABASE_PUBLISHABLE_KEY) throw new Error('Authentication configuration is missing.');

      const raw=identifier.toLowerCase();
      const email=raw.includes('@')?raw:`${raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'')}@vccf.local`;
      if(email==='@vccf.local') throw new Error('Please enter a valid username or email.');

      const supabase=client();
      if(!supabase) throw new Error('Authentication service is unavailable. Please refresh and try again.');

      const {data,error}=await race(supabase.auth.signInWithPassword({email,password}),TIMEOUT);
      if(error) throw new Error(error.message||'Unable to sign in.');
      if(!data?.user) throw new Error('Authentication returned no user session.');

      // Auth succeeded. Do not query profiles or any feature tables here.
      box.style.background='#ecfdf3';
      box.style.color='#027a48';
      box.textContent='Sign-in successful. Loading VCCF…';
      activate(data.user,identifier);
    }catch(e){
      console.error('VCCF auth:',e);
      box.textContent=e?.message||'Unable to sign in.';
    }finally{
      form.dataset.vccfAuthBusy='0';
      setBusy(form,false);
    }
  }

  function install(){
    // Capture phase makes this boundary independent of form.onsubmit assignments
    // from legacy compatibility scripts. Only the login form is intercepted.
    document.addEventListener('submit',event=>{
      const form=event.target?.closest?.('#loginForm');
      if(!form) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      signIn(form);
    },true);
  }

  function restoreExistingSession(){
    const supabase=client();
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>{
      const user=data?.session?.user;
      if(user && document.getElementById('login')) activate(user,user.email||'');
    }).catch(e=>console.warn('VCCF session restore:',e));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{install();restoreExistingSession()},{once:true});
  else {install();restoreExistingSession();}
})();
