(()=>{
'use strict';
if(window.__VCCF_FINAL_LOGIN_V1__)return;
window.__VCCF_FINAL_LOGIN_V1__=true;
const boot=()=>setTimeout(()=>{
  const form=document.getElementById('loginForm');
  if(!form||!window.supabase?.createClient)return;
  const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  const show=(msg,ok=false)=>{
    let box=document.getElementById('vccfLoginError');
    if(!box){box=document.createElement('div');box.id='vccfLoginError';box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap';form.appendChild(box)}
    box.style.background=ok?'#ecfdf3':'#fff1f1';box.style.color=ok?'#027a48':'#b42318';box.textContent=msg;
  };
  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const button=form.querySelector('button[type="submit"],button');
    try{
      if(button){button.disabled=true;button.textContent='Signing in…'}
      const email=document.getElementById('loginUser')?.value.trim();
      const password=document.getElementById('loginPass')?.value||'';
      if(!email||!password)throw new Error('Please enter your email and password.');
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.user)throw new Error('Authentication succeeded but no user session was returned.');
      const {data:p,error:pe}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',data.user.id).maybeSingle();
      if(pe)throw pe;
      if(!p)throw new Error('Your account is authenticated but has no VCCF profile. Please contact an administrator.');
      const role=p.role==='admin'?'Admin':p.role==='area_leader'?'Area Leader':'Member';
      let area='';
      if(p.area_id){const a=await client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle();area=a.data?.name||''}
      window.profile=p;
      window.session={username:p.user_id,name:p.display_name||data.user.email||'Member',role,area,areaId:p.area_id,memberId:p.member_id,memberCode:null};
      window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user:data.user,profile:p}}));
      const login=document.getElementById('login');const app=document.getElementById('app');
      if(login)login.style.display='none';
      if(app)app.classList.add('active');
      const name=document.getElementById('currentName');if(name)name.textContent=window.session.name;
      const roleEl=document.getElementById('currentRole');if(roleEl)roleEl.textContent=window.session.role+(area?' · '+area:'');
      const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=(window.session.name||'M')[0].toUpperCase();
      const account=document.getElementById('accountInfo');if(account)account.textContent=window.session.name+' · '+window.session.role;
      show('Signed in. Loading Dashboard…',true);
      if(typeof window.refresh==='function')window.refresh();
      if(typeof window.loadDb==='function')window.loadDb().then(()=>{if(typeof window.refresh==='function')window.refresh()}).catch(err=>console.warn('Dashboard data deferred:',err));
      setTimeout(()=>document.getElementById('vccfLoginError')?.remove(),1200);
    }catch(err){console.error('VCCF final login:',err);show(err?.message||'Unable to sign in.')}finally{if(button){button.disabled=false;button.textContent='Sign in'}}
  },true);
},250);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
// VCCF production deployment trigger
