(() => {
  if (window.__VCCF_MEMBER_CONTROLS_V6__) return;
  window.__VCCF_MEMBER_CONTROLS_V6__=true;
  const load=src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s)};
  load('/vccf-member-attendance-visibility.js');
  load('/vccf-avatar-fit.js');
  const $=id=>document.getElementById(id);const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});let sortMode='name',addressFilter='';
  const members=()=>{try{return typeof areaMembers==='function'?areaMembers():(window.db?.members||[])}catch(_){return window.db?.members||[]}};
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));

  function dedupeProfileNav(){
    const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
    const navItems=[...sidebar.querySelectorAll('.nav button,.nav a')];
    const primary=navItems.find(el=>/^(my\s*profile|profile)$/i.test((el.textContent||'').replace(/\s+/g,' ').trim()));
    if(!primary)return;
    const candidates=[...sidebar.querySelectorAll('button,a')].filter(el=>el!==primary&&/^(my\s*profile|profile)$/i.test((el.textContent||'').replace(/\s+/g,' ').trim()));
    candidates.forEach(el=>el.remove());
  }
  function watchProfileNav(){
    const sidebar=document.querySelector('.sidebar');if(!sidebar||sidebar.dataset.vccfProfileDedupWatch)return;
    sidebar.dataset.vccfProfileDedupWatch='1';
    const observer=new MutationObserver(()=>{dedupeProfileNav()});
    observer.observe(sidebar,{childList:true,subtree:true});
  }

  function apply(){const rows=[...($('memberRows')?.rows||[])];rows.forEach(r=>{const a=(r.cells[3]?.textContent||'').trim();r.style.display=addressFilter==='__blank__'?!a:(!addressFilter||a===addressFilter)?'':'none'});const e=$('vccfMemberCount');if(e)e.textContent=`Total members: ${window.db?.members?.length||0} · Showing: ${rows.filter(r=>r.style.display!=='none').length}`}
  function refresh(){const s=$('vccfFilterByAddress');if(s){const vals=[...new Set(members().map(m=>String(m.address||'').trim()).filter(Boolean))].sort(collator.compare);s.innerHTML='<option value="">All addresses</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')+'<option value="__blank__">No address</option>';s.value=addressFilter}apply()}
  function render(){members().sort((a,b)=>sortMode==='address'?collator.compare(String(a.address||''),String(b.address||''))||collator.compare(String(a.name||''),String(b.name||'')):collator.compare(String(a.name||''),String(b.name||'')));if(typeof window.renderMembers==='function')window.renderMembers();setTimeout(refresh,0)}
  function boot(){const section=$('members'),toolbar=section?.querySelector('.toolbar');if(!toolbar)return;let box=$('vccfMemberControls');if(!box){box=document.createElement('div');box.id='vccfMemberControls';box.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px';toolbar.insertAdjacentElement('afterend',box);box.innerHTML='<span id="vccfMemberCount" style="font-weight:800;color:var(--muted);padding:10px 2px"></span><label style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem">Sort by: <select id="vccfSortBy" class="search" style="min-width:150px"><option value="name">Name</option><option value="address">Address</option></select></label><label style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem">Filter by: Address <select id="vccfFilterByAddress" class="search" style="min-width:230px"></select></label>';$('vccfSortBy').onchange=e=>{sortMode=e.target.value;render()};$('vccfFilterByAddress').onchange=e=>{addressFilter=e.target.value;apply()}}refresh()}
  document.addEventListener('DOMContentLoaded',()=>{dedupeProfileNav();watchProfileNav();boot();setTimeout(()=>{dedupeProfileNav();boot()},700)});
  window.addEventListener('vccf-app-ready',()=>setTimeout(()=>{dedupeProfileNav();watchProfileNav();boot()},200));
  document.querySelectorAll('.nav button[data-view]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{dedupeProfileNav();boot()},120)));
})();