/* VCCF_LOGIN_GUARD_V14
   Single authentication owner. Uses the browser-wide Supabase singleton and
   the verified project legacy anon key for maximum Auth compatibility.
*/
(()=>{
'use strict';
if(window.__VCCF_LOGIN_GUARD_V14__) return;
window.__VCCF_LOGIN_GUARD_V14__=true;
const SUPABASE_URL='https://hvnlstaecjqhjtiojutd.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bmxzdGFlY2pxaGp0aW9qdXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTI1MjQsImV4cCI6MjEwMjYyODUyNH0.2lbYY8dRJEHI-xYsKPG-_8Oe1ByYw_CcPTYmIA9zuF0';
const TIMEOUT=15000;
window.VCCF_SUPABASE_URL=SUPABASE_URL;
window.VCCF_SUPABASE_PUBLISHABLE_KEY=SUPABASE_KEY;
function getClient(){
  const client=window.__VCCF_SHARED_SUPABASE_CLIENT__;
  if(client?.auth) return client;
  const g=window.supabase;
  if(g?.createClient) return g.createClient(SUPABASE_URL,SUPABASE_KEY);
  throw new Error('Supabase client is not available.');
}
function box(form){let b=document.getElementById('vccfLoginError');if(!b){b=document.createElement('div');b.id='vccfLoginError';b.setAttribute('role','status');b.setAttribute('aria-live','polite');b.style.cssText='margin-top:14px;padding:12px;border-radius:10px;font-size:.85rem;white-space:pre-wrap';form.appendChild(b)}return b}
function busy(form,on){const b=form?.querySelector('button[type="submit"],button');if(b){b.disabled=on;b.textContent=on?'Signing in…':'Sign in'}}
function showApp(user,session){const meta=user?.user_metadata||{};const name=meta.display_name||meta.full_name||user?.email||'Member';const role=meta.role||'Member';window.session={username:user?.email||'',name,role,area:'',areaId:null,memberId:null,memberCode:null};const login=document.getElementById('login'),app=document.getElementById('app');if(login){login.classList.add('hidden');login.style.display='none';login.setAttribute('aria-hidden','true')}if(app){app.classList.add('active');app.style.display='flex';app.removeAttribute('aria-hidden')}const n=document.getElementById('currentName');if(n)n.textContent=name;const r=document.getElementById('currentRole');if(r)r.textContent=role;const a=document.getElementById('avatar');if(a)a.textContent=name.charAt(0).toUpperCase();const ai=document.getElementById('accountInfo');if(ai)ai.textContent=name+' · '+role;setTimeout(()=>{try{window.dispatchEvent(new CustomEvent('vccf-authenticated',{detail:{user,session}}))}catch(e){console.warn('VCCF post-login event:',e)}},0)}
async function authenticate(form){if(!form||form.dataset.vccfBusy==='1')return;form.dataset.vccfBusy='1';busy(form,true);const b=box(form);b.textContent='';b.style.background='#fff1f1';b.style.color='#b42318';try{const id=document.getElementById('loginUser')?.value?.trim()||'';const password=document.getElementById('loginPass')?.value||'';if(!id)throw new Error('Please enter your email or username.');if(!password)throw new Error('Please enter your password.');if(!id.includes('@'))throw new Error('Please sign in using the email address assigned to your VCCF account.');const client=getClient();const result=await Promise.race([client.auth.signInWithPassword({email:id.toLowerCase(),password}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sign-in timed out. Please try again.')),TIMEOUT))]);const {data,error}=result||{};if(error)throw error;if(!data?.session||!data?.user)throw new Error('Sign-in did not create a valid session.');const current=await client.auth.getSession();if(!current?.data?.session)throw new Error('Authentication succeeded but the session could not be established.');b.style.background='#ecfdf3';b.style.color='#027a48';b.textContent='Sign-in successful.';showApp(data.user,current.data.session)}catch(e){console.error('VCCF authentication:',e);b.textContent=String(e?.message||e||'Unable to sign in.');try{await getClient().auth.signOut()}catch(_e){}}finally{form.dataset.vccfBusy='0';busy(form,false)}}
document.addEventListener('submit',(event)=>{const form=event.target?.closest?.('#loginForm');if(!form)return;event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();authenticate(form)},true);
async function restore(){try{const client=getClient();const {data,error}=await client.auth.getSession();if(error||!data?.session?.user)return;showApp(data.session.user,data.session)}catch(e){console.warn('VCCF session restore:',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(restore,0),{once:true});else setTimeout(restore,0);
})();
