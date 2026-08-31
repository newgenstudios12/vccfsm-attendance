(() => {
  'use strict';
  if (window.__VCCF_CHURCH_SUITE__) return;
  window.__VCCF_CHURCH_SUITE__ = true;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money = (v) => '₱' + Number(v || 0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const datePH = (v) => v ? new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(v+'T12:00:00+08:00')) : '—';
  const todayPH = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const client = () => window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  let sb, me, profile, members=[], areas=[], tab='overview', dataCache={};
  const toast = (msg) => { const t=document.getElementById('toast'); if(t){t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);} };
  const role = () => String(profile?.role || '').toLowerCase();
  const isAdmin = () => ['admin','pastor'].includes(role());
  const isLeader = () => ['admin','pastor','area_leader'].includes(role());
  const myMemberId = () => profile?.member_id || null;
  const memberName = (m) => m?.display_name || [m?.first_name,m?.last_name].filter(Boolean).join(' ') || 'Unnamed member';
  const areaName = (id) => areas.find(a=>a.id===id)?.name || 'Unassigned';
  const q = (s,ctx=document) => ctx.querySelector(s);

  const css = `
  #vccfSuite{--suite-gap:14px;margin-top:4px}
  #vccfSuite *{box-sizing:border-box}.suite-tabs{display:flex;gap:7px;overflow:auto;padding:4px 0 13px;margin-bottom:3px;scrollbar-width:thin}
  .suite-tabs button{border:1px solid var(--line);background:var(--panel);color:var(--muted);white-space:nowrap;padding:9px 12px;border-radius:11px;font-weight:800;font-size:.78rem}
  .suite-tabs button.active{background:var(--brand-gradient);color:#fff;border-color:transparent}
  .suite-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--suite-gap)}
  .suite-grid.two{grid-template-columns:1.1fr .9fr}.suite-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.suite-card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px;min-width:0;box-shadow:0 8px 26px rgba(16,24,40,.04)}
  .suite-card h3{margin:0 0 10px;font-size:1rem;letter-spacing:-.02em}.suite-card h4{margin:0 0 8px}.suite-kpi{font-size:1.65rem;font-weight:900;letter-spacing:-.04em}.suite-muted{color:var(--muted);font-size:.82rem}.suite-list{display:grid;gap:8px}.suite-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.suite-row:last-child{border-bottom:0}.suite-pill{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#6d45e814;color:var(--brand);font-size:.72rem;font-weight:850}
  .suite-actions{display:flex;gap:8px;flex-wrap:wrap}.suite-actions .btn{font-size:.78rem;padding:9px 11px}.suite-form{display:grid;gap:10px}.suite-form .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.suite-form label{font-size:.73rem;font-weight:800;margin-bottom:4px;display:block}.suite-form input,.suite-form select,.suite-form textarea{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:10px;padding:10px 11px}.suite-form textarea{resize:vertical}.suite-table{width:100%;border-collapse:collapse;font-size:.8rem}.suite-table th,.suite-table td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.suite-table th{font-size:.68rem;text-transform:uppercase;color:var(--muted);letter-spacing:.06em}.suite-tablewrap{overflow:auto;border:1px solid var(--line);border-radius:13px}.suite-search{width:100%;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:10px 12px}.suite-profile{display:grid;grid-template-columns:86px 1fr;gap:14px;align-items:start}.suite-avatar{width:86px;height:86px;border-radius:20px;object-fit:cover;background:#d7192014;display:grid;place-items:center;font-weight:900;color:var(--brand);overflow:hidden;font-size:1.2rem}.suite-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.suite-label{font-size:.67rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:800}.suite-value{font-weight:800}.suite-calendar{display:grid;gap:9px}.suite-event{display:grid;grid-template-columns:58px 1fr auto;gap:11px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:10px}.suite-datebox{border-radius:11px;background:var(--bg);text-align:center;padding:7px}.suite-datebox b{font-size:1rem;display:block}.suite-datebox small{font-size:.6rem;text-transform:uppercase;color:var(--muted)}.suite-meter{height:8px;border-radius:99px;background:var(--bg);overflow:hidden}.suite-meter>span{display:block;height:100%;background:var(--brand-gradient);border-radius:99px}.suite-empty{color:var(--muted);padding:16px 0;text-align:center}.suite-callout{border:1px solid #ffd6d6;background:linear-gradient(135deg,#fff8f7,#fff);border-radius:14px;padding:12px}.suite-callout strong{display:block;margin-bottom:4px}.suite-danger{color:#b42318}.suite-success{color:#027a48}
  @media(max-width:1050px){.suite-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.suite-grid.three{grid-template-columns:1fr 1fr}.suite-grid.two{grid-template-columns:1fr}}
  @media(max-width:700px){#vccfSuite{margin-top:0}.suite-grid,.suite-grid.three,.suite-grid.two{grid-template-columns:1fr}.suite-form .row{grid-template-columns:1fr}.suite-profile{grid-template-columns:66px 1fr}.suite-avatar{width:66px;height:66px;border-radius:16px}.suite-profile-grid{grid-template-columns:1fr}.suite-tabs{padding-bottom:10px}.suite-tabs button{font-size:.72rem;padding:8px 10px}.suite-event{grid-template-columns:48px 1fr}.suite-event .suite-actions{grid-column:2}.suite-event .btn{width:100%}}
  @media(max-width:480px){.suite-card{padding:13px;border-radius:15px}.suite-kpi{font-size:1.4rem}.suite-actions .btn{flex:1 1 130px}}
  `;

  function addStyle(){ if(!document.getElementById('vccf-suite-css')){const s=document.createElement('style');s.id='vccf-suite-css';s.textContent=css;document.head.appendChild(s);} }

  async function init(){
    try{
      addStyle(); sb=client();
      const {data:{user}}=await sb.auth.getUser(); if(!user) return;
      me=user;
      const pr=await sb.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle();
      if(pr.error) throw pr.error; profile=pr.data||{};
      const [mr,ar]=await Promise.all([
        sb.from('members').select('id,member_code,first_name,last_name,display_name,address,area_id,birth_date,photo_url,is_active,status,member_type,member_category,created_at').order('last_name'),
        sb.from('areas').select('id,name,is_active').order('name')
      ]);
      members=mr.data||[]; areas=ar.data||[];
      mountNav(); mountView(); await render();
    }catch(e){console.warn('VCCF management suite init:',e)}
  }

  function mountNav(){
    const nav=q('.nav'); if(!nav || q('[data-suite-nav]',nav)) return;
    const b=document.createElement('button'); b.type='button'; b.dataset.suiteNav='1'; b.innerHTML='⛪ <span>Church Management</span>'; b.title='Church Management';
    b.style.cssText='display:flex;align-items:center;gap:9px';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation(); showSuite();});
    nav.appendChild(b);
    const compact=()=>{ if(window.innerWidth<=900)b.style.justifyContent='center'; else b.style.justifyContent='flex-start'; };
    compact(); window.addEventListener('resize',compact,{passive:true});
    const side=q('.sidebar'); if(side){side.style.overflowY='auto';side.style.overscrollBehavior='contain';side.style.scrollbarGutter='stable';}
    if(nav){nav.style.maxHeight='calc(100vh - 155px)';nav.style.overflowY='auto';nav.style.overscrollBehavior='contain';}
  }

  function mountView(){
    if(q('#churchSuiteView')) return;
    const main=q('.main') || document.body;
    const v=document.createElement('section'); v.id='churchSuiteView';v.className='view';
    v.innerHTML='<div id="vccfSuite"></div>';
    main.appendChild(v);
  }

  function showSuite(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const v=q('#churchSuiteView'); if(v)v.classList.add('active');
    document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
    const n=q('[data-suite-nav]'); if(n)n.classList.add('active');
    render(); window.scrollTo({top:0,behavior:'smooth'});
  }

  async function render(){
    const root=q('#vccfSuite'); if(!root) return;
    const tabs=[['overview','Overview','▦'],['members','Members 360','♙'],['giving','Giving','₱'],['care','Pastoral Care','♡'],['prayer','Prayer','†'],['ministries','Ministries','★'],['events','Calendar & Events','◷'],['qr','QR Attendance','▣'],['documents','Documents','□'],['reports','Reports','↗']];
    const allowed=tabs.filter(([id])=>!((id==='giving')&&!isAdmin())||id!=='giving');
    if(!isAdmin() && tab==='giving')tab='overview';
    root.innerHTML=`<div class="suite-tabs">${allowed.map(x=>`<button data-tab="${x[0]}" class="${tab===x[0]?'active':''}">${x[2]} ${x[1]}</button>`).join('')}</div><div id="suiteContent"></div>`;
    q('.suite-tabs',root).addEventListener('click',async e=>{const b=e.target.closest('button[data-tab]');if(!b)return;tab=b.dataset.tab;await render();});
    const c=q('#suiteContent');
    try{
      if(tab==='overview') c.innerHTML=await overview();
      if(tab==='members') c.innerHTML=await members360();
      if(tab==='giving') c.innerHTML=await giving();
      if(tab==='care') c.innerHTML=await care();
      if(tab==='prayer') c.innerHTML=await prayer();
      if(tab==='ministries') c.innerHTML=await ministries();
      if(tab==='events') c.innerHTML=await events();
      if(tab==='qr') c.innerHTML=await qr();
      if(tab==='documents') c.innerHTML=await documents();
      if(tab==='reports') c.innerHTML=await reports();
      bindTab();
    }catch(e){c.innerHTML=`<div class="suite-card suite-danger"><b>Unable to load this module.</b><div class="suite-muted">${esc(e.message||e)}</div></div>`;console.error(e)}
  }

  async function loadBasic(){
    const [att,ev,pr]=await Promise.all([
      sb.from('attendance').select('member_id,area_id,checked_in_at').order('checked_in_at',{ascending:false}).limit(5000),
      sb.from('special_events').select('id,title,description,event_date,event_time,location').gte('event_date',todayPH()).order('event_date').limit(30),
      sb.from('pastoral_followups').select('id,member_id,status,reason,followup_on').neq('status','Resolved').limit(500)
    ]);
    return {attendance:att.data||[],events:ev.data||[],followups:pr.data||[]};
  }

  async function overview(){
    const b=await loadBasic(), total=members.length, active=members.filter(m=>m.is_active&&String(m.status).toLowerCase()!=='inactive').length;
    const today=todayPH(); const attendedToday=new Set(b.attendance.filter(a=>String(a.checked_in_at||'').slice(0,10)===today).map(a=>a.member_id)).size;
    const upcoming=b.events.slice(0,5), open=b.followups.length;
    const myAtt=myMemberId()?b.attendance.filter(a=>a.member_id===myMemberId()).length:0;
    let giveCard='';
    if(isAdmin()){
      const g=await sb.from('giving_records').select('amount,given_on,giving_type').gte('given_on',today.slice(0,7)+'-01');
      const totalGiving=(g.data||[]).reduce((s,r)=>s+Number(r.amount||0),0);giveCard=`<div class="suite-card"><div class="suite-muted">Giving this month</div><div class="suite-kpi">${money(totalGiving)}</div><div class="suite-muted">Authorized personnel only</div></div>`;
    } else {
      const g=await sb.from('giving_records').select('amount,given_on').eq('member_id',myMemberId()||'00000000-0000-0000-0000-000000000000').gte('given_on',today.slice(0,7)+'-01');
      const totalGiving=(g.data||[]).reduce((s,r)=>s+Number(r.amount||0),0);giveCard=`<div class="suite-card"><div class="suite-muted">My giving this month</div><div class="suite-kpi">${money(totalGiving)}</div><div class="suite-muted">Private to your account</div></div>`;
    }
    return `<div class="suite-grid">
      <div class="suite-card"><div class="suite-muted">Total Members</div><div class="suite-kpi">${total}</div><div class="suite-muted">Active: ${active}</div></div>
      <div class="suite-card"><div class="suite-muted">Recent Check-ins</div><div class="suite-kpi">${attendedToday}</div><div class="suite-muted">Records today</div></div>
      <div class="suite-card"><div class="suite-muted">Upcoming Events</div><div class="suite-kpi">${upcoming.length}</div><div class="suite-muted">Next 30 days</div></div>
      <div class="suite-card"><div class="suite-muted">Follow-ups</div><div class="suite-kpi">${open}</div><div class="suite-muted">Open leadership tasks</div></div>
      ${giveCard}
      <div class="suite-card"><h3>Quick Actions</h3><div class="suite-actions"><button class="btn" data-go="members">Open Member 360</button><button class="btn secondary" data-go="events">Calendar</button>${isLeader()?'<button class="btn secondary" data-go="care">Follow-up</button>':''}<button class="btn secondary" data-go="prayer">Prayer Request</button><button class="btn secondary" data-go="qr">My QR</button></div></div>
    </div>
    <div class="suite-grid two" style="margin-top:14px">
      <div class="suite-card"><h3>Upcoming Events</h3><div class="suite-calendar">${upcoming.map(eventRow).join('')||'<div class="suite-empty">No upcoming events.</div>'}</div></div>
      <div class="suite-card"><h3>Engagement Attention</h3>${engagementAttention(b.attendance)}</div>
    </div>`;
  }

  function engagementAttention(att){
    const by=new Map(); (att||[]).forEach(a=>{const d=new Date(a.checked_in_at);if(!Number.isNaN(d.getTime())){const id=a.member_id; const old=by.get(id);if(!old||d>old)by.set(id,d);}});
    const cutoff=Date.now()-35*864e5; const flagged=members.filter(m=>m.is_active&&(!by.has(m.id)||by.get(m.id).getTime()<cutoff)).slice(0,8);
    if(!isLeader()) return `<div class="suite-callout"><strong>Your engagement</strong><span class="suite-muted">${myMemberId()?'Keep connected through attendance, events, and ministry participation.':'Your member profile is not linked yet; ask an administrator to link it.'}</span></div>`;
    return flagged.length?`<div class="suite-list">${flagged.map(m=>`<div class="suite-row"><span>${esc(memberName(m))}<small class="suite-muted">${esc(areaName(m.area_id))}</small></span><button class="btn secondary" data-member="${m.id}">View</button></div>`).join('')}</div>`:'<div class="suite-success">No immediate follow-up flags from attendance data.</div>';
  }

  function eventRow(e){const d=new Date(e.event_date+'T12:00:00+08:00');return `<div class="suite-event"><div class="suite-datebox"><b>${d.getDate()}</b><small>${d.toLocaleDateString('en-PH',{month:'short'})}</small></div><div><b>${esc(e.title)}</b><div class="suite-muted">${esc(e.location||'Church venue')} ${e.event_time?'· '+esc(e.event_time.slice(0,5)):''}</div></div><button class="btn secondary" data-event="${e.id}">Open</button></div>`;}

  async function members360(){
    const own=myMemberId();
    const visible=isAdmin()?members:(role()==='area_leader'?members.filter(m=>m.area_id===profile.area_id):(own?members.filter(m=>m.id===own):[]));
    const active=visible.filter(m=>m.is_active).length, inactive=visible.length-active;
    return `<div class="suite-grid two"><div class="suite-card"><h3>Member 360</h3><input id="memberSearch" class="suite-search" placeholder="Search member, code, barangay…"><div class="suite-muted" style="margin-top:7px">${visible.length} visible members · ${active} active · ${inactive} inactive</div><div id="memberResults" class="suite-list" style="margin-top:10px;max-height:520px;overflow:auto">${memberResults(visible)}</div></div><div id="memberDetail" class="suite-card"><div class="suite-empty">Select a member to view their 360° profile.</div></div></div>`;
  }

  function memberResults(list){return (list||[]).slice(0,80).map(m=>`<button type="button" class="suite-row" style="background:none;border:0;width:100%;text-align:left;color:var(--text)" data-member="${m.id}"><span><b>${esc(memberName(m))}</b><small class="suite-muted" style="display:block">${esc(areaName(m.area_id))} · ${esc(m.status||'')}</small></span><span class="suite-pill">${m.is_active?'Active':'Inactive'}</span></button>`).join('')||'<div class="suite-empty">No members found.</div>';}

  async function loadMemberDetail(id){
    const m=members.find(x=>x.id===id);if(!m)return;
    const [sp,mm,att,fu,pr,g]=await Promise.all([
      sb.from('member_spiritual_profiles').select('*').eq('member_id',id).maybeSingle(),
      sb.from('member_ministries').select('id,role_title,joined_on,ministry_id,ministries(name)').eq('member_id',id),
      sb.from('attendance').select('checked_in_at').eq('member_id',id).order('checked_in_at',{ascending:false}).limit(250),
      sb.from('pastoral_followups').select('id,status,reason,followup_on,notes').eq('member_id',id).order('created_at',{ascending:false}).limit(20),
      sb.from('prayer_requests').select('id,request_text,status,created_at').eq('member_id',id).order('created_at',{ascending:false}).limit(10),
      sb.from('giving_records').select('amount,given_on,giving_type').eq('member_id',id).order('given_on',{ascending:false}).limit(40)
    ]);
    const months=8, recentCut=Date.now()-months*7*864e5, recent=(att.data||[]).filter(a=>new Date(a.checked_in_at).getTime()>=recentCut);
    const score=Math.min(100,Math.round((recent.length/(months||1))*70+(mm.data?.length?20:0)+(sp.data?.discipleship_status?10:0)));
    const totalGiving=isAdmin()||id===own?(g.data||[]).reduce((s,r)=>s+Number(r.amount||0),0):null;
    const detail=q('#memberDetail'); if(!detail)return;
    detail.innerHTML=`<div class="suite-profile"><div class="suite-avatar">${m.photo_url?`<img src="${esc(m.photo_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`:esc(memberName(m).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div><h3 style="margin:0 0 4px">${esc(memberName(m))}</h3><div class="suite-muted">${esc(m.member_code||'No code')} · ${esc(areaName(m.area_id))} · ${esc(m.member_type||'Member')}</div><div class="suite-actions" style="margin-top:9px"><button class="btn secondary" data-go="qr" data-qr-member="${m.id}">QR</button>${isLeader()?`<button class="btn secondary" data-go="care" data-care-member="${m.id}">Follow-up</button>`:''}</div></div></div>
    <div class="suite-profile-grid" style="margin-top:14px"><div><span class="suite-label">Status</span><div class="suite-value">${esc(m.status||'')}</div></div><div><span class="suite-label">Birth date</span><div class="suite-value">${datePH(m.birth_date)}</div></div><div><span class="suite-label">Address</span><div class="suite-value">${esc(m.address||'')}</div></div><div><span class="suite-label">Engagement</span><div class="suite-value">${score}%</div></div>${totalGiving!==null?`<div><span class="suite-label">Giving on record</span><div class="suite-value">${money(totalGiving)}</div></div>`:''}</div>
    <div style="margin-top:13px"><h4>Church Life</h4><div class="suite-muted">Ministries: ${(mm.data||[]).map(x=>esc(x.ministries?.name||'')).filter(Boolean).join(', ')||'None recorded'}</div><div class="suite-muted">Membership: ${datePH(sp.data?.membership_date)} · Baptism: ${datePH(sp.data?.baptism_date)} · Discipleship: ${esc(sp.data?.discipleship_status||'Not recorded')}</div></div>
    <div style="margin-top:13px"><h4>Recent Attendance</h4><div class="suite-muted">${recent.length} check-ins in the last ~8 weeks</div><div class="suite-meter" style="margin-top:7px"><span style="width:${Math.min(100,Math.round(recent.length/8*100))}%"></span></div></div>
    ${isLeader()?`<div style="margin-top:13px"><h4>Pastoral Follow-up</h4>${(fu.data||[]).slice(0,5).map(x=>`<div class="suite-row"><span>${esc(x.reason)}<small class="suite-muted" style="display:block">${esc(x.status)} · ${datePH(x.followup_on)}</small></span></div>`).join('')||'<div class="suite-muted">No open history.</div>'}</div>`:''}
    ${(pr.data||[]).length?`<div style="margin-top:13px"><h4>Prayer Requests</h4>${(pr.data||[]).slice(0,4).map(x=>`<div class="suite-row"><span>${esc(x.request_text)}<small class="suite-muted" style="display:block">${esc(x.status)}</small></span></div>`).join('')}</div>`:''}`;
  }

  async function giving(){
    if(!isAdmin()) return '<div class="suite-card"><b>Giving access is restricted.</b><div class="suite-muted">Members may view only their own giving from the Overview. Authorized finance/pastoral roles can record and report church giving.</div></div>';
    const {data,error}=await sb.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes').order('given_on',{ascending:false}).limit(300);
    if(error)throw error; dataCache.giving=data||[];
    const month=todayPH().slice(0,7); const monthTotal=(data||[]).filter(x=>String(x.given_on).slice(0,7)===month).reduce((s,x)=>s+Number(x.amount||0),0);
    const totals={};(data||[]).forEach(x=>totals[x.giving_type]=(totals[x.giving_type]||0)+Number(x.amount||0));
    return `<div class="suite-grid two"><div class="suite-card"><h3>Record Giving</h3><form id="givingForm" class="suite-form"><div><label>Member</label><select name="member_id" required><option value="">Select member…</option>${members.map(m=>`<option value="${m.id}">${esc(memberName(m))}</option>`).join('')}</select></div><div class="row"><div><label>Date</label><input name="given_on" type="date" value="${todayPH()}" required></div><div><label>Amount</label><input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required></div></div><div class="row"><div><label>Type</label><select name="giving_type"><option>Tithe</option><option>Offering</option><option>Missions</option><option>Building Fund</option><option>Special Offering</option><option>Other</option></select></div><div><label>Payment</label><select name="payment_method"><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Other</option></select></div></div><div class="row"><div><label>Reference no.</label><input name="reference_no"></div><div><label>Notes</label><input name="notes"></div></div><button class="btn">Save Giving Record</button></form></div>
    <div class="suite-card"><h3>Monthly Snapshot</h3><div class="suite-kpi">${money(monthTotal)}</div><div class="suite-muted">${month} total</div><div class="suite-list" style="margin-top:10px">${Object.entries(totals).slice(0,8).map(([k,v])=>`<div class="suite-row"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')}</div></div></div>
    <div class="suite-card" style="margin-top:14px"><div class="suite-actions" style="justify-content:space-between"><h3 style="margin:0">Giving Ledger</h3><button class="btn secondary" data-export="giving">Export CSV</button></div><div class="suite-tablewrap" style="margin-top:10px"><table class="suite-table"><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Payment</th><th>Ref</th></tr></thead><tbody>${(data||[]).slice(0,160).map(x=>`<tr><td>${datePH(x.given_on)}</td><td>${esc(memberName(members.find(m=>m.id===x.member_id)))}</td><td>${esc(x.giving_type)}</td><td>${money(x.amount)}</td><td>${esc(x.payment_method||'')}</td><td>${esc(x.reference_no||'')}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  async function care(){
    if(!isLeader())return '<div class="suite-card"><b>Pastoral Care</b><div class="suite-muted">This area is available to pastors, administrators, and area leaders.</div></div>';
    const {data,error}=await sb.from('pastoral_followups').select('id,member_id,status,reason,followup_type,followup_on,notes').order('followup_on',{ascending:true}).limit(250);if(error)throw error;
    dataCache.followups=data||[];
    const visible=isAdmin()?members:members.filter(m=>m.area_id===profile.area_id);
    return `<div class="suite-grid two"><div class="suite-card"><h3>Create Follow-up</h3><form id="careForm" class="suite-form"><div><label>Member</label><select name="member_id" required><option value="">Select member…</option>${visible.map(m=>`<option value="${m.id}" ${m.id===window.__VCCF_CARE_MEMBER__?'selected':''}>${esc(memberName(m))}</option>`).join('')}</select></div><div class="row"><div><label>Type</label><select name="followup_type"><option>General</option><option>Absence</option><option>Pastoral Visit</option><option>Counseling</option><option>New Believer</option><option>Prayer</option></select></div><div><label>Follow-up date</label><input name="followup_on" type="date" value="${todayPH()}"></div></div><div><label>Reason</label><input name="reason" required placeholder="Why is follow-up needed?"></div><div><label>Notes</label><textarea name="notes" rows="4"></textarea></div><button class="btn">Save Follow-up</button></form></div><div class="suite-card"><h3>Open Follow-ups</h3><div class="suite-list">${(data||[]).filter(x=>x.status!=='Resolved').slice(0,16).map(x=>`<div class="suite-row"><span><b>${esc(memberName(members.find(m=>m.id===x.member_id)))}</b><small class="suite-muted" style="display:block">${esc(x.reason)}</small></span><span class="suite-pill">${esc(x.status)}</span></div>`).join('')||'<div class="suite-empty">No open follow-ups.</div>'}</div></div></div>`;
  }

  async function prayer(){
    const {data,error}=await sb.from('prayer_requests').select('id,member_id,request_text,category,visibility,status,created_at').order('created_at',{ascending:false}).limit(150);if(error)throw error;
    dataCache.prayer=data||[];
    const canManage=isLeader();
    return `<div class="suite-grid two"><div class="suite-card"><h3>Submit Prayer Request</h3><form id="prayerForm" class="suite-form"><div><label>Category</label><select name="category"><option>Personal</option><option>Family</option><option>Work / School</option><option>Healing</option><option>Church</option><option>Other</option></select></div><div><label>Request</label><textarea name="request_text" rows="6" required placeholder="Share what you would like the church to pray for…"></textarea></div><div><label>Visibility</label><select name="visibility"><option>Private</option><option>Leaders</option><option>Public</option></select></div><button class="btn">Submit Prayer Request</button></form></div><div class="suite-card"><h3>${canManage?'Prayer Care Board':'My Prayer Requests'}</h3><div class="suite-list">${(data||[]).slice(0,20).map(x=>`<div class="suite-row"><span><b>${canManage?esc(memberName(members.find(m=>m.id===x.member_id))):'Prayer request'}</b><small class="suite-muted" style="display:block">${esc(x.request_text)}</small></span>${canManage?`<select data-prayer="${x.id}" style="border:1px solid var(--line);background:var(--bg);color:var(--text);border-radius:8px;padding:5px"><option ${x.status==='Praying'?'selected':''}>Praying</option><option ${x.status==='Follow-up Needed'?'selected':''}>Follow-up Needed</option><option ${x.status==='Answered'?'selected':''}>Answered</option></select>`:`<span class="suite-pill">${esc(x.status)}</span>`}</div>`).join('')||'<div class="suite-empty">No prayer requests yet.</div>'}</div></div></div>`;
  }

  async function ministries(){
    const [mr,mm]=await Promise.all([sb.from('ministries').select('id,name,description,is_active').order('name'),sb.from('member_ministries').select('member_id,ministry_id,role_title,ministries(name)').limit(5000)]); if(mr.error)throw mr.error;if(mm.error)throw mm.error;
    const counts=new Map();(mm.data||[]).forEach(x=>counts.set(x.ministry_id,(counts.get(x.ministry_id)||0)+1));
    return `<div class="suite-grid three">${(mr.data||[]).map(x=>`<div class="suite-card"><h3>${esc(x.name)}</h3><div class="suite-muted">${esc(x.description||'')}</div><div class="suite-kpi" style="margin-top:8px">${counts.get(x.id)||0}</div><div class="suite-muted">Members</div>${isAdmin()?`<div class="suite-actions" style="margin-top:10px"><button class="btn secondary" data-manage-ministry="${x.id}">Assign Member</button></div>`:''}</div>`).join('')}</div><div class="suite-card" style="margin-top:14px"><h3>My Ministry Involvement</h3><div class="suite-list">${(mm.data||[]).filter(x=>x.member_id===myMemberId()).map(x=>`<div class="suite-row"><span>${esc(x.ministries?.name||'')}</span><span class="suite-muted">${esc(x.role_title||'Member')}</span></div>`).join('')||'<div class="suite-empty">No ministry assignment recorded yet.</div>'}</div></div>`;
  }

  async function events(){
    const {data,error}=await sb.from('special_events').select('id,title,description,event_date,event_time,location').order('event_date').limit(100);if(error)throw error;
    const ids=(data||[]).map(x=>x.id);let regs=[];if(ids.length){const rr=await sb.from('event_registrations').select('id,event_id,member_id,status').in('event_id',ids);regs=rr.data||[];}
    const own=new Set(regs.filter(x=>x.member_id===myMemberId()).map(x=>x.event_id));
    return `<div class="suite-card"><div class="suite-actions" style="justify-content:space-between"><div><h3 style="margin:0">Church Calendar & Events</h3><div class="suite-muted">Registration, participation, and event visibility</div></div>${isAdmin()?'<button class="btn" data-new-event="1">New Event</button>':''}</div><div class="suite-calendar" style="margin-top:12px">${(data||[]).map(e=>{const count=regs.filter(r=>r.event_id===e.id&&r.status!=='Cancelled').length;return `<div class="suite-event"><div class="suite-datebox"><b>${new Date(e.event_date+'T12:00:00+08:00').getDate()}</b><small>${new Date(e.event_date+'T12:00:00+08:00').toLocaleDateString('en-PH',{month:'short'})}</small></div><div><b>${esc(e.title)}</b><div class="suite-muted">${datePH(e.event_date)} ${e.event_time?'· '+esc(e.event_time.slice(0,5)):''}${e.location?' · '+esc(e.location):''}</div><div class="suite-muted">${count} registered</div></div><div class="suite-actions">${myMemberId()?`<button class="btn ${own.has(e.id)?'secondary':''}" data-register="${e.id}">${own.has(e.id)?'Registered':'Register'}</button>`:''}${isLeader()?`<button class="btn secondary" data-event-roster="${e.id}">Roster</button>`:''}</div></div>`;}).join('')||'<div class="suite-empty">No events recorded.</div>'}</div></div>`;
  }

  async function qr(){
    const visible=isAdmin()?members:(myMemberId()?members.filter(m=>m.id===myMemberId()):[]);
    return `<div class="suite-grid two"><div class="suite-card"><h3>Attendance QR</h3><div class="suite-muted">Generate a scannable member code for attendance. Members only receive their own QR; authorized admins can generate codes for others.</div><div class="suite-form" style="margin-top:11px"><div><label>Member</label><select id="qrMember"><option value="">Select member…</option>${visible.map(m=>`<option value="${m.id}" ${window.__VCCF_QR_MEMBER__===m.id?'selected':''}>${esc(memberName(m))}</option>`).join('')}</select></div><button class="btn" id="makeQr">Generate QR</button></div><div id="qrCanvas" class="qrbox" style="margin-top:12px;min-height:240px"><div class="suite-muted">Choose a member and generate.</div></div></div><div class="suite-card"><h3>How it works</h3><div class="suite-list"><div class="suite-row"><span>1. Generate the member QR</span><span>①</span></div><div class="suite-row"><span>2. Scan at Sunday service</span><span>②</span></div><div class="suite-row"><span>3. Attendance is recorded in the existing tracker</span><span>③</span></div></div><div class="suite-callout" style="margin-top:12px"><strong>Privacy</strong><span class="suite-muted">The QR encodes only the member code needed by the attendance workflow; it does not display giving or pastoral information.</span></div></div></div>`;
  }

  async function documents(){
    const visible=isAdmin()?members:(myMemberId()?members.filter(m=>m.id===myMemberId()):[]);
    const {data,error}=await sb.from('member_documents').select('id,member_id,title,document_type,storage_path,created_at').order('created_at',{ascending:false}).limit(250);if(error)throw error;
    return `<div class="suite-grid two"><div class="suite-card"><h3>Member Documents</h3><div class="suite-muted">Private certificates, letters, and member records.</div>${isAdmin()?`<form id="docForm" class="suite-form" style="margin-top:12px"><div><label>Member</label><select name="member_id" required><option value="">Select member…</option>${visible.map(m=>`<option value="${m.id}">${esc(memberName(m))}</option>`).join('')}</select></div><div><label>Title</label><input name="title" required placeholder="Baptism Certificate"></div><div class="row"><div><label>Type</label><select name="document_type"><option>Membership</option><option>Baptism</option><option>Marriage</option><option>Attendance Certificate</option><option>Letter</option><option>Other</option></select></div><div><label>File</label><input name="file" type="file" required accept="application/pdf,image/*,.doc,.docx"></div></div><button class="btn">Upload Private Document</button></form>`:'<div class="suite-callout" style="margin-top:12px"><strong>Member access</strong><span class="suite-muted">You can only see documents linked to your own member profile.</span></div>'}</div><div class="suite-card"><h3>Available Documents</h3><div class="suite-list">${(data||[]).filter(x=>isAdmin()||x.member_id===myMemberId()).slice(0,30).map(x=>`<div class="suite-row"><span><b>${esc(x.title)}</b><small class="suite-muted" style="display:block">${esc(x.document_type)} · ${isAdmin()?esc(memberName(members.find(m=>m.id===x.member_id))):'Private'}</small></span><button class="btn secondary" data-download-doc="${x.id}" data-doc-path="${esc(x.storage_path)}">Open</button></div>`).join('')||'<div class="suite-empty">No documents available.</div>'}</div></div></div>`;
  }

  async function reports(){
    const b=await loadBasic();
    const weeks=[];for(let i=7;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i*7);const key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);weeks.push({key,count:new Set(b.attendance.filter(a=>String(a.checked_in_at||'').slice(0,10)>=key).map(a=>a.member_id)).size});}
    const areasData=areas.map(a=>({name:a.name,count:b.attendance.filter(x=>x.area_id===a.id).length}));
    let givingHtml=''; if(isAdmin()){const g=await sb.from('giving_records').select('amount,given_on,giving_type').gte('given_on',(new Date().getFullYear())+'-01-01');const total=(g.data||[]).reduce((s,x)=>s+Number(x.amount||0),0);const byType={};(g.data||[]).forEach(x=>byType[x.giving_type]=(byType[x.giving_type]||0)+Number(x.amount||0));givingHtml=`<div class="suite-card"><h3>Financial KPIs</h3><div class="suite-kpi">${money(total)}</div><div class="suite-muted">Year to date</div><div class="suite-list" style="margin-top:10px">${Object.entries(byType).map(([k,v])=>`<div class="suite-row"><span>${esc(k)}</span><b>${money(v)}</b></div>`).join('')}</div></div>`;} else givingHtml='<div class="suite-card"><h3>Financial Privacy</h3><div class="suite-muted">Church-wide giving reports are restricted to authorized administrators and pastors.</div></div>';
    return `<div class="suite-grid three"><div class="suite-card"><h3>Members</h3><div class="suite-kpi">${members.length}</div><div class="suite-muted">${members.filter(m=>m.is_active).length} active</div></div><div class="suite-card"><h3>Attendance</h3><div class="suite-kpi">${b.attendance.length}</div><div class="suite-muted">Recent records</div></div><div class="suite-card"><h3>Events</h3><div class="suite-kpi">${b.events.length}</div><div class="suite-muted">Upcoming</div></div>${givingHtml}</div>
    <div class="suite-grid two" style="margin-top:14px"><div class="suite-card"><h3>8-Period Attendance Trend</h3>${weeks.map(w=>`<div class="suite-row"><span>${datePH(w.key)}</span><span style="min-width:58%;display:flex;align-items:center;gap:8px"><span class="suite-meter" style="flex:1"><span style="width:${Math.min(100,w.count/Math.max(1,members.length)*100)}%"></span></span><b>${w.count}</b></span></div>`).join('')}</div><div class="suite-card"><h3>Area Activity</h3>${areasData.map(a=>`<div class="suite-row"><span>${esc(a.name)}</span><b>${a.count}</b></div>`).join('')||'<div class="suite-empty">No area data.</div>'}</div></div>`;
  }

  function bindTab(){
    const root=q('#vccfSuite');if(!root)return;
    qAll('[data-go]',root).forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.go;if(b.dataset.qrMember)window.__VCCF_QR_MEMBER__=b.dataset.qrMember;if(b.dataset.careMember)window.__VCCF_CARE_MEMBER__=b.dataset.careMember;render();}));
    qAll('[data-member]',root).forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.member;window.__VCCF_SELECTED_MEMBER__=id;if(tab!=='members'){tab='members';await render();}await loadMemberDetail(id);}));
    const search=q('#memberSearch',root);if(search){const visible=isAdmin()?members:(role()==='area_leader'?members.filter(m=>m.area_id===profile.area_id):(myMemberId()?members.filter(m=>m.id===myMemberId()):[]));search.oninput=()=>{const z=search.value.trim().toLowerCase();q('#memberResults',root).innerHTML=memberResults(visible.filter(m=>(memberName(m)+' '+(m.member_code||'')+' '+(m.address||'')).toLowerCase().includes(z)));qAll('[data-member]',q('#memberResults',root)).forEach(b=>b.addEventListener('click',()=>loadMemberDetail(b.dataset.member)));};if(window.__VCCF_SELECTED_MEMBER__)loadMemberDetail(window.__VCCF_SELECTED_MEMBER__);}
    const givingForm=q('#givingForm',root);if(givingForm)givingForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(givingForm);const r=await sb.from('giving_records').insert({member_id:f.get('member_id'),given_on:f.get('given_on'),giving_type:f.get('giving_type'),amount:Number(f.get('amount')),payment_method:f.get('payment_method'),reference_no:f.get('reference_no')||null,notes:f.get('notes')||null,recorded_by:me.id});if(r.error)toast(r.error.message);else{toast('Giving record saved.');render();}};
    const careForm=q('#careForm',root);if(careForm)careForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(careForm);const r=await sb.from('pastoral_followups').insert({member_id:f.get('member_id'),assigned_to:me.id,followup_type:f.get('followup_type'),followup_on:f.get('followup_on')||null,reason:f.get('reason'),notes:f.get('notes')||null,created_by:me.id});if(r.error)toast(r.error.message);else{toast('Follow-up created.');render();}};
    const prayerForm=q('#prayerForm',root);if(prayerForm)prayerForm.onsubmit=async e=>{e.preventDefault();if(!myMemberId()){toast('Your profile is not linked to a member record yet.');return;}const f=new FormData(prayerForm);const r=await sb.from('prayer_requests').insert({member_id:myMemberId(),request_text:f.get('request_text'),category:f.get('category'),visibility:f.get('visibility')});if(r.error)toast(r.error.message);else{toast('Prayer request submitted.');render();}};
    qAll('[data-prayer]',root).forEach(s=>s.onchange=async()=>{const r=await sb.from('prayer_requests').update({status:s.value}).eq('id',s.dataset.prayer);if(r.error)toast(r.error.message);else toast('Prayer status updated.');});
    const qrBtn=q('#makeQr',root);if(qrBtn)qrBtn.onclick=()=>{const id=q('#qrMember',root)?.value;const m=members.find(x=>x.id===id);if(!m){toast('Select a member.');return;}const box=q('#qrCanvas',root);box.innerHTML='';if(window.QRCode)new QRCode(box,{text:m.member_code||m.id,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});else box.innerHTML='<div class="suite-muted">QR library unavailable.</div>';};
    qAll('[data-register]',root).forEach(b=>b.onclick=async()=>{if(!myMemberId()){toast('Your profile is not linked to a member record yet.');return;}const eventId=b.dataset.register;const existing=(await sb.from('event_registrations').select('id,status').eq('event_id',eventId).eq('member_id',myMemberId()).maybeSingle()).data;if(existing&&existing.status!=='Cancelled'){toast('You are already registered.');return;}const r=existing?await sb.from('event_registrations').update({status:'Registered'}).eq('id',existing.id):await sb.from('event_registrations').insert({event_id:eventId,member_id:myMemberId()});if(r.error)toast(r.error.message);else{toast('Registered for the event.');render();}});
    qAll('[data-export="giving"]',root).forEach(b=>b.onclick=()=>{const rows=[['Date','Member','Type','Amount','Payment','Reference'],...(dataCache.giving||[]).map(x=>[x.given_on,memberName(members.find(m=>m.id===x.member_id)),x.giving_type,Number(x.amount||0),x.payment_method||'',x.reference_no||''])];downloadCsv('vccf-giving.csv',rows);});
    qAll('[data-download-doc]',root).forEach(b=>b.onclick=async()=>{const path=b.dataset.docPath;const r=await sb.storage.from('vccf-documents').createSignedUrl(path,300);if(r.error){toast(r.error.message);return;}window.open(r.data.signedUrl,'_blank','noopener,noreferrer');});
    const docForm=q('#docForm',root);if(docForm)docForm.onsubmit=async e=>{e.preventDefault();const f=new FormData(docForm);const file=f.get('file');if(!(file instanceof File)||!file.size){toast('Choose a file.');return;}const member=f.get('member_id');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${member}/${crypto.randomUUID()}-${safe}`;const up=await sb.storage.from('vccf-documents').upload(path,file,{upsert:false});if(up.error){toast(up.error.message);return;}const ins=await sb.from('member_documents').insert({member_id:member,title:f.get('title'),document_type:f.get('document_type'),storage_path:path,created_by:me.id});if(ins.error){await sb.storage.from('vccf-documents').remove([path]);toast(ins.error.message);return;}toast('Document uploaded.');render();};
  }
  function qAll(sel,ctx=document){return Array.from(ctx.querySelectorAll(sel));}
  function downloadCsv(name,rows){const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download=name;document.body.appendChild(a);a.click();a.remove();}

  window.addEventListener('DOMContentLoaded',()=>setTimeout(init,500));
})();
