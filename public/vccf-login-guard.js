/* VCCF_LOGIN_GUARD_V15
   Single authentication owner for the restored full-feature app.
   Uses one Supabase JS client with a fresh storage key to avoid stale auth-lock/session deadlocks.
*/
(()=>{
'use strict';
if(window.__VCCF_LOGIN_GUARD_V15__) return;
window.__VCCF_LOGIN_GUARD_V15__=true;

const SUPABASE_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const SUPABASE_KEY='sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';
const AUTH_STORAGE_KEY='vccf-auth-v15';
const AUTH_TIMEOUT=12000;
const DATA_TIMEOUT=12000;

window.VCCF_SUPABASE_URL=SUPABASE_URL;
window.VCCF_SUPABASE_PUBLISHABLE_KEY=SUPABASE_KEY;

function timeout(ms,message){
  return new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms));
}

function ensureClient(){
  if(window.__VCCF_SHARED_SUPABASE_CLIENT__?.auth) return window.__VCCF_SHARED_SUPABASE_CLIENT__;
  const g=window.supabase;
  if(!g?.createClient) throw new Error('Supabase client is not available.');
  const factory=window.__VCCF_SUPABASE_CLIENT_FACTORY__ || g.createClient;
  const client=factory(SUPABASE_URL,SUPABASE_KEY,{
    auth:{
      storageKey:AUTH_STORAGE_KEY,
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false
    }
  });
  window.__VCCF_SHARED_SUPABASE_CLIENT__=client;
  if(!window.__VCCF_SUPABASE_CLIENT_FACTORY__) window.__VCCF_SUPABASE_CLIENT_FACTORY__=factory;
  g.createClient=function(){ return window.__VCCF_SHARED_SUPABASE_CLIENT__; };
  return client;
}

try{
  ensureClient();
}catch(e){
  console.error('VCCF Supabase initialization:',e);
}

function box(form){
  let b=document.getElementById('vccfLoginError');
  if(!b){
    b=document.createElement('div');
    b.id='vccfLoginError';
    b.setAttribute('role','status');
    b.setAttribute('aria-live','polite');
    b.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap';
    form.appendChild(b);
  }
  return b;
}

function busy(form,on,label='Sign in'){
  const b=form?.querySelector('button[type="submit"],button');
  if(!b) return;
  b.disabled=on;
  b.textContent=on?label:'Sign in';
}

function toEmail(value){
  const raw=String(value||'').trim().toLowerCase();
  if(raw.includes('@')) return raw;
  const clean=raw.replace(/[^a-z0-9._-]/g,'').replace(/^[-_.]+|[-_.]+$/g,'');
  return clean?clean+'@vccf.local':'';
}

async function loadFullApp(client,user){
  busy(document.getElementById('loginForm'),true,'Loading app…');

  if(typeof window.loadDb==='function'){
    await Promise.race([
      window.loadDb(),
      timeout(DATA_TIMEOUT,'Signed in, but VCCF data took too long to load.')
    ]);
  }

  const login=document.getElementById('login');
  const app=document.getElementById('app');
  if(login){
    login.classList.add('hidden');
    login.style.display='none';
    login.setAttribute('aria-hidden','true');
  }
  if(app){
    app.classList.add('active');
    app.style.display='flex';
    app.removeAttribute('aria-hidden');
  }

  try{
    if(typeof window.refresh==='function') window.refresh();
  }catch(e){
    console.warn('VCCF refresh after login:',e);
  }

  try{
    const {data:profileData}=await client
      .from('profiles')
      .select('display_name,role,area_id')
      .eq('user_id',user.id)
      .maybeSingle();
    const name=profileData?.display_name||user.user_metadata?.display_name||user.email||'Member';
    const role=profileData?.role==='admin'?'Admin':profileData?.role==='area_leader'?'Area Leader':'Member';
    const n=document.getElementById('currentName'); if(n)n.textContent=name;
    const r=document.getElementById('currentRole'); if(r)r.textContent=role;
    const a=document.getElementById('avatar'); if(a)a.textContent=name.charAt(0).toUpperCase();
    const ai=document.getElementById('accountInfo'); if(ai)ai.textContent=name+' · '+role;
  }catch(e){
    console.warn('VCCF profile label update:',e);
  }

  try{
    window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user}}));
    window.dispatchEvent(new CustomEvent('vccf-app-ready',{detail:{user}}));
  }catch(e){
    console.warn('VCCF post-login event:',e);
  }
}

async function authenticate(form){
  if(!form||form.dataset.vccfBusy==='1') return;
  form.dataset.vccfBusy='1';
  const b=box(form);
  b.textContent='';
  b.style.background='#fff1f1';
  b.style.color='#b42318';
  busy(form,true,'Signing in…');

  try{
    const id=document.getElementById('loginUser')?.value||'';
    const password=document.getElementById('loginPass')?.value||'';
    if(!String(id).trim()) throw new Error('Please enter your email or username.');
    if(!password) throw new Error('Please enter your password.');

    const email=toEmail(id);
    if(!email) throw new Error('Please enter a valid email or username.');

    const client=ensureClient();
    const {data,error}=await Promise.race([
      client.auth.signInWithPassword({email,password}),
      timeout(AUTH_TIMEOUT,'Sign-in timed out. Please try again.')
    ]);

    if(error) throw error;
    if(!data?.session||!data?.user) throw new Error('Sign-in did not create a valid session.');

    b.style.background='#ecfdf3';
    b.style.color='#027a48';
    b.textContent='Sign-in successful. Loading VCCF…';

    await loadFullApp(client,data.user);
    b.textContent='';
  }catch(e){
    console.error('VCCF authentication:',e);
    b.textContent=String(e?.message||e||'Unable to sign in.');
    try{
      const client=window.__VCCF_SHARED_SUPABASE_CLIENT__;
      if(client?.auth) await Promise.race([client.auth.signOut({scope:'local'}),timeout(3000,'')]);
    }catch(_e){}
  }finally{
    form.dataset.vccfBusy='0';
    busy(form,false);
  }
}

document.addEventListener('submit',(event)=>{
  const form=event.target?.closest?.('#loginForm');
  if(!form) return;
  event.preventDefault();
  event.stopPropagation();
  if(event.stopImmediatePropagation) event.stopImmediatePropagation();
  authenticate(form);
},true);

async function restore(){
  try{
    const client=ensureClient();
    const {data,error}=await Promise.race([
      client.auth.getSession(),
      timeout(6000,'Session restore timed out.')
    ]);
    if(error||!data?.session?.user) return;
    await loadFullApp(client,data.session.user);
  }catch(e){
    console.warn('VCCF session restore:',e);
    try{ localStorage.removeItem(AUTH_STORAGE_KEY); }catch(_e){}
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(restore,0),{once:true});
}else{
  setTimeout(restore,0);
}
})();
