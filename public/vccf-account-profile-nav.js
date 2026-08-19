(()=>{
'use strict';
if(window.__VCCF_ACCOUNT_PROFILE_NAV_V3__)return;
window.__VCCF_ACCOUNT_PROFILE_NAV_V3__=true;

const $=id=>document.getElementById(id);
const isMobile=()=>window.matchMedia('(max-width:700px)').matches;
const toast=message=>{const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__vccfToastTimer);window.__vccfToastTimer=setTimeout(()=>el.classList.remove('show'),2600)};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const css=`
/* VCCF responsive UI — one navigation system, adaptive layout */
:root{--vccf-nav-width:252px;--vccf-rail-width:82px}
html,body{width:100%;max-width:100%;overflow-x:hidden}
img,svg,video,canvas,iframe{max-width:100%}
button,input,select,textarea{max-width:100%}
.main,.panel,.stat,.toolbar,.modal-card,.formgrid,.grid2,.aboutgrid,.gallery{min-width:0}
.tablewrap{min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch}

/* Wide desktop: comfortable persistent sidebar */
@media(min-width:1101px){
  .sidebar{width:var(--vccf-nav-width)!important;padding:22px 15px!important}
  .main{margin-left:var(--vccf-nav-width)!important;width:calc(100% - var(--vccf-nav-width))!important;max-width:1600px;padding:28px clamp(24px,3vw,48px)!important}
  .sidebar .nav{gap:5px!important}
  .sidebar .nav button{min-height:46px;border-radius:13px;padding:12px 13px!important}
  .sidebar .nav button:focus-visible{outline:3px solid rgba(215,25,32,.22);outline-offset:2px}
  .login-logo{height:100px!important;max-width:340px!important;margin-bottom:24px!important}
}

/* Tablet: navigation rail, content gets the rest of the width */
@media(min-width:701px) and (max-width:1100px){
  .sidebar{width:var(--vccf-rail-width)!important;padding:16px 10px!important}
  .side-logo{width:58px!important;height:42px!important;object-fit:contain;margin:5px auto 26px!important}
  .sidebar .nav{gap:7px!important}
  .sidebar .nav button{height:48px!important;min-height:48px!important;padding:8px 5px!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;font-size:0!important;border-radius:13px!important}
  .sidebar .nav button span[aria-hidden=true]{display:block!important;font-size:1.15rem!important;line-height:1}
  .sidebar .nav button:before{font-size:1.2rem!important}
  .sidebar .side-bottom{left:10px!important;right:10px!important}
  .main{margin-left:var(--vccf-rail-width)!important;width:calc(100% - var(--vccf-rail-width))!important;padding:22px 20px 40px!important}
  .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .grid2,.aboutgrid{grid-template-columns:1fr!important}
  .gallery{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}

/* Mobile: no horizontal nav. Use a single off-canvas drawer. */
@media(max-width:700px){
  .sidebar{position:fixed!important;left:-105vw!important;top:0!important;bottom:0!important;width:min(86vw,330px)!important;height:100dvh!important;min-height:0!important;padding:0!important;background:var(--panel)!important;border-right:1px solid var(--line)!important;z-index:120!important;box-shadow:18px 0 55px rgba(16,24,40,.18)!important;visibility:hidden!important;pointer-events:none!important;transform:translateX(0)!important;transition:left .2s ease,visibility 0s linear .2s!important;overflow:hidden!important}
  .sidebar.vccf-drawer-open{left:0!important;visibility:visible!important;pointer-events:auto!important;transition:left .2s ease!important}
  .side-logo{display:block!important;width:auto!important;height:50px!important;max-width:190px!important;object-fit:contain;margin:20px 16px 18px!important}
  .sidebar .nav{display:grid!important;gap:5px!important;height:calc(100% - 110px)!important;overflow-y:auto!important;padding:4px 12px 18px!important}
  .sidebar .nav button{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:12px!important;width:100%!important;height:48px!important;min-height:48px!important;flex:none!important;padding:10px 12px!important;border-radius:12px!important;font-size:.9rem!important;text-align:left!important;white-space:normal!important;color:var(--text)!important;background:transparent!important}
  .sidebar .nav button:hover{background:var(--bg)!important}
  .sidebar .nav button.active{background:var(--brand-gradient)!important;color:#fff!important}
  .sidebar .nav button span[aria-hidden=true]{display:inline!important;flex:none!important;width:22px!important;text-align:center!important;font-size:1.05rem!important;line-height:1!important}
  .sidebar .nav button:before{display:none!important}
  .sidebar .side-bottom{display:block!important;position:absolute!important;left:12px!important;right:12px!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;background:var(--panel)!important}
  .sidebar .side-bottom>*{max-width:100%}
  .main{margin-left:0!important;width:100%!important;max-width:none!important;padding:14px 12px calc(28px + env(safe-area-inset-bottom))!important}
  .topbar{padding:6px 2px 12px 58px!important;margin-bottom:14px!important;min-height:46px!important;gap:10px!important;flex-wrap:wrap!important}
  .topbar h2{font-size:1.25rem!important;line-height:1.15!important}
  .userchip{min-width:0!important;max-width:100%!important}
  .userchip strong{display:block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .avatar{width:38px!important;height:38px!important;flex:none!important}
  .vccf-mobile-menu-btn{position:fixed;top:max(10px,env(safe-area-inset-top));left:10px;width:44px;height:44px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--text);display:grid;place-items:center;z-index:130;box-shadow:0 8px 24px rgba(16,24,40,.12);font-size:1.15rem;line-height:1;touch-action:manipulation}
  .vccf-mobile-menu-btn:focus-visible{outline:3px solid rgba(215,25,32,.22);outline-offset:2px}
  .vccf-mobile-backdrop{position:fixed;inset:0;background:rgba(8,10,14,.44);z-index:110;opacity:0;pointer-events:none;transition:opacity .2s ease}
  .vccf-mobile-backdrop.open{opacity:1;pointer-events:auto}
  body.vccf-mobile-drawer-open{overflow:hidden}
  .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
  .stat{padding:15px!important;border-radius:16px!important;min-width:0!important}
  .stat strong{font-size:1.55rem!important}
  .grid2,.aboutgrid{grid-template-columns:1fr!important;gap:12px!important}
  .gallery{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
  .panel{padding:15px!important;border-radius:16px!important;min-width:0!important}
  .toolbar,.toolbar .left,.toolbar .right{width:100%!important;min-width:0!important}
  .toolbar .left,.toolbar .right{flex-wrap:wrap!important}
  .toolbar .left>*,.toolbar .right>*{flex:1 1 140px;min-width:0!important}
  .search{width:100%!important;min-width:0!important;max-width:100%!important}
  .table{min-width:680px!important}
  .table th,.table td{padding:11px 10px!important;font-size:.82rem!important}
  .formgrid{grid-template-columns:1fr!important;gap:10px!important}
  .full{grid-column:auto!important}
  .field input,.field select,.field textarea{min-height:44px!important;min-width:0!important}
  .modal{padding:8px!important;align-items:end!important}
  .modal-card{width:min(100%,720px)!important;max-height:calc(100dvh - 16px)!important;padding:16px!important;border-radius:20px!important}
  .qr-area-grid{grid-template-columns:1fr!important}
  .login{padding:14px!important;min-height:100svh!important}
  .login-card{width:min(440px,100%)!important;padding:24px 18px!important;border-radius:22px!important}
  .login-logo{height:88px!important;max-width:min(310px,86vw)!important;margin-bottom:20px!important}
  .vccf-link-card{margin-bottom:14px!important;padding:16px!important;border:1px solid var(--line);background:var(--panel);border-radius:18px;box-shadow:0 8px 24px rgba(16,24,40,.06)}
  .vccf-link-card .link-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  .vccf-link-card select,.vccf-link-card .btn{width:100%!important;min-height:46px!important}
}

@media(max-width:430px){
  .main{padding-inline:10px!important}
  .topbar{padding-left:56px!important}
  .topbar h2{font-size:1.12rem!important}
  .userchip strong{display:none}
  .gallery{grid-template-columns:1fr 1fr!important}
  .panel{padding:13px!important}
  .toolbar .btn{min-height:44px!important;padding:10px 11px!important;font-size:.8rem!important}
  .mobile-nav-item{min-height:46px}
}
@media(max-width:380px){
  .vccf-mobile-menu-btn{width:42px;height:42px;left:9px}
  .sidebar{width:min(90vw,300px)!important}
  .main{padding-inline:8px!important}
  .stats{gap:8px!important}.stat{padding:11px!important}.stat strong{font-size:1.25rem!important}
  .login-card{padding:20px 14px!important}.login-logo{height:80px!important}
}
@media(prefers-reduced-motion:reduce){.sidebar,.vccf-mobile-backdrop,.vccf-mobile-menu-btn{transition:none!important}}
@media(hover:none){.btn:hover,button:hover{filter:none!important}.stat:hover{transform:none!important}}

/* Account profile linking and account-creation form */
.vccf-link-card{max-width:760px;margin:0 0 16px;padding:18px;border:1px solid var(--line);background:var(--panel);border-radius:18px;box-shadow:0 8px 24px rgba(16,24,40,.05)}
.vccf-link-card .link-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;margin-top:12px}
.vccf-link-card select{min-height:46px}.vccf-link-card .btn{min-height:46px;white-space:nowrap}.vccf-link-card p{color:var(--muted);font-size:.88rem;line-height:1.5}
.vccf-account-no-area .field:has(select[id*="area" i]),.vccf-account-no-area .field:has(input[id*="area" i]),.vccf-account-no-area .field:has(input[name*="area" i]),.vccf-account-no-area .field:has(select[name*="area" i]),.vccf-account-no-area [id*="area_id" i],.vccf-account-no-area [name*="area_id" i]{display:none!important}
`;

function addCss(){if($('vccf-account-profile-nav-style'))return;const style=document.createElement('style');style.id='vccf-account-profile-nav-style';style.textContent=css;document.head.appendChild(style)}
function api(){return window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY)}

