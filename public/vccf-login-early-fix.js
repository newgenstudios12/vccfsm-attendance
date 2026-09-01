(()=>{
'use strict';
if(window.__VCCF_LOGIN_EARLY_FIX_V2__)return;
window.__VCCF_LOGIN_EARLY_FIX_V2__=true;
function showError(m){const t=document.getElementById('toast');if(t){t.textContent=m;t.classList.add('show');clearTimeout(window.__vccfLoginToast);window.__vccfLoginToast=setTimeout(()=>t.classList.remove('show'),4000)}}
async function boot(){
 const form=document.getElementById('loginForm');
 if(!form||!window.supabase?.createClient||!window.VCCF_SUPABASE_URL||!window.VCCF_SUPABASE_PUBLISHABLE_KEY)return;
 const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
 if(form.dataset.vccfLoginBound==='1')return;
 form.dataset.vccfLoginBound='1';
 form.onsubmit=async e=>{
   e.preventDefault();e.stopPropagation();
   const btn=form.querySelector('button[type="submit"],button');
   const email=document.getElementById('loginUser')?.value.trim()||'';
   const password=document.getElementById('loginPass')?.value||'';
   if(!email||!password){showError('Please enter your email and password.');return}
   if(btn){btn.disabled=true;btn.textContent='Signing in…'}
   try{
     const {data,error}=await client.auth.signInWithPassword({email,password});
     if(error)throw error;
     const user=data?.user;
     if(!user)throw new Error('Authentication succeeded but no user session was returned.');

     // Open the established app immediately after Supabase authentication succeeds.
     let p=null,area='';
     const activate=(profile)=>{
       p=profile||p;
       const next={
         username:user.id,
         name:p?.display_name||user.email||'Member',
         role:p?.role==='admin'?'Admin':p?.role==='area_leader'?'Area Leader':'Member',
         area,areaId:p?.area_id||null,memberId:p?.member_id||null,memberCode:null
       };
       window.profile=p;window.session=next;
       try{if(typeof profile!=='undefined')window.profile=p;if(typeof session!=='undefined')window.session=next}catch{}
       const login=document.getElementById('login'),app=document.getElementById('app');
       if(login)login.style.display='none';
       if(app)app.classList.add('active');
       const n=document.getElementById('currentName');if(n)n.textContent=next.name;
       const r=document.getElementById('currentRole');if(r)r.textContent=next.role+(area?' · '+area:'');
       const av=document.getElementById('avatar');if(av)av.textContent=(next.name||'M')[0].toUpperCase();
       const ai=document.getElementById('accountInfo');if(ai)ai.textContent=next.name+' · '+next.role;
       window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user,profile:p}}));
     };
     activate(null);

     // Profile/area lookup is deferred so a slow RLS/data query can never make login look frozen.
     Promise.race([
       client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle(),
       new Promise(resolve=>setTimeout(()=>resolve({data:null,error:{message:'Profile lookup timed out'}}),6000))
     ]).then(async result=>{
       if(!result||!result.data)return;
       p=result.data;
       if(p?.area_id){const a=await Promise.race([client.from('areas').select('id,name').eq('id',p.area_id).maybeSingle(),new Promise(resolve=>setTimeout(()=>resolve({data:null}),4000))]);area=a?.data?.name||''}
       activate(p);
       try{if(typeof window.refresh==='function')window.refresh()}catch{}
     }).catch(err=>console.warn('VCCF deferred profile lookup:',err));

     // Data loading is explicitly post-login and non-blocking.
     Promise.resolve().then(async()=>{try{if(typeof window.loadDb==='function'){await window.loadDb();if(typeof window.refresh==='function')window.refresh()}}catch(err){console.warn('VCCF deferred data load:',err)}});
   }catch(err){console.error('VCCF login:',err);showError(err?.message||'Unable to sign in.')}finally{if(btn){btn.disabled=false;btn.textContent='Sign in'}}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
