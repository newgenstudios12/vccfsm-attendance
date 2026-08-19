(()=>{
'use strict';
if(window.__VCCF_PRO_SUITE_V2__)return;
window.__VCCF_PRO_SUITE_V2__=true;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const toast=m=>{const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(window.__vccfProToast);window.__vccfProToast=setTimeout(()=>t.classList.remove('show'),2600)};
const dFmt=(d,opts={})=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',...opts}).format(d);
const day=()=>dFmt(new Date(),{year:'numeric',month:'2-digit',day:'2-digit'});
const sunday=d=>{const x=new Date(d);x.setDate(x.getDate()-x.getDay());return dFmt(x,{year:'numeric',month:'2-digit',day:'2-digit'})};
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);

const css=`
#vccfProActive{margin:0 0 14px;padding:9px 13px;border-radius:12px;background:var(--brand-gradient);color:#fff;font-size:.75rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 8px 20px rgba(215,25,32,.15)}
.vccf-pro-shell{margin-top:16px}.vccf-pro-card{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 8px 28px rgba(16,24,40,.06)}
.vccf-pro-card h3{margin:0 0 6px;font-size:1.04rem}.vccf-pro-card p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.5}
.vccf-pro-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.vccf-pro-metric{padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--bg)}.vccf-pro-metric small{display:block;color:var(--muted);font-weight:700}.vccf-pro-metric strong{display:block;font-size:1.5rem;margin-top:5px}
.vccf-pro-chart{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;align-items:end;height:150px;margin-top:14px}.vccf-pro-col{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;height:100%;justify-content:flex-end}.vccf-pro-bar{width:100%;max-width:34px;min-height:4px;border-radius:10px 10px 4px 4px;background:var(--brand-gradient)}.vccf-pro-col span{font-size:.68rem;color:var(--muted);white-space:nowrap}
.vccf-pro-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}.vccf-pro-search{flex:1 1 260px;min-width:220px;max-width:520px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:13px;padding:12px 14px;outline:none}.vccf-pro-search:focus{border-color:var(--brand-red);box-shadow:0 0 0 4px rgba(215,25,32,.10)}.vccf-command-hint{font-size:.7rem;color:var(--muted)}
.vccf-pro-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.vccf-pro-action{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:15px;padding:13px;text-align:left;font-weight:800;display:flex;gap:10px;align-items:center}.vccf-pro-action small{display:block;color:var(--muted);font-weight:600;margin-top:2px}
.vccf-online{position:fixed;right:14px;top:14px;z-index:150;padding:8px 11px;border-radius:999px;border:1px solid rgba(25,135,84,.18);background:#ecfdf3;color:#027a48;font-size:.72rem;font-weight:800;box-shadow:0 8px 22px rgba(16,24,40,.09)}.vccf-online.offline{border-color:#f3d2d2;background:#fff5f5;color:#b42318}
.vccf-install{display:none}.vccf-install.show{display:flex!important}
@media(max-width:900px){.vccf-pro-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.vccf-pro-quick{grid-template-columns:1fr 1fr}.vccf-pro-chart{height:130px}}
@media(max-width:600px){.vccf-pro-search{min-width:0;max-width:none;flex-basis:100%}.vccf-pro-quick{grid-template-columns:1fr}.vccf-pro-card{padding:15px}.vccf-pro-metric strong{font-size:1.3rem}}
`;
function cssOnce(){if($('#vccf-pro-style'))return;const s=document.createElement('style');s.id='vccf-pro-style';s.textContent=css;document.head.appendChild(s)}
function nav(view){const b=$(`[data-view="${view}"]`);if(b){b.click();return true}return false}

let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.querySelectorAll('.vccf-install').forEach(b=>b.classList.add('show'))});
window.addEventListener('appinstalled',()=>{deferredInstall=null;document.querySelectorAll('.vccf-install').forEach(b=>b.classList.remove('show'));toast('VCCF Connect installed.');});