async function getProfile(){
  const client=api();
  if(!client)return null;
  const {data:{user}}=await client.auth.getUser();
  if(!user)return null;
  const {data,error}=await client.from('profiles').select('user_id,role,member_id,display_name,area_id').eq('user_id',user.id).maybeSingle();
  if(error||!data)return null;
  return {client,user,profile:data};
}

async function ensureMemberLink(){
  const ctx=await getProfile();
  if(!ctx||ctx.profile.member_id)return;
  const name=String(ctx.profile.display_name||'').trim();
  if(!name)return;
  const {data:matches,error}=await ctx.client.from('members').select('id,display_name').eq('display_name',name).limit(2);
  if(error||!matches||matches.length!==1)return;
  const result=await ctx.client.from('profiles').update({member_id:matches[0].id}).eq('user_id',ctx.user.id);
  if(!result.error)window.dispatchEvent(new CustomEvent('vccf-profile-linked',{detail:{memberId:matches[0].id}}));
}

async function renderLinkCard(host){
  const ctx=await getProfile();
  if(!ctx||!host||ctx.profile.member_id)return;
  const {data:members,error}=await ctx.client.from('members').select('id,display_name,address').order('display_name');
  if(error){host.innerHTML='<div class="vccf-link-card"><h4>Member profile linking unavailable</h4><p>Please contact an administrator if member records cannot be loaded.</p></div>';return}
  const options=(members||[]).map(member=>`<option value="${escapeHtml(member.id)}">${escapeHtml(member.display_name)}${member.address?` — ${escapeHtml(member.address)}`:''}</option>`).join('');
  host.innerHTML=`<div class="vccf-link-card"><h4>Connect your member profile</h4><p>This account is not connected to a member record yet. Select the existing member record that belongs to this account.</p><div class="link-row"><select id="vccfLinkMember"><option value="">Select member profile…</option>${options}</select><button id="vccfLinkMemberBtn" class="btn" type="button">Link profile</button></div></div>`;
  const select=$('vccfLinkMember');const button=$('vccfLinkMemberBtn');
  button.onclick=async()=>{
    const id=select.value;
    if(!id){toast('Select a member profile first.');return}
    button.disabled=true;button.textContent='Linking…';
    const result=await ctx.client.from('profiles').update({member_id:id}).eq('user_id',ctx.user.id);
    if(result.error){toast(`Could not link profile: ${result.error.message}`);button.disabled=false;button.textContent='Link profile';return}
    toast('Member profile linked successfully.');
    host.innerHTML='<div class="vccf-link-card"><h4>Member profile connected</h4><p>Your account is now connected to your member record.</p></div>';
    window.dispatchEvent(new CustomEvent('vccf-profile-linked',{detail:{memberId:id}}));
  };
}

