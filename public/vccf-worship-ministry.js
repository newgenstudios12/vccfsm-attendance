(() => {
  'use strict';
  if (window.__VCCF_WORSHIP_MINISTRY__) return;
  window.__VCCF_WORSHIP_MINISTRY__ = true;

  const ALLOWED_MINISTRIES = new Set([
    'worship','worship ministry','creative ministry','creative arts','creative arts ministry',
    'music','music ministry','band','band ministry'
  ]);
  const ROLE_OPTIONS = [
    'Worship Leader','Backup Singer','Keyboard','Acoustic Guitar','Electric Guitar',
    'Bass','Drums','Media / Projection','Sound / Technical','Other'
  ];
  const MANAGER_ROLE_RE = /(leader|head|coordinator|director)/i;
  const $ = (s, ctx=document) => ctx.querySelector(s);
  const $$ = (s, ctx=document) => Array.from(ctx.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm = (v) => String(v ?? '').trim().toLowerCase();
  const datePH = (v) => v ? new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(`${v}T12:00:00+08:00`)) : '—';
  const todayPH = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const memberName = (m) => m?.display_name || [m?.first_name,m?.last_name].filter(Boolean).join(' ') || 'Member';

  let sb=null, user=null, profile=null, myMinistries=[], canAccess=false, canManage=false;
  let schedules=[], members=[];

  function addStyles(){
    if ($('#vccf-worship-ministry-css')) return;
    const s=document.createElement('style');
    s.id='vccf-worship-ministry-css';
    s.textContent=`
      .vccf-worship-nav-group{display:grid;gap:4px;min-width:0}
      .vccf-worship-nav-group .vccf-worship-parent{display:flex!important;align-items:center;justify-content:space-between;gap:8px;width:100%}
      .vccf-worship-nav-group .vccf-worship-parent .wn-label{display:inline-flex;align-items:center;gap:9px;min-width:0}
      .vccf-worship-nav-group .wn-chevron{font-size:.72rem;transition:transform .18s ease}
      .vccf-worship-nav-group.open .wn-chevron{transform:rotate(180deg)}
      .vccf-worship-subnav{display:none;gap:4px;margin:0 0 2px 13px;padding-left:10px;border-left:2px solid color-mix(in srgb,var(--brand) 24%,transparent)}
      .vccf-worship-nav-group.open .vccf-worship-subnav{display:grid}
      .vccf-worship-subnav button{font-size:.76rem!important;padding:9px 10px!important}
      .vccf-worship-view{--wm-gap:14px}
      .wm-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;margin-bottom:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 9%,var(--panel,#fff)),var(--panel,#fff));border:1px solid var(--line);border-radius:18px}
      .wm-hero h2{margin:0 0 5px;font-size:1.25rem}.wm-muted{color:var(--muted);font-size:.82rem}.wm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--wm-gap)}
      .wm-card{background:var(--panel,var(--card,#fff));border:1px solid var(--line);border-radius:18px;padding:16px;min-width:0;box-shadow:0 8px 24px rgba(15,23,42,.04)}
      .wm-card h3{margin:0 0 10px;font-size:1rem}.wm-card h4{margin:0 0 7px;font-size:.9rem}.wm-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .wm-btn{border:0;border-radius:11px;padding:9px 12px;font-weight:800;font-size:.78rem;cursor:pointer;background:linear-gradient(135deg,var(--brand),#ef4939);color:#fff}
      .wm-btn.secondary{background:var(--panel,#fff);color:var(--text);border:1px solid var(--line)}.wm-btn.danger{background:#b42318}.wm-btn:disabled{opacity:.55;cursor:not-allowed}
      .wm-form{display:grid;gap:10px}.wm-form .wm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wm-form label{display:block;font-size:.72rem;font-weight:800;margin-bottom:4px;color:var(--muted)}
      .wm-form input,.wm-form select,.wm-form textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 11px;background:var(--bg);color:var(--text);outline:none}.wm-form textarea{resize:vertical}
      .wm-schedule-list{display:grid;gap:10px}.wm-service{border:1px solid var(--line);border-radius:15px;padding:13px}.wm-service-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:9px}.wm-date{font-weight:900}.wm-role-list{display:grid;gap:6px}.wm-role{display:grid;grid-template-columns:minmax(120px,.7fr) 1fr;gap:8px;padding:7px 0;border-top:1px solid var(--line);font-size:.82rem}.wm-role:first-child{border-top:0}.wm-role b{font-size:.76rem;color:var(--muted)}
      .wm-pill{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:.7rem;font-weight:850;background:color-mix(in srgb,var(--brand) 10%,transparent);color:var(--brand)}
      .wm-pill.approved{background:#e8f7ee;color:#167647}.wm-pill.submitted{background:#eef4ff;color:#175cd3}.wm-pill.revision{background:#fff3e8;color:#b54708}
      .wm-empty{padding:20px;text-align:center;color:var(--muted);font-size:.84rem}.wm-editor{margin-top:14px}.wm-assignment-row{display:grid;grid-template-columns:160px minmax(170px,1fr) minmax(120px,.8fr) auto;gap:8px;align-items:end;padding:9px 0;border-bottom:1px solid var(--line)}
      .wm-song{border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:9px}.wm-song-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:900;font-size:.82rem}.wm-song-grid{display:grid;grid-template-columns:1.3fr 1fr .45fr;gap:8px}.wm-song-grid .wide{grid-column:1/-1}
      .wm-offertory{border:1px dashed color-mix(in srgb,var(--brand) 40%,var(--line));border-radius:14px;padding:13px;margin-top:12px}.wm-lineup-summary{display:grid;gap:7px;margin-top:8px}.wm-lineup-song{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:.82rem}.wm-lineup-song:first-child{border-top:0}.wm-num{width:24px;height:24px;border-radius:8px;background:color-mix(in srgb,var(--brand) 10%,transparent);display:grid;place-items:center;font-weight:900;color:var(--brand);font-size:.72rem}
      .wm-toast{position:fixed;right:18px;bottom:18px;z-index:9999;background:#16181d;color:#fff;padding:11px 14px;border-radius:12px;box-shadow:0 14px 32px rgba(0,0,0,.22);font-size:.82rem;opacity:0;transform:translateY(8px);pointer-events:none;transition:.18s}.wm-toast.show{opacity:1;transform:none}
      @media(max-width:900px){.vccf-worship-nav-group .vccf-worship-parent{justify-content:center}.vccf-worship-nav-group .wn-label span:last-child,.vccf-worship-nav-group .wn-chevron{display:none}.vccf-worship-subnav{margin-left:0;padding-left:0;border-left:0}.vccf-worship-subnav button{font-size:0!important;text-align:center}.vccf-worship-subnav button:before{font-size:1rem}.vccf-worship-subnav button[data-worship-view="schedule"]:before{content:'◷'}.vccf-worship-subnav button[data-worship-view="lineup"]:before{content:'♫'}}
      @media(max-width:760px){.wm-grid{grid-template-columns:1fr}.wm-hero{flex-direction:column}.wm-form .wm-row{grid-template-columns:1fr}.wm-assignment-row{grid-template-columns:1fr 1fr}.wm-assignment-row .wm-remove-wrap{grid-column:1/-1}.wm-song-grid{grid-template-columns:1fr 1fr}.wm-song-grid .wide{grid-column:1/-1}}
      @media(max-width:520px){.wm-card{padding:13px;border-radius:15px}.wm-song-grid,.wm-assignment-row{grid-template-columns:1fr}.wm-assignment-row .wm-remove-wrap{grid-column:auto}.wm-role{grid-template-columns:1fr}.wm-hero{padding:15px}}
    `;
    document.head.appendChild(s);
  }

  function toast(msg){
    let t=$('#wmToast');
    if(!t){t=document.createElement('div');t.id='wmToast';t.className='wm-toast';document.body.appendChild(t);}
    t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600);
  }

  function ministryName(row){return row?.ministries?.name || row?.ministries?.[0]?.name || '';}
  function isAllowedMinistry(name){return ALLOWED_MINISTRIES.has(norm(name));}

  async function getContext(){
    sb=window.VCCF?.sb || (window.supabase && window.VCCF_SUPABASE_URL && window.VCCF_SUPABASE_PUBLISHABLE_KEY
      ? window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY) : null);
    if(!sb) return false;
    const ur=await sb.auth.getUser(); user=ur.data?.user || null; if(!user) return false;
    const pr=await sb.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle();
    if(pr.error) throw pr.error; profile=pr.data||{}; if(!profile.member_id) return false;
    const mr=await sb.from('member_ministries').select('member_id,ministry_id,role_title,ministries(name)').eq('member_id',profile.member_id);
    if(mr.error) throw mr.error; myMinistries=mr.data||[];
    canAccess=myMinistries.some(x=>isAllowedMinistry(ministryName(x)));
    if(!canAccess) return false;
    canManage=['admin','pastor'].includes(norm(profile.role)) || myMinistries.some(x=>isAllowedMinistry(ministryName(x)) && MANAGER_ROLE_RE.test(String(x.role_title||'')));
    return true;
  }

  function mountViews(){
    const main=$('.main'); if(!main) return;
    if(!$('#worshipScheduleView')){
      const v=document.createElement('section');v.id='worshipScheduleView';v.className='view vccf-worship-view';v.innerHTML='<div id="worshipScheduleRoot"></div>';main.appendChild(v);
    }
    if(!$('#worshipLineupView')){
      const v=document.createElement('section');v.id='worshipLineupView';v.className='view vccf-worship-view';v.innerHTML='<div id="worshipLineupRoot"></div>';main.appendChild(v);
    }
  }

  function mountNav(){
    if(!canAccess) return;
    const nav=$('.nav'); if(!nav || $('.vccf-worship-nav-group',nav)) return;
    const group=document.createElement('div'); group.className='vccf-worship-nav-group'; group.dataset.worshipNav='1';
    group.innerHTML=`
      <button type="button" class="vccf-worship-parent" aria-expanded="false" title="Worship Ministry">
        <span class="wn-label"><span aria-hidden="true">♫</span><span>Worship Ministry</span></span><span class="wn-chevron">⌄</span>
      </button>
      <div class="vccf-worship-subnav">
        <button type="button" data-worship-view="schedule" title="Schedule of Ministers">Schedule of Ministers</button>
        <button type="button" data-worship-view="lineup" title="Worship Line-Up">Worship Line-Up</button>
      </div>`;
    const band=$('[data-band-fund-nav]',nav) || Array.from(nav.children).find(x=>/band fund/i.test(x.textContent||''));
    if(band && band.nextSibling) nav.insertBefore(group,band.nextSibling); else nav.appendChild(group);
    $('.vccf-worship-parent',group).addEventListener('click',()=>{
      group.classList.toggle('open');$('.vccf-worship-parent',group).setAttribute('aria-expanded',group.classList.contains('open')?'true':'false');
    });
    $$('.vccf-worship-subnav button',group).forEach(b=>b.addEventListener('click',()=>showModule(b.dataset.worshipView)));
  }

  function markNav(view){
    $$('.nav button').forEach(b=>b.classList.remove('active'));
    const group=$('.vccf-worship-nav-group'); if(group){group.classList.add('open');$('.vccf-worship-parent',group)?.setAttribute('aria-expanded','true');}
    $(`.vccf-worship-subnav button[data-worship-view="${view}"]`)?.classList.add('active');
  }

  async function showModule(view){
    if(!canAccess) return;
    $$('.view').forEach(v=>v.classList.remove('active'));
    const id=view==='lineup'?'worshipLineupView':'worshipScheduleView';$('#'+id)?.classList.add('active');markNav(view);
    const title=$('#title');if(title)title.textContent=view==='lineup'?'Worship Line-Up':'Schedule of Ministers';
    window.location.hash=view==='lineup'?'worship-lineup':'worship-schedule';
    if(view==='lineup') await renderLineups(); else await renderSchedules();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function loadSchedules(){
    const sr=await sb.from('worship_service_schedules').select('id,service_date,service_name,notes,created_at,updated_at,worship_schedule_assignments(id,member_id,ministry_role,notes,members(id,display_name,first_name,last_name))').order('service_date',{ascending:false}).limit(80);
    if(sr.error) throw sr.error; schedules=sr.data||[]; return schedules;
  }

  async function loadMembers(){
    const stateMembers=window.VCCF?.getState?.()?.members||[];
    if(stateMembers.length){members=stateMembers.slice();return members;}
    const r=await sb.from('members').select('id,display_name,first_name,last_name,is_active,status').order('last_name').limit(2000);
    if(r.error) throw r.error;members=r.data||[];return members;
  }

  function assignmentRows(s){
    const a=(s.worship_schedule_assignments||[]).slice().sort((x,y)=>ROLE_OPTIONS.indexOf(x.ministry_role)-ROLE_OPTIONS.indexOf(y.ministry_role));
    return a.length?a.map(x=>`<div class="wm-role"><b>${esc(x.ministry_role)}</b><span>${esc(memberName(x.members))}${x.notes?`<small class="wm-muted" style="display:block">${esc(x.notes)}</small>`:''}</span></div>`).join(''):'<div class="wm-empty" style="padding:8px 0">No ministers assigned yet.</div>';
  }

  function isWorshipLeaderFor(s){
    return (s.worship_schedule_assignments||[]).some(x=>x.member_id===profile.member_id && norm(x.ministry_role)==='worship leader');
  }

  async function renderSchedules(){
    const root=$('#worshipScheduleRoot');if(!root)return;
    root.innerHTML='<div class="wm-card"><div class="wm-empty">Loading ministry schedule…</div></div>';
    try{
      await Promise.all([loadSchedules(),canManage?loadMembers():Promise.resolve([])]);
      const ordered=schedules.slice().sort((a,b)=>a.service_date.localeCompare(b.service_date));
      const upcoming=ordered.filter(x=>x.service_date>=todayPH());
      const recent=ordered.filter(x=>x.service_date<todayPH()).slice(-6).reverse();
      root.innerHTML=`
        <div class="wm-hero"><div><h2>Schedule of Ministers</h2><div class="wm-muted">Sunday worship team assignments for Worship Ministry, Creative Arts, Music Ministry and Band Ministry.</div></div><span class="wm-pill">Restricted ministry access</span></div>
        ${canManage?`<div class="wm-card" style="margin-bottom:14px"><h3>Create Sunday Schedule</h3><form id="wmScheduleForm" class="wm-form"><div class="wm-row"><div><label>Sunday / Service Date</label><input type="date" name="service_date" min="${todayPH()}" required></div><div><label>Service Name</label><input name="service_name" value="Sunday Worship Service" required></div></div><div><label>Notes</label><textarea name="notes" rows="2" placeholder="Call time, rehearsal notes, special instructions…"></textarea></div><div class="wm-actions"><button class="wm-btn" type="submit">Create Schedule</button></div></form></div>`:''}
        <div class="wm-grid">
          <div class="wm-card"><h3>Upcoming Sundays</h3><div class="wm-schedule-list">${upcoming.map(renderScheduleCard).join('')||'<div class="wm-empty">No upcoming worship schedule yet.</div>'}</div></div>
          <div class="wm-card"><h3>Recent Schedules</h3><div class="wm-schedule-list">${recent.map(renderScheduleCard).join('')||'<div class="wm-empty">No previous schedules yet.</div>'}</div></div>
        </div>
        <div id="wmScheduleEditor" class="wm-editor"></div>`;
      bindScheduleEvents();
    }catch(e){console.error(e);root.innerHTML=`<div class="wm-card"><h3>Unable to load schedule</h3><div class="wm-muted">${esc(e.message||e)}</div></div>`;}
  }

  function renderScheduleCard(s){
    return `<div class="wm-service" data-schedule-card="${s.id}"><div class="wm-service-head"><div><div class="wm-date">${esc(datePH(s.service_date))}</div><div class="wm-muted">${esc(s.service_name||'Sunday Worship Service')}</div></div><div class="wm-actions">${canManage?`<button class="wm-btn secondary" data-edit-schedule="${s.id}">Manage</button>`:''}${isWorshipLeaderFor(s)?'<span class="wm-pill">You are Worship Leader</span>':''}</div></div>${s.notes?`<div class="wm-muted" style="margin-bottom:8px">${esc(s.notes)}</div>`:''}<div class="wm-role-list">${assignmentRows(s)}</div></div>`;
  }

  function bindScheduleEvents(){
    $('#wmScheduleForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;
      try{
        const payload={service_date:f.get('service_date'),service_name:String(f.get('service_name')||'Sunday Worship Service').trim(),notes:String(f.get('notes')||'').trim()||null,created_by:user.id,updated_at:new Date().toISOString()};
        const r=await sb.from('worship_service_schedules').insert(payload);if(r.error)throw r.error;toast('Sunday worship schedule created.');await renderSchedules();
      }catch(err){toast(err.message||'Unable to create schedule.')}finally{btn.disabled=false;}
    });
    $$('[data-edit-schedule]').forEach(b=>b.addEventListener('click',()=>openScheduleEditor(b.dataset.editSchedule)));
  }

  async function openScheduleEditor(id){
    if(!canManage)return;const s=schedules.find(x=>x.id===id);if(!s)return;await loadMembers();
    const activeMembers=members.filter(m=>m.is_active!==false && norm(m.status)!=='inactive').sort((a,b)=>memberName(a).localeCompare(memberName(b)));
    const ed=$('#wmScheduleEditor');if(!ed)return;
    ed.innerHTML=`<div class="wm-card"><div class="wm-service-head"><div><h3 style="margin:0">Manage Ministers — ${esc(datePH(s.service_date))}</h3><div class="wm-muted">Add or remove assignments for this Sunday.</div></div><button class="wm-btn secondary" id="wmCloseEditor">Close</button></div><form id="wmAddAssignment" class="wm-form"><div class="wm-assignment-row"><div><label>Role</label><select name="ministry_role">${ROLE_OPTIONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div><div><label>Minister</label><select name="member_id" required><option value="">Select member</option>${activeMembers.map(m=>`<option value="${m.id}">${esc(memberName(m))}</option>`).join('')}</select></div><div><label>Notes</label><input name="notes" placeholder="Optional"></div><div><button class="wm-btn" type="submit">Add</button></div></div></form><div class="wm-role-list" style="margin-top:10px">${(s.worship_schedule_assignments||[]).map(a=>`<div class="wm-role" style="grid-template-columns:150px 1fr auto"><b>${esc(a.ministry_role)}</b><span>${esc(memberName(a.members))}${a.notes?`<small class="wm-muted" style="display:block">${esc(a.notes)}</small>`:''}</span><button class="wm-btn secondary" data-remove-assignment="${a.id}">Remove</button></div>`).join('')||'<div class="wm-empty">No ministers assigned yet.</div>'}</div></div>`;
    $('#wmCloseEditor',ed).addEventListener('click',()=>ed.innerHTML='');
    $('#wmAddAssignment',ed).addEventListener('submit',async e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;
      try{const r=await sb.from('worship_schedule_assignments').insert({schedule_id:id,member_id:f.get('member_id'),ministry_role:f.get('ministry_role'),notes:String(f.get('notes')||'').trim()||null});if(r.error)throw r.error;toast('Minister assigned.');await renderSchedules();setTimeout(()=>openScheduleEditor(id),0);}catch(err){toast(err.message||'Unable to assign minister.')}finally{btn.disabled=false;}
    });
    $$('[data-remove-assignment]',ed).forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Remove this ministry assignment from the Sunday schedule?'))return;const r=await sb.from('worship_schedule_assignments').delete().eq('id',b.dataset.removeAssignment);if(r.error){toast(r.error.message);return;}toast('Assignment removed.');await renderSchedules();setTimeout(()=>openScheduleEditor(id),0);}));
    ed.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function loadLineups(){
    const lr=await sb.from('worship_lineups').select('id,schedule_id,worship_leader_member_id,status,offertory_title,offertory_artist,offertory_key,offertory_reference_url,offertory_notes,revision_note,submitted_at,approved_at,created_at,updated_at,worship_lineup_songs(id,position,title,artist,song_key,reference_url,notes)').order('updated_at',{ascending:false}).limit(100);
    if(lr.error)throw lr.error;return lr.data||[];
  }

  async function renderLineups(){
    const root=$('#worshipLineupRoot');if(!root)return;root.innerHTML='<div class="wm-card"><div class="wm-empty">Loading worship line-ups…</div></div>';
    try{
      const [,lineups]=await Promise.all([loadSchedules(),loadLineups()]);
      const lmap=new Map(lineups.map(x=>[x.schedule_id,x]));
      const relevant=schedules.slice().sort((a,b)=>b.service_date.localeCompare(a.service_date)).filter(s=>s.service_date>=todayPH() || lmap.has(s.id)).slice(0,16);
      root.innerHTML=`<div class="wm-hero"><div><h2>Worship Line-Up</h2><div class="wm-muted">Worship Leaders can submit up to six Sunday songs, plus an optional offertory song.</div></div><span class="wm-pill">Maximum 6 worship songs</span></div><div class="wm-grid">${relevant.map(s=>renderLineupCard(s,lmap.get(s.id))).join('')||'<div class="wm-card"><div class="wm-empty">Create a Sunday schedule first before submitting a line-up.</div></div>'}</div><div id="wmLineupEditor" class="wm-editor"></div>`;
      $$('[data-edit-lineup]').forEach(b=>b.addEventListener('click',()=>openLineupEditor(b.dataset.editLineup)));
      $$('[data-approve-lineup]').forEach(b=>b.addEventListener('click',()=>setLineupStatus(b.dataset.approveLineup,'Approved')));
      $$('[data-revise-lineup]').forEach(b=>b.addEventListener('click',()=>requestRevision(b.dataset.reviseLineup)));
    }catch(e){console.error(e);root.innerHTML=`<div class="wm-card"><h3>Unable to load line-ups</h3><div class="wm-muted">${esc(e.message||e)}</div></div>`;}
  }

  function statusPill(status){const cls=status==='Approved'?'approved':status==='Submitted'?'submitted':status==='Needs Revision'?'revision':'';return `<span class="wm-pill ${cls}">${esc(status||'Draft')}</span>`;}
  function renderLineupCard(s,l){
    const wl=(s.worship_schedule_assignments||[]).filter(a=>norm(a.ministry_role)==='worship leader').map(a=>memberName(a.members)).join(', ')||'Not assigned';
    const songs=(l?.worship_lineup_songs||[]).slice().sort((a,b)=>a.position-b.position);
    const editable=canManage||isWorshipLeaderFor(s);
    return `<div class="wm-card"><div class="wm-service-head"><div><h3>${esc(datePH(s.service_date))}</h3><div class="wm-muted">Worship Leader: ${esc(wl)}</div></div>${l?statusPill(l.status):'<span class="wm-pill">No line-up</span>'}</div>${l?`<div class="wm-lineup-summary">${songs.map(x=>`<div class="wm-lineup-song"><span class="wm-num">${x.position}</span><span><b>${esc(x.title)}</b>${x.artist?`<small class="wm-muted" style="display:block">${esc(x.artist)}</small>`:''}</span><span class="wm-muted">${esc(x.song_key||'')}</span></div>`).join('')||'<div class="wm-empty" style="padding:8px 0">No worship songs added yet.</div>'}${l.offertory_title?`<div class="wm-lineup-song"><span class="wm-num">₱</span><span><b>${esc(l.offertory_title)}</b><small class="wm-muted" style="display:block">Offertory${l.offertory_artist?' · '+esc(l.offertory_artist):''}</small></span><span class="wm-muted">${esc(l.offertory_key||'')}</span></div>`:''}</div>`:'<div class="wm-empty" style="padding:8px 0">No line-up submitted for this service.</div>'}<div class="wm-actions" style="margin-top:11px">${editable?`<button class="wm-btn" data-edit-lineup="${s.id}">${l?'Open / Edit Line-Up':'Create Line-Up'}</button>`:''}${canManage&&l?.status==='Submitted'?`<button class="wm-btn secondary" data-approve-lineup="${l.id}">Approve</button><button class="wm-btn secondary" data-revise-lineup="${l.id}">Needs Revision</button>`:''}</div>${l?.revision_note?`<div class="wm-muted" style="margin-top:8px"><b>Revision note:</b> ${esc(l.revision_note)}</div>`:''}</div>`;
  }

  async function openLineupEditor(scheduleId){
    const s=schedules.find(x=>x.id===scheduleId);if(!s)return;if(!(canManage||isWorshipLeaderFor(s))){toast('Only the assigned Worship Leader or a ministry manager can edit this line-up.');return;}
    const lineups=await loadLineups();let l=lineups.find(x=>x.schedule_id===scheduleId)||null;
    const songs=(l?.worship_lineup_songs||[]).slice().sort((a,b)=>a.position-b.position);
    const values=Array.from({length:6},(_,i)=>songs.find(x=>x.position===i+1)||{});
    const ed=$('#wmLineupEditor');if(!ed)return;
    ed.innerHTML=`<div class="wm-card"><div class="wm-service-head"><div><h3 style="margin:0">Worship Line-Up — ${esc(datePH(s.service_date))}</h3><div class="wm-muted">Add up to six worship songs. Leave unused rows blank.</div></div><button class="wm-btn secondary" id="wmCloseLineup">Close</button></div><form id="wmLineupForm" class="wm-form">${values.map((x,i)=>`<div class="wm-song"><div class="wm-song-title"><span>Song ${i+1}</span><span class="wm-muted">Worship</span></div><div class="wm-song-grid"><div><label>Song Title</label><input name="song_${i+1}_title" value="${esc(x.title||'')}" placeholder="Song title"></div><div><label>Artist / Original Team</label><input name="song_${i+1}_artist" value="${esc(x.artist||'')}" placeholder="Artist"></div><div><label>Key</label><input name="song_${i+1}_key" value="${esc(x.song_key||'')}" placeholder="G"></div><div class="wide"><label>YouTube / Reference Link</label><input type="url" name="song_${i+1}_url" value="${esc(x.reference_url||'')}" placeholder="https://…"></div><div class="wide"><label>Notes</label><input name="song_${i+1}_notes" value="${esc(x.notes||'')}" placeholder="Intro, transition, arrangement notes…"></div></div></div>`).join('')}<div class="wm-offertory"><h4>Optional Offertory Song</h4><div class="wm-song-grid"><div><label>Song Title</label><input name="offertory_title" value="${esc(l?.offertory_title||'')}" placeholder="Offertory song"></div><div><label>Artist</label><input name="offertory_artist" value="${esc(l?.offertory_artist||'')}"></div><div><label>Key</label><input name="offertory_key" value="${esc(l?.offertory_key||'')}"></div><div class="wide"><label>YouTube / Reference Link</label><input type="url" name="offertory_reference_url" value="${esc(l?.offertory_reference_url||'')}" placeholder="https://…"></div><div class="wide"><label>Notes</label><input name="offertory_notes" value="${esc(l?.offertory_notes||'')}"></div></div></div><div class="wm-actions"><button class="wm-btn secondary" type="button" data-save-status="Draft">Save Draft</button><button class="wm-btn" type="button" data-save-status="Submitted">Submit Line-Up</button></div></form></div>`;
    $('#wmCloseLineup',ed).addEventListener('click',()=>ed.innerHTML='');
    $$('[data-save-status]',ed).forEach(b=>b.addEventListener('click',()=>saveLineup(scheduleId,l,b.dataset.saveStatus,b)));
    ed.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function saveLineup(scheduleId,existing,status,btn){
    const form=$('#wmLineupForm');if(!form)return;const f=new FormData(form);btn.disabled=true;
    try{
      const titles=Array.from({length:6},(_,i)=>String(f.get(`song_${i+1}_title`)||'').trim());
      const nonEmpty=titles.filter(Boolean);if(nonEmpty.length>6)throw new Error('A worship line-up can contain no more than six songs.');
      if(status==='Submitted' && nonEmpty.length===0)throw new Error('Add at least one worship song before submitting.');
      const s=schedules.find(x=>x.id===scheduleId);const wl=(s?.worship_schedule_assignments||[]).find(a=>norm(a.ministry_role)==='worship leader');
      const payload={schedule_id:scheduleId,worship_leader_member_id:wl?.member_id||profile.member_id,status,offertory_title:String(f.get('offertory_title')||'').trim()||null,offertory_artist:String(f.get('offertory_artist')||'').trim()||null,offertory_key:String(f.get('offertory_key')||'').trim()||null,offertory_reference_url:String(f.get('offertory_reference_url')||'').trim()||null,offertory_notes:String(f.get('offertory_notes')||'').trim()||null,revision_note:status==='Submitted'?null:(existing?.revision_note||null),submitted_at:status==='Submitted'?new Date().toISOString():(existing?.submitted_at||null),updated_by:user.id,updated_at:new Date().toISOString()};
      let lineupId=existing?.id;
      if(lineupId){const r=await sb.from('worship_lineups').update(payload).eq('id',lineupId);if(r.error)throw r.error;}
      else{payload.created_by=user.id;const r=await sb.from('worship_lineups').insert(payload).select('id').single();if(r.error)throw r.error;lineupId=r.data.id;}
      const del=await sb.from('worship_lineup_songs').delete().eq('lineup_id',lineupId);if(del.error)throw del.error;
      const songRows=[];
      for(let i=1;i<=6;i++){
        const title=String(f.get(`song_${i}_title`)||'').trim();if(!title)continue;
        songRows.push({lineup_id:lineupId,position:songRows.length+1,title,artist:String(f.get(`song_${i}_artist`)||'').trim()||null,song_key:String(f.get(`song_${i}_key`)||'').trim()||null,reference_url:String(f.get(`song_${i}_url`)||'').trim()||null,notes:String(f.get(`song_${i}_notes`)||'').trim()||null});
      }
      if(songRows.length){const ins=await sb.from('worship_lineup_songs').insert(songRows);if(ins.error)throw ins.error;}
      toast(status==='Submitted'?'Worship line-up submitted.':'Draft saved.');await renderLineups();
    }catch(err){console.error(err);toast(err.message||'Unable to save line-up.')}finally{btn.disabled=false;}
  }

  async function setLineupStatus(id,status){
    if(!canManage)return;const payload={status,revision_note:null,approved_at:status==='Approved'?new Date().toISOString():null,approved_by:status==='Approved'?user.id:null,updated_by:user.id,updated_at:new Date().toISOString()};const r=await sb.from('worship_lineups').update(payload).eq('id',id);if(r.error){toast(r.error.message);return;}toast('Line-up approved.');await renderLineups();
  }
  async function requestRevision(id){
    if(!canManage)return;const note=prompt('What should the Worship Leader revise?');if(note===null)return;const r=await sb.from('worship_lineups').update({status:'Needs Revision',revision_note:String(note).trim()||'Please review the line-up.',approved_at:null,approved_by:null,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',id);if(r.error){toast(r.error.message);return;}toast('Revision requested.');await renderLineups();
  }

  async function init(){
    try{
      addStyles();
      if(!await getContext()){cleanup();return;}
      mountViews();mountNav();
      if(location.hash==='#worship-schedule')showModule('schedule');
      if(location.hash==='#worship-lineup')showModule('lineup');
      const obs=new MutationObserver(()=>{if(canAccess && !$('.vccf-worship-nav-group'))mountNav();});
      const nav=$('.nav');if(nav)obs.observe(nav,{childList:true,subtree:true});
    }catch(e){console.warn('Worship Ministry module init failed:',e);cleanup();}
  }

  function cleanup(){
    $('.vccf-worship-nav-group')?.remove();$('#worshipScheduleView')?.remove();$('#worshipLineupView')?.remove();canAccess=false;canManage=false;
  }

  window.addEventListener('vccf-app-ready',init);
  window.addEventListener('vccf-signed-out',cleanup);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,350));else setTimeout(init,350);
})();