function installButton(){
  const host=$('.userchip');
  if(!host||host.querySelector('.vccf-install'))return;
  const b=document.createElement('button');b.type='button';b.className='btn secondary vccf-install';b.textContent='Install App';
  b.onclick=async()=>{if(!deferredInstall){toast('Use your browser menu to install VCCF Connect.');return}deferredInstall.prompt();try{await deferredInstall.userChoice}catch{}deferredInstall=null;b.classList.remove('show')};
  host.appendChild(b);
}
function offlineIndicator(){
  if($('#vccf-online'))return;
  const el=document.createElement('div');el.id='vccf-online';el.className='vccf-online';document.body.appendChild(el);
  const paint=()=>{el.textContent=navigator.onLine?'Online':'Offline — changes may sync later';el.classList.toggle('offline',!navigator.onLine)};
  addEventListener('online',()=>{paint();toast('Connection restored.')});addEventListener('offline',()=>{paint();toast('You are offline.')});paint();
}
function activeDashboard(){return document.getElementById('dashboard')||$$('.view').find(v=>v.querySelector('.stats')||v.querySelector('#totalMembers'))}

function ensureActiveBadge(){
  const app=$('#app'),dash=activeDashboard();if(!app||!dash||!app.classList.contains('active'))return;
  if(!$('#vccfProActive',dash)){const b=document.createElement('div');b.id='vccfProActive';b.textContent='Pro Suite Active';dash.prepend(b)}
}

function searchBar(){
  const top=$('.topbar');if(!top||$('#vccfProSearch'))return;
  const wrap=document.createElement('div');wrap.className='vccf-pro-toolbar';wrap.innerHTML='<input id="vccfProSearch" class="vccf-pro-search" type="search" placeholder="Search members, pages, or actions…" autocomplete="off"><span class="vccf-command-hint">Press / to focus</span>';
  top.insertAdjacentElement('afterend',wrap);
  const input=$('#vccfProSearch');input.oninput=()=>{const q=input.value.trim().toLowerCase();if(!q){$$('.table tbody tr,.person,.photo').forEach(r=>r.style.display='');return}let found=0;$$('.table tbody tr,.person,.photo').forEach(r=>{const hit=(r.textContent||'').toLowerCase().includes(q);r.style.display=hit?'':'none';if(hit)found++});if(q.includes('member'))nav('members');else if(q.includes('attendance')||q.includes('check'))nav('attendance');else if(q.includes('setting'))nav('settings');else if(found&&$('#members'))nav('members')};
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();input.focus()}if(e.key==='Escape'&&document.activeElement===input){input.value='';input.dispatchEvent(new Event('input'));input.blur()}});
}