function placeLinkCard(){
  const body=$('suite-profileBody');
  if(!body||$('vccfLinkProfileHost'))return;
  const host=document.createElement('div');host.id='vccfLinkProfileHost';body.prepend(host);
  renderLinkCard(host).catch(()=>{});
}

function accountRoot(){
  const nodes=[...document.querySelectorAll('h1,h2,h3,h4,h5,legend,.modal-head,.panel,.toolbar')];
  for(const el of nodes){
    const text=(el.textContent||'').trim().toLowerCase();
    if(text.includes('create account')||text.includes('new account')||text.includes('register account')||text.includes('creating account'))return el.closest('.modal-card,.panel,.view,form')||el.parentElement;
  }
  return null;
}
function hideAccountArea(){
  const root=accountRoot();if(!root)return;root.classList.add('vccf-account-no-area');
  root.querySelectorAll('label,.field').forEach(el=>{
    const text=(el.textContent||'').toLowerCase();
    const attrs=[el.id,el.getAttribute?.('name'),el.getAttribute?.('for')].filter(Boolean).join(' ').toLowerCase();
    if(/\barea\b|area_id|area-id/.test(`${text} ${attrs}`))el.style.display='none';
  });
}
function observeAccount(){
  const observer=new MutationObserver(()=>hideAccountArea());
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',()=>setTimeout(hideAccountArea,50));
}

