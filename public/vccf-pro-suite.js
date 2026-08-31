(()=>{
'use strict';
if(window.__VCCF_PRO_SUITE_V4__)return;
window.__VCCF_PRO_SUITE_V4__=true;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const toast=m=>{const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(window.__vccfProToast);window.__vccfProToast=setTimeout(()=>t.classList.remove('show'),2600)};
const css=`.vccf-online{position:fixed;right:14px;top:14px;z-index:150;padding:8px 11px;border-radius:999px;border:1px solid rgba(25,135,84,.18);background:#ecfdf3;color:#027a48;font-size:.72rem;font-weight:800;box-shadow:0 8px 22px rgba(16,24,40,.09)}.vccf-online.offline{border-color:#f3d2d2;background:#fff5f5;color:#b42318}.vccf-install{display:none}.vccf-install.show{display:flex!important}.vccf-pro-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}.vccf-pro-search{flex:1 1 260px;min-width:220px;max-width:520px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:13px;padding:12px 14px;outline:none}.vccf-command-hint{font-size:.7rem;color:var(--muted)}.vccf-pro-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.vccf-pro-action{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:15px;padding:13px;text-align:left;font-weight:800;display:flex;gap:10px;align-items:center}.vccf-pro-action small{display:block;color:var(--muted);font-weight:600;margin-top:2px}@media(max-width:900px){.vccf-pro-quick{grid-template-columns:1fr 1fr}}@media(max-width:600px){.vccf-pro-search{min-width:0;max-width:none;flex-basis:100%}.vccf-pro-quick{grid-template-columns:1fr}}`;
function cssOnce(){if($('#vccf-pro-style'))return;const s=document.createElement('style');s.id='vccf-pro-style';s.textContent=css;document.head.appendChild(s)}
function nav(view){const b=$(`[data-view="${view}"]`);if(b){b.click();return true}return false}
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$$('.vccf-install').forEach(b=>b.classList.add('show'))});
window.addEventListener('appinstalled',()=>{deferredInstall=null;$$('.vccf-install').forEach(b=>b.classList.remove('show'));toast('VCCF Connect installed.')});
function installButton(){const host=$('.userchip');if(!host||host.querySelector('.vccf-install'))return;const b=document.createElement('button');b.type='button';b.className='btn secondary vccf-install';b.textContent='Install App';b.onclick=async()=>{if(!deferredInstall){toast('Use your browser menu to install VCCF Connect.');return}deferredInstall.prompt();try{await deferredInstall.userChoice}catch{}deferredInstall=null;b.classList.remove('show')};host.appendChild(b)}
function offlineIndicator(){if($('#vccf-online'))return;const el=document.createElement('div');el.id='vccf-online';el.className='vccf-online';document.body.appendChild(el);const paint=()=>{el.textContent=navigator.onLine?'Online':'Offline — changes may sync later';el.classList.toggle('offline',!navigator.onLine)};addEventListener('online',()=>{paint();toast('Connection restored.')});addEventListener('offline',()=>{paint();toast('You are offline.')});paint()}
function searchBar(){const top=$('.topbar');if(!top||$('#vccfProSearch'))return;const wrap=document.createElement('div');wrap.className='vccf-pro-toolbar';wrap.innerHTML='<input id="vccfProSearch" class="vccf-pro-search" type="search" placeholder="Search members, pages, or actions…" autocomplete="off"><span class="vccf-command-hint">Press / to focus</span>';top.insertAdjacentElement('afterend',wrap);const input=$('#vccfProSearch');input.oninput=()=>{const q=input.value.trim().toLowerCase();if(!q){$$('.table tbody tr,.person,.photo').forEach(r=>r.style.display='');return}let found=0;$$('.table tbody tr,.person,.photo').forEach(r=>{const hit=(r.textContent||'').toLowerCase().includes(q);r.style.display=hit?'':'none';if(hit)found++});if(q.includes('member'))nav('members');else if(q.includes('attendance')||q.includes('check'))nav('attendance');else if(q.includes('setting'))nav('settings');else if(found&&$('#members'))nav('members')};document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();input.focus()}if(e.key==='Escape'&&document.activeElement===input){input.value='';input.dispatchEvent(new Event('input'));input.blur()}})}
function quickActions(){const dash=document.getElementById('dashboard');if(!dash||!$('#app')?.classList.contains('active')||$('#vccfProQuick',dash))return;const wrap=document.createElement('div');wrap.id='vccfProQuick';wrap.className='vccf-pro-quick';wrap.innerHTML='<button class="vccf-pro-action" data-pro="attendance"><span>✓</span><span><b>Take attendance</b><small>Open QR/manual check-in</small></span></button><button class="vccf-pro-action" data-pro="members"><span>♙</span><span><b>Manage members</b><small>Search member profiles</small></span></button><button class="vccf-pro-action" data-pro="settings"><span>⚙</span><span><b>Open settings</b><small>Account and app controls</small></span></button>';dash.appendChild(wrap);wrap.onclick=e=>{const b=e.target.closest('[data-pro]');if(b)nav(b.dataset.pro)}}
function boot(){if(!$('#app')?.classList.contains('active'))return;cssOnce();offlineIndicator();installButton();searchBar();quickActions()}
function start(){if($('#app')?.classList.contains('active'))boot()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('vccf-authenticated',()=>setTimeout(boot,0),{once:true});

// Authoritative login handler. Supports both real email addresses and the
// username@vccf.local convention used by VCCF accounts. It activates the app
// directly after authentication instead of reloading into a second handler.
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  const form=$('#loginForm');
  if(!form||window.__VCCF_LOGIN_V8__)return;
  window.__VCCF_LOGIN_V8__=true;
  form.onsubmit=async e=>{
    e.preventDefault();
    e.stopPropagation();
    const identifier=($('#loginUser')?.value||'').trim();
    const password=$('#loginPass')?.value||'';
    const email=identifier.includes('@')?identifier.toLowerCase():`${identifier.toLowerCase().replace(/[^a-z0-9._-]/g,'')}@vccf.local`;
    const button=form.querySelector('button[type="submit"],button');
    let box=$('#vccfLoginError');
    if(!box){box=document.createElement('div');box.id='vccfLoginError';box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap';form.appendChild(box)}
    box.textContent='';
    if(button){button.disabled=true;button.textContent='Signing in…'}
    try{
      if(!identifier)throw new Error('Please enter your username or email.');
      if(!password)throw new Error('Please enter your password.');
      const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error)throw new Error(error.message);
      if(!data?.user)throw new Error('Authentication returned no user.');
      const {data:profileRow,error:profileError}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',data.user.id).maybeSingle();
      if(profileError)throw new Error(`Profile lookup failed: ${profileError.message}`);
      if(!profileRow)throw new Error('Authentication succeeded, but this account has no VCCF profile.');
      window.session={username:identifier,name:profileRow.display_name||identifier,role:profileRow.role==='admin'?'Admin':profileRow.role==='area_leader'?'Area Leader':'Member',area:'',areaId:profileRow.area_id,memberId:profileRow.member_id,memberCode:null};
      window.profile=profileRow;
      const login=$('#login'),app=$('#app');
      if(login)login.style.display='none';
      if(app)app.classList.add('active');
      const name=$('#currentName'),role=$('#currentRole'),avatar=$('#avatar'),info=$('#accountInfo');
      if(name)name.textContent=window.session.name;
      if(role)role.textContent=window.session.role;
      if(avatar)avatar.textContent=window.session.name?.[0]||'V';
      if(info)info.textContent=`${window.session.name} · ${window.session.role}`;
      box.style.background='#ecfdf3';box.style.color='#027a48';box.textContent='Sign-in successful.';
      window.dispatchEvent(new CustomEvent('vccf-authenticated'));
      setTimeout(()=>boot(),0);
      if(typeof window.loadDb==='function'){
        try{await window.loadDb();if(typeof window.refresh==='function')window.refresh()}catch(dbError){console.warn('Post-login data load:',dbError)}
      }
      setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),50);
    }catch(err){
      console.error('VCCF authoritative login:',err);
      box.style.background='#fff1f1';box.style.color='#b42318';box.textContent=`Sign-in failed: ${err?.message||String(err)}`;
    }finally{
      if(button){button.disabled=false;button.textContent='Sign in'}
    }
  };
},0));
})();