async function pulse(){
  const dash=activeDashboard();if(!dash||!$('#app')?.classList.contains('active'))return;
  let block=$('#vccfProDashboard',dash);if(!block){block=document.createElement('section');block.id='vccfProDashboard';block.className='vccf-pro-shell';block.innerHTML=`<div class="vccf-pro-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3>Attendance Pulse</h3><p>Live leadership snapshot of attendance and membership activity.</p></div><span class="tag" id="vccfPulseStatus">Refreshing…</span></div><div class="vccf-pro-metrics"><div class="vccf-pro-metric"><small>Total members</small><strong id="vccfPulseMembers">—</strong></div><div class="vccf-pro-metric"><small>This Sunday</small><strong id="vccfPulseSunday">—</strong></div><div class="vccf-pro-metric"><small>Attendance rate</small><strong id="vccfPulseRate">—</strong></div><div class="vccf-pro-metric"><small>New in 30 days</small><strong id="vccfPulseNew">—</strong></div></div><div class="vccf-pro-chart" id="vccfPulseChart"></div></div>`;const stats=dash.querySelector('.stats');if(stats)stats.insertAdjacentElement('afterend',block);else dash.appendChild(block)}
  const c=client();if(!c)return;
  try{
    const {data:{user}}=await c.auth.getUser();
    if(!user){$('#vccfPulseStatus',block).textContent='Sign in to load';return}
    const [{data:p},{data:members},{data:attendance}]=await Promise.all([c.from('profiles').select('role,member_id,area_id').eq('user_id',user.id).maybeSingle(),c.from('members').select('id,area_id,created_at'),c.from('attendance').select('member_id,area_id,checked_in_at')]);
    let visible=members||[];const role=String(p?.role||'admin').toLowerCase();if(role==='area_leader')visible=visible.filter(m=>m.area_id===p?.area_id);if(role==='member')visible=visible.filter(m=>m.id===p?.member_id);const ids=new Set(visible.map(m=>m.id));const rows=(attendance||[]).filter(a=>ids.has(a.member_id));
    const sun=sunday(new Date());const thisSunday=rows.filter(a=>dFmt(new Date(a.checked_in_at),{year:'numeric',month:'2-digit',day:'2-digit'})===sun).length;const rate=visible.length?Math.round(thisSunday/visible.length*100):0;const cutoff=Date.now()-30*86400000;const fresh=visible.filter(m=>m.created_at&&new Date(m.created_at).getTime()>=cutoff).length;
    $('#vccfPulseMembers',block).textContent=String(visible.length);$('#vccfPulseSunday',block).textContent=String(thisSunday);$('#vccfPulseRate',block).textContent=rate+'%';$('#vccfPulseNew',block).textContent=String(fresh);$('#vccfPulseStatus',block).textContent='Updated '+dFmt(new Date(),{hour:'numeric',minute:'2-digit'});
    const pts=[];for(let i=7;i>=0;i--){const d=new Date();d.setDate(d.getDate()-d.getDay()-i*7);const key=dFmt(d,{year:'numeric',month:'2-digit',day:'2-digit'});pts.push({key,count:rows.filter(a=>dFmt(new Date(a.checked_in_at),{year:'numeric',month:'2-digit',day:'2-digit'})===key).length})}const max=Math.max(1,...pts.map(p=>p.count));$('#vccfPulseChart',block).innerHTML=pts.map(p=>`<div class="vccf-pro-col"><div class="vccf-pro-bar" style="height:${Math.max(6,Math.round(p.count/max*110))}px" title="${p.count} attendance"></div><span>${p.key.slice(5)}</span></div>`).join('');
    localStorage.setItem('vccf-last-sync',new Date().toISOString());
  }catch(e){console.warn('VCCF Pro Pulse:',e);if($('#vccfPulseStatus',block))$('#vccfPulseStatus',block).textContent='Limited data'}
}
function quickActions(){
  const dash=activeDashboard();if(!dash||!$('#app')?.classList.contains('active')||$('#vccfProQuick',dash))return;
  const wrap=document.createElement('div');wrap.id='vccfProQuick';wrap.className='vccf-pro-quick';wrap.innerHTML='<button class="vccf-pro-action" data-pro="attendance"><span>✓</span><span><b>Take attendance</b><small>Open QR/manual check-in</small></span></button><button class="vccf-pro-action" data-pro="members"><span>♙</span><span><b>Manage members</b><small>Search and update profiles</small></span></button><button class="vccf-pro-action" data-pro="settings"><span>⚙</span><span><b>Open settings</b><small>Account and app controls</small></span></button>';dash.appendChild(wrap);wrap.onclick=e=>{const b=e.target.closest('[data-pro]');if(!b)return;nav(b.dataset.pro)};
}
function focusKeys(){if(window.__VCCF_PRO_KEYS__)return;window.__VCCF_PRO_KEYS__=true;document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key.toLowerCase()==='g')window.__vccfProG='g';else if(window.__vccfProG){const map={d:'dashboard',m:'members',a:'attendance',s:'settings'};if(map[e.key.toLowerCase()])nav(map[e.key.toLowerCase()]);window.__vccfProG=null}else setTimeout(()=>window.__vccfProG=null,700)})}

let busy=false;
async function refreshPro(){if(busy)return;busy=true;try{cssOnce();offlineIndicator();ensureActiveBadge();installButton();searchBar();await pulse();quickActions();}finally{busy=false}}
function watch(){if(window.__VCCF_PRO_WATCHING__)return;window.__VCCF_PRO_WATCHING__=true;const mo=new MutationObserver(()=>{if($('#app')?.classList.contains('active'))setTimeout(refreshPro,60)});mo.observe(document.body,{childList:true,subtree:true});window.addEventListener('hashchange',refreshPro);window.addEventListener('vccf-profile-linked',refreshPro);window.addEventListener('online',refreshPro);const c=client();if(c?.auth?.onAuthStateChange)c.auth.onAuthStateChange(()=>setTimeout(refreshPro,120));setInterval(()=>{if($('#app')?.classList.contains('active'))refreshPro()},5000)}
function boot(){cssOnce();offlineIndicator();focusKeys();watch();refreshPro();setTimeout(refreshPro,300);setTimeout(refreshPro,1000);setTimeout(refreshPro,2500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