let drawer={button:null,backdrop:null,sidebar:null,close:null};
function closeDrawer(){
  if(!drawer.sidebar)return;
  drawer.sidebar.classList.remove('vccf-drawer-open');drawer.backdrop?.classList.remove('open');document.body.classList.remove('vccf-mobile-drawer-open');
  drawer.button?.setAttribute('aria-expanded','false');drawer.button?.setAttribute('aria-label','Open navigation');
}
function openDrawer(){
  if(!drawer.sidebar)return;
  drawer.sidebar.classList.add('vccf-drawer-open');drawer.backdrop?.classList.add('open');document.body.classList.add('vccf-mobile-drawer-open');
  drawer.button?.setAttribute('aria-expanded','true');drawer.button?.setAttribute('aria-label','Close navigation');
}
function setupMobileDrawer(){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar)return;
  if(drawer.sidebar===sidebar&&drawer.button)return;
  if(drawer.button){drawer.button.remove();drawer.backdrop?.remove()}
  const button=document.createElement('button');button.id='vccfMobileMenuBtn';button.className='vccf-mobile-menu-btn';button.type='button';button.setAttribute('aria-label','Open navigation');button.setAttribute('aria-expanded','false');button.innerHTML='<span aria-hidden="true">☰</span>';
  const backdrop=document.createElement('div');backdrop.id='vccfMobileBackdrop';backdrop.className='vccf-mobile-backdrop';
  drawer={button,backdrop,sidebar,close:closeDrawer};
  button.addEventListener('click',()=>sidebar.classList.contains('vccf-drawer-open')?closeDrawer():openDrawer());
  backdrop.addEventListener('click',closeDrawer);
  sidebar.querySelectorAll('.nav button').forEach(item=>item.addEventListener('click',()=>setTimeout(closeDrawer,80)));
  document.body.append(backdrop,button);
}
function syncResponsiveNavigation(){
  if(isMobile())setupMobileDrawer();else closeDrawer();
}

async function init(){
  addCss();
  /* Navigation is initialized immediately so it never waits on Supabase/network calls. */
  syncResponsiveNavigation();
  observeAccount();
  hideAccountArea();
  try{await ensureMemberLink();placeLinkCard()}catch(error){console.warn('VCCF member-link initialization failed',error)}
  window.addEventListener('resize',syncResponsiveNavigation,{passive:true});
  window.matchMedia('(max-width:700px)').addEventListener?.('change',syncResponsiveNavigation);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer()});
  window.addEventListener('vccf-app-ready',()=>{syncResponsiveNavigation();setTimeout(()=>{ensureMemberLink().then(placeLinkCard).catch(()=>{});hideAccountArea()},120)});
  window.addEventListener('vccf-profile-linked',()=>setTimeout(()=>{if(typeof window.vccfRefreshSuite==='function')window.vccfRefreshSuite()},120));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
