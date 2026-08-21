(()=>{
  if(window.__VCCF_MEMBER_CONTROLS_V7__)return;
  window.__VCCF_MEMBER_CONTROLS_V7__=true;
  // Prevent the Pro Suite from starting its document-wide watcher/interval.
  window.__VCCF_PRO_WATCHING__=true;
  const load=src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s)};
  load('/vccf-member-attendance-visibility.js');
  load('/vccf-avatar-fit.js');
  const $=id=>document.getElementById(id);
  const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
  let sortMode='name',addressFilter='';
  const allMembers=()=>{try{return Array.isArray(db?.members)?db.members:[]}catch(_){return[]}};
  const members=()=>allMembers();
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));

  function dedupeProfileNav(){
    const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
    const items=[...sidebar.querySelectorAll('.nav button,.nav a')];
    const matches=items.filter(el=>{
      const text=(el.textContent||'').replace(/\s+/g,' ').trim();
      const view=(el.dataset?.view||'').toLowerCase();
      return /^(my\s*profile|profile)$/i.test(text)||view==='myprofile'||view==='profile'||view==='my-profile';
    });
    if(matches.length<1)return;
    const primary=matches.find(el=>(el.dataset?.view||'').toLowerCase()==='myprofile')||matches[0];
    matches.filter(el=>el!==primary).forEach(el=>el.remove());
    if(primary){primary.dataset.view='myprofile';primary.textContent='My Profile';primary.classList.remove('hidden');primary.hidden=false;primary.removeAttribute('aria-hidden');primary.style.removeProperty('display');}
  }

  function ensureAttendanceNav(){
    const nav=document.querySelector('.nav');if(!nav)return;
    let b=nav.querySelector('button[data-view="attendance"]');
    if(!b){
      b=document.createElement('button');b.type='button';b.dataset.view='attendance';b.textContent='Attendance';
      b.onclick=()=>{if(typeof openView==='function')openView('attendance')};
      const ref=nav.querySelector('button[data-view="selfcheck"]')||null;
      if(ref)nav.insertBefore(b,ref);else nav.appendChild(b);
    }
    b.classList.remove('hidden');b.hidden=false;b.removeAttribute('aria-hidden');b.style.removeProperty('display');
    b.onclick=()=>{if(typeof openView==='function')openView('attendance')};
  }

  function patchPermissions(){
    if(typeof window.__VCCF_APPLY_PERMISSIONS_WRAPPED__==='undefined'){
      window.__VCCF_APPLY_PERMISSIONS_WRAPPED__=true;
      if(typeof applyPermissions==='function'){
        const original=applyPermissions;
        applyPermissions=function(){
          original();
          ensureAttendanceNav();
        };
      }
    }
    // Members can view all members/statistics, but existing check-in rules still prevent checking in others.
    try{areaMembers=function(){return allMembers()}}catch(_){ }
  }

  function refreshMemberControls(){
    const section=$('members'),toolbar=section?.querySelector('.toolbar');
    if(!toolbar)return;
    let box=$('vccfMemberControls');
    if(!box){
      box=document.createElement('div');box.id='vccfMemberControls';box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px';
      toolbar.insertAdjacentElement('afterend',box);
      box.innerHTML='<span id="vccfMemberCount" style="font-weight:800;color:var(--muted);padding:10px 2px"></span><label style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem">Sort by: <select id="vccfSortBy" class="search" style="min-width:150px"><option value="name">Name</option><option value="address">Address</option></select></label><label style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem">Filter by: Address <select id="vccfFilterByAddress" class="search" style="min-width:230px"></select></label>';
      $('vccfSortBy').onchange=e=>{sortMode=e.target.value;renderMembers&&renderMembers();setTimeout(refreshMemberControls,0)};
      $('vccfFilterByAddress').onchange=e=>{addressFilter=e.target.value;applyAddressFilter()};
    }
    const s=$('vccfFilterByAddress');
    if(s){const vals=[...new Set(allMembers().map(m=>String(m.address||'').trim()).filter(Boolean))].sort(collator.compare);s.innerHTML='<option value="">All addresses</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')+'<option value="__blank__">No address</option>';s.value=addressFilter}
    applyAddressFilter();
  }
  function applyAddressFilter(){const rows=[...($('memberRows')?.rows||[])];rows.forEach(r=>{const a=(r.cells[3]?.textContent||'').trim();r.style.display=addressFilter==='__blank__'?!a:(!addressFilter||a===addressFilter)?'':'none'});const e=$('vccfMemberCount');if(e)e.textContent=`Total members: ${allMembers().length} · Showing: ${rows.filter(r=>r.style.display!=='none').length}`}

  function manilaKey(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function pulseFix(){
    const block=$('vccfProDashboard');if(!block)return;
    try{
      const rows=Array.isArray(db?.attendance)?db.attendance:[];
      const members=allMembers();
      const todayKey=manilaKey();
      const sunday=new Date(`${todayKey}T12:00:00+08:00`);sunday.setDate(sunday.getDate()-sunday.getDay());
      const sundayKey=manilaKey(sunday);
      const sundayCount=rows.filter(r=>r.date===sundayKey).length;
      const rate=members.length?Math.round(sundayCount/members.length*100):0;
      const cutoff=Date.now()-30*86400000;
      const c=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      const set=(id,v)=>{const el=$(id);if(el)el.textContent=String(v)};
      set('vccfPulseMembers',members.length);set('vccfPulseSunday',sundayCount);set('vccfPulseRate',rate+'%');
      const paintNew=count=>{set('vccfPulseNew',count)};
      if(c)c.from('members').select('id,created_at').then(r=>{if(!r.error)paintNew((r.data||[]).filter(m=>m.created_at&&new Date(m.created_at).getTime()>=cutoff).length)}).catch(()=>{});
      const dates=[];
      for(let i=7;i>=0;i--){const d=new Date(sunday);d.setDate(sunday.getDate()-i*7);dates.push(d)}
      const chart=$('vccfPulseChart');
      if(chart){const counts=dates.map(d=>{const k=manilaKey(d);return rows.filter(r=>r.date===k).length});const max=Math.max(1,...counts);chart.innerHTML=dates.map((d,i)=>`<div class="vccf-pro-col"><div class="vccf-pro-bar" style="height:${Math.max(6,Math.round(counts[i]/max*110))}px" title="${counts[i]} attendance"></div><span>${new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'2-digit'}).format(d)}</span></div>`).join('')}
      const status=$('vccfPulseStatus');if(status)status.textContent='Updated '+new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}).format(new Date());
    }catch(e){console.warn('VCCF pulse fix:',e)}
  }

  function boot(){
    dedupeProfileNav();ensureAttendanceNav();patchPermissions();refreshMemberControls();
    [100,350,800,1500,3000].forEach(ms=>setTimeout(()=>{dedupeProfileNav();ensureAttendanceNav();patchPermissions();refreshMemberControls();pulseFix()},ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('vccf-app-ready',boot);
  document.addEventListener('click',e=>{if(e.target.closest('.nav button,.nav a'))setTimeout(()=>{dedupeProfileNav();ensureAttendanceNav();patchPermissions();pulseFix()},80)});
})();