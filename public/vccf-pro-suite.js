(()=>{
  'use strict';
  if(window.__VCCF_PRO_SUITE_V1__) return;
  window.__VCCF_PRO_SUITE_V1__=true;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const toast=msg=>{const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__vccfProToast);window.__vccfProToast=setTimeout(()=>t.classList.remove('show'),2600)};
  const manilaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateFor=(d)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const sunday=(d)=>{const x=new Date(d);x.setDate(x.getDate()-x.getDay());return dateFor(x)};
  const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);

  const css=`
    .vccf-pro-shell{margin-top:16px}
    .vccf-pro-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}
    .vccf-pro-search{flex:1 1 260px;min-width:220px;max-width:440px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:13px;padding:12px 14px;outline:none}
    .vccf-pro-search:focus{border-color:var(--brand-red);box-shadow:0 0 0 4px rgba(215,25,32,.10)}
    .vccf-pro-card{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 8px 28px rgba(16,24,40,.06)}
    .vccf-pro-card h3{margin:0 0 6px;font-size:1.02rem}.vccf-pro-card p{margin:0;color:var(--muted);font-size:.86rem;line-height:1.5}
    .vccf-pro-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
    .vccf-pro-metric{padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--bg)}
    .vccf-pro-metric small{display:block;color:var(--muted);font-weight:700}.vccf-pro-metric strong{display:block;font-size:1.5rem;margin-top:5px;letter-spacing:-.03em}
    .vccf-pro-chart{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;align-items:end;height:160px;margin-top:14px}
    .vccf-pro-col{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;height:100%;justify-content:flex-end}.vccf-pro-bar{width:100%;max-width:34px;min-height:4px;border-radius:10px 10px 4px 4px;background:var(--brand-gradient);transition:height .3s ease}.vccf-pro-col span{font-size:.7rem;color:var(--muted);text-align:center;white-space:nowrap}
    .vccf-pro-quick{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.vccf-pro-action{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:15px;padding:13px;text-align:left;font-weight:800;display:flex;gap:10px;align-items:center}.vccf-pro-action:hover{border-color:rgba(215,25,32,.28);transform:translateY(-1px)}
    .vccf-online{position:fixed;right:14px;top:14px;z-index:150;padding:8px 11px;border-radius:999px;border:1px solid rgba(25,135,84,.18);background:#ecfdf3;color:#027a48;font-size:.72rem;font-weight:800;box-shadow:0 8px 22px rgba(16,24,40,.09)}
    .vccf-online.offline{border-color:#f3d2d2;background:#fff5f5;color:#b42318}.vccf-install{display:none;align-items:center;gap:8px}
    .vccf-install.show{display:flex}
    .vccf-command-hint{font-size:.7rem;color:var(--muted);padding-left:4px}
    @media(max-width:900px){.vccf-pro-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.vccf-pro-quick{grid-template-columns:1fr 1fr}.vccf-pro-chart{height:140px}}
    @media(max-width:600px){.vccf-pro-search{min-width:0;flex-basis:100%;max-width:none}.vccf-pro-quick{grid-template-columns:1fr}.vccf-pro-card{padding:15px}.vccf-pro-metric strong{font-size:1.3rem}.vccf-pro-chart{gap:5px}}
    @media(prefers-reduced-motion:reduce){.vccf-pro-bar,.vccf-pro-action{transition:none}}
  `;

  function addCss(){if($('#vccf-pro-style'))return;const s=document.createElement('style');s.id='vccf-pro-style';s.textContent=css;document.head.appendChild(s)}
  function nav(view){const b=$(`[data-view="${view}"]`);if(b){b.click();return true}return false}
  function firstTextButton(words){return $$('button').find(b=>words.some(w=>(b.textContent||'').trim().toLowerCase().includes(w)))}

  let deferredInstall=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.querySelectorAll('.vccf-install').forEach(b=>b.classList.add('show'))});
  window.addEventListener('appinstalled',()=>{deferredInstall=null;document.querySelectorAll('.vccf-install').forEach(b=>b.classList.remove('show'));toast('VCCF Connect installed.');});

  function installButton(){
    const host=$('.userchip')||$('.topbar'); if(!host||$('.vccf-install'))return;
    const b=document.createElement('button');b.type='button';b.className='btn secondary vccf-install';b.textContent='Install App';
    b.onclick=async()=>{if(!deferredInstall){toast('Use your browser menu to install VCCF Connect.');return}deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;b.classList.remove('show')};
    host.appendChild(b);
  }

  function offlineIndicator(){
    if($('#vccf-online'))return;
    const el=document.createElement('div');el.id='vccf-online';el.className='vccf-online';document.body.appendChild(el);
    const paint=()=>{el.textContent=navigator.onLine?'Online':'Offline — changes may sync later';el.classList.toggle('offline',!navigator.onLine)};
    window.addEventListener('online',()=>{paint();toast('Connection restored.');});window.addEventListener('offline',()=>{paint();toast('You are offline.');});paint();
  }

  async function analytics(){
    const root=document.getElementById('dashboard')||$$('.view').find(v=>(v.querySelector('.stats')||v.querySelector('#totalMembers')));
    if(!root||$('#vccfProDashboard',root))return;
    const c=client();if(!c)return;
    const block=document.createElement('section');block.id='vccfProDashboard';block.className='vccf-pro-shell';
    block.innerHTML=`<div class="vccf-pro-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3>Attendance pulse</h3><p>Recent Sunday attendance and membership activity, refreshed automatically.</p></div><span class="tag" id="vccfPulseStatus">Loading…</span></div><div class="vccf-pro-metrics"><div class="vccf-pro-metric"><small>Members</small><strong id="vccfPulseMembers">—</strong></div><div class="vccf-pro-metric"><small>This Sunday</small><strong id="vccfPulseSunday">—</strong></div><div class="vccf-pro-metric"><small>Attendance rate</small><strong id="vccfPulseRate">—</strong></div><div class="vccf-pro-metric"><small>New in 30 days</small><strong id="vccfPulseNew">—</strong></div></div><div class="vccf-pro-chart" id="vccfPulseChart"></div></div>`;
    const stats=root.querySelector('.stats');if(stats)stats.insertAdjacentElement('afterend',block);else root.prepend(block);
    try{
      const {data:{user}}=await c.auth.getUser();if(!user){block.remove();return}
      const [{data:p},{data:members},{data:attendance}]=await Promise.all([
        c.from('profiles').select('role,member_id,area_id').eq('user_id',user.id).maybeSingle(),
        c.from('members').select('id,display_name,area_id,created_at'),
        c.from('attendance').select('member_id,area_id,checked_in_at')
      ]);
      const role=String(p?.role||'admin').toLowerCase().replace(/\s+/g,'_');
      let visible=(members||[]);
      if(role==='area_leader')visible=visible.filter(m=>m.area_id===p?.area_id);
      if(role==='member')visible=visible.filter(m=>m.id===p?.member_id);
      const ids=new Set(visible.map(m=>m.id));
      const rows=(attendance||[]).filter(a=>ids.has(a.member_id));
      const today=manilaDate();const thisSunday=sunday(new Date(today+'T12:00:00+08:00'));
      const thisCount=rows.filter(a=>dateFor(new Date(a.checked_in_at))===thisSunday).length;
      const total=visible.length;const rate=total?Math.round(thisCount/total*100):0;const cut=Date.now()-30*86400000;const fresh=visible.filter(m=>m.created_at&&new Date(m.created_at).getTime()>=cut).length;
      $('#vccfPulseMembers').textContent=String(total);$('#vccfPulseSunday').textContent=String(thisCount);$('#vccfPulseRate').textContent=rate+'%';$('#vccfPulseNew').textContent=String(fresh);$('#vccfPulseStatus').textContent='Updated '+new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}).format(new Date());
      const points=[];for(let i=7;i>=0;i--){const d=new Date();d.setDate(d.getDate()-d.getDay()-i*7);const key=dateFor(d);points.push({key,count:rows.filter(a=>dateFor(new Date(a.checked_in_at))===key).length})}
      const max=Math.max(1,...points.map(x=>x.count));$('#vccfPulseChart').innerHTML=points.map(x=>`<div class="vccf-pro-col"><div class="vccf-pro-bar" style="height:${Math.max(4,Math.round(x.count/max*112))}px" title="${x.count} attendance"></div><span>${x.key.slice(5)}</span></div>`).join('');
      localStorage.setItem('vccf-last-sync',new Date().toISOString());
    }catch(err){console.warn('VCCF pulse unavailable',err);$('#vccfPulseStatus').textContent='Limited data'}
  }

  function globalSearch(){
    if($('#vccfProSearch'))return;
    const top=$('.topbar');if(!top)return;
    const bar=document.createElement('div');bar.className='vccf-pro-toolbar';bar.innerHTML=`<input id="vccfProSearch" class="vccf-pro-search" type="search" placeholder="Search members, pages, or actions…" autocomplete="off" aria-label="Search members, pages, or actions"><span class="vccf-command-hint">Press / to search</span>`;
    top.insertAdjacentElement('afterend',bar);
    const input=$('#vccfProSearch');input.addEventListener('input',()=>{
      const q=input.value.trim().toLowerCase();
      if(!q)return;
      const match=$$('.view').find(v=>v.id?.toLowerCase().includes(q));if(match){const b=$(`[data-view="${match.id}"]`);if(b)b.click()}
      const rows=$$('.table tbody tr,.person,.photo');let shown=0;rows.forEach(r=>{const hit=(r.textContent||'').toLowerCase().includes(q);r.style.display=hit?'':'none';if(hit)shown++});
      if(shown&&document.querySelector('[data-view="members"]'))nav('members');
    });
    document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();input.focus()}if(e.key==='Escape'&&document.activeElement===input){input.value='';input.dispatchEvent(new Event('input'));input.blur()}});
  }

  function quickActions(){
    const dashboard=document.getElementById('dashboard')||$$('.view').find(v=>v.querySelector('.stats'));if(!dashboard||$('#vccfProQuick',dashboard))return;
    const wrap=document.createElement('div');wrap.id='vccfProQuick';wrap.className='vccf-pro-quick';wrap.innerHTML=`<button class="vccf-pro-action" data-pro-action="attendance"><span>✓</span><span><b>Take attendance</b><small style="display:block;color:var(--muted);font-weight:600">Open today's check-in</small></span></button><button class="vccf-pro-action" data-pro-action="members"><span>♙</span><span><b>Manage members</b><small style="display:block;color:var(--muted);font-weight:600">Search and update profiles</small></span></button><button class="vccf-pro-action" data-pro-action="install"><span>＋</span><span><b>Install VCCF</b><small style="display:block;color:var(--muted);font-weight:600">Add it to your device</small></span></button>`;
    dashboard.appendChild(wrap);
    wrap.addEventListener('click',e=>{const b=e.target.closest('[data-pro-action]');if(!b)return;const a=b.dataset.proAction;if(a==='attendance')nav('attendance');if(a==='members')nav('members');if(a==='install'){const i=$('.vccf-install');if(i)i.click();else toast('Use your browser menu to install VCCF Connect.')}});
  }

  function syncLabel(){
    const last=localStorage.getItem('vccf-last-sync');if(!last)return;const el=$('#vccfPulseStatus');if(el&&el.textContent.includes('Updated'))return;
  }

  function focusNav(){
    const map={h:'dashboard',m:'members',a:'attendance',s:'settings'};let seq='';let timer;
    document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;seq+=e.key.toLowerCase();clearTimeout(timer);timer=setTimeout(()=>seq='',800);if(seq.length>1){const v=map[seq.at(-1)];if(v)nav(v);seq=''}});
  }

  function observe(){
    let tries=0;const run=async()=>{addCss();installButton();offlineIndicator();globalSearch();quickActions();await analytics();syncLabel();tries++;if(tries<12)setTimeout(run,1000)};run();
    const mo=new MutationObserver(()=>{if(!$('#vccfProDashboard'))analytics();if(!$('#vccfProQuick'))quickActions();installButton()});mo.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{focusNav();observe()});else{focusNav();observe()}
})();
