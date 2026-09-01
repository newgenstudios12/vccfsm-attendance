/* VCCF Church Management Suite patch — responsive action bindings + finance dashboard */
(() => {
  'use strict';
  if (window.__VCCF_CHURCH_SUITE_PATCH__) return;
  window.__VCCF_CHURCH_SUITE_PATCH__ = true;
  const q=(s,c=document)=>c.querySelector(s), qa=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>'₱'+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const ph=v=>v?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(v+'T12:00:00+08:00')):'—';
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sb=()=>window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  const me=async()=>{const c=sb(),u=await c.auth.getUser();if(!u.data.user)return null;const p=await c.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',u.data.user.id).maybeSingle();return {c,user:u.data.user,p:p.data||{}}};
  const isLeaderRole=p=>['admin','pastor','area_leader'].includes(String(p?.role||'').toLowerCase());
  const isAdmin=p=>['admin','pastor'].includes(String(p?.role||'').toLowerCase());
  const modal=(title,html)=>{const m=q('#modal'),t=q('#modalTitle'),b=q('#modalBody');if(!m||!t||!b)return null;t.textContent=title;b.innerHTML=html;m.classList.add('open');return b};
  const close=()=>q('#modal')?.classList.remove('open');
  const toast=m=>{const t=q('#toast');if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}};
  const memberList=async(ctx)=>{const r=await ctx.c.from('members').select('id,first_name,last_name,display_name,area_id').order('last_name');return r.data||[]};
  const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||'Member';

  async function newEvent(){const ctx=await me();if(!ctx||!isAdmin(ctx.p)){toast('Only administrators or pastors can create events.');return}const b=modal('Create church event',`<form id="suiteEventForm" class="suite-form"><div><label>Title</label><input name="title" required placeholder="Youth Fellowship"></div><div><label>Description</label><textarea name="description" rows="3"></textarea></div><div class="row"><div><label>Date</label><input name="event_date" type="date" required value="${today()}"></div><div><label>Time</label><input name="event_time" type="time"></div></div><div><label>Location</label><input name="location" placeholder="VCCF Santa Maria"></div><button class="btn">Create Event</button></form>`);q('#suiteEventForm',b).onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const r=await ctx.c.from('special_events').insert({title:f.get('title'),description:f.get('description')||null,event_date:f.get('event_date'),event_time:f.get('event_time')||null,location:f.get('location')||null,created_by:ctx.user.id});if(r.error){toast(r.error.message);return}close();toast('Event created.');document.querySelector('[data-tab="events"]')?.click()}};
  async function roster(eventId){const ctx=await me();if(!ctx||!isLeaderRole(ctx.p))return;const {data:event}=await ctx.c.from('special_events').select('title,event_date').eq('id',eventId).maybeSingle();const {data:regs,error}=await ctx.c.from('event_registrations').select('id,member_id,status,registered_at').eq('event_id',eventId).order('registered_at');if(error){toast(error.message);return}const members=await memberList(ctx),name=id=>memberName(members.find(x=>x.id===id));const b=modal('Event roster',`<div class="suite-muted" style="margin-bottom:10px">${esc(event?.title||'Event')} · ${ph(event?.event_date)}</div><div class="suite-tablewrap"><table class="suite-table"><thead><tr><th>Member</th><th>Status</th><th>Action</th></tr></thead><tbody>${(regs||[]).map(r=>`<tr><td>${esc(name(r.member_id))}</td><td><span class="suite-pill">${esc(r.status)}</span></td><td><select data-reg="${r.id}"><option ${r.status==='Registered'?'selected':''}>Registered</option><option ${r.status==='Confirmed'?'selected':''}>Confirmed</option><option ${r.status==='Attended'?'selected':''}>Attended</option><option ${r.status==='Absent'?'selected':''}>Absent</option><option ${r.status==='Cancelled'?'selected':''}>Cancelled</option></select></td></tr>`).join('')||'<tr><td colspan="3" class="suite-empty">No registrations yet.</td></tr>'}</tbody></table></div>`);qa('[data-reg]',b).forEach(s=>s.onchange=async()=>{const r=await ctx.c.from('event_registrations').update({status:s.value}).eq('id',s.dataset.reg);if(r.error)toast(r.error.message);else toast('Registration updated.')})}
  async function assignMinistry(ministryId){const ctx=await me();if(!ctx||!isAdmin(ctx.p))return;const [members,mins]=await Promise.all([memberList(ctx),ctx.c.from('ministries').select('id,name').eq('id',ministryId).maybeSingle()]);const b=modal('Assign ministry member',`<form id="suiteMinistryForm" class="suite-form"><div><label>Ministry</label><input value="${esc(mins.data?.name||'Ministry')}" disabled></div><div><label>Member</label><select name="member_id" required><option value="">Select member…</option>${members.map(m=>`<option value="${m.id}">${esc(memberName(m))}</option>`).join('')}</select></div><div><label>Role / assignment</label><input name="role_title" placeholder="Volunteer"></div><div><label>Joined on</label><input name="joined_on" type="date"></div><button class="btn">Assign Member</button></form>`);q('#suiteMinistryForm',b).onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const r=await ctx.c.from('member_ministries').upsert({member_id:f.get('member_id'),ministry_id:ministryId,role_title:f.get('role_title')||null,joined_on:f.get('joined_on')||null},{onConflict:'member_id,ministry_id'});if(r.error){toast(r.error.message);return}close();toast('Ministry assignment saved.');document.querySelector('[data-tab="ministries"]')?.click()}}
  async function exportReport(){const ctx=await me();if(!ctx)return;let rows=[['Type','Member','Area','Date','Value']];const m=await memberList(ctx),amap={};m.forEach(x=>{amap[x.id]={name:memberName(x),area:x.area_id||''}});const a=await ctx.c.from('attendance').select('member_id,checked_in_at').order('checked_in_at',{ascending:false}).limit(5000);(a.data||[]).forEach(x=>rows.push(['Attendance',amap[x.member_id]?.name||x.member_id,amap[x.member_id]?.area||'',x.checked_in_at,'']));if(isAdmin(ctx.p)){const g=await ctx.c.from('giving_records').select('member_id,given_on,giving_type,amount').order('given_on',{ascending:false}).limit(5000);(g.data||[]).forEach(x=>rows.push(['Giving',amap[x.member_id]?.name||x.member_id,amap[x.member_id]?.area||'',x.given_on,`${x.giving_type}: ${x.amount}`]))}const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const ael=document.createElement('a');ael.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);ael.download='vccf-management-report.csv';ael.click();toast('Report exported.')}

  async function finance(){
    const ctx=await me();
    if(!ctx||!isAdmin(ctx.p))return '<div class="suite-card"><b>Giving access is restricted.</b><div class="suite-muted">Tithes and offerings are confidential financial records. Only administrators and pastors can view the church-wide giving dashboard.</div></div>';
    const [mr,gr]=await Promise.all([
      ctx.c.from('members').select('id,first_name,last_name,display_name,area_id,member_code,is_active,status').order('last_name'),
      ctx.c.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes').order('given_on',{ascending:false}).limit(10000)
    ]);
    if(mr.error)throw mr.error;if(gr.error)throw gr.error;
    const members=mr.data||[], records=gr.data||[], map=new Map(members.map(m=>[m.id,m]));
    const month=today().slice(0,7), year=today().slice(0,4);
    const inMonth=records.filter(r=>String(r.given_on).slice(0,7)===month), inYear=records.filter(r=>String(r.given_on).slice(0,4)===year);
    const sum=(arr,type)=>arr.filter(r=>!type||String(r.giving_type).toLowerCase()===type).reduce((s,r)=>s+Number(r.amount||0),0);
    const memberRows=members.map(m=>{const rs=records.filter(r=>r.member_id===m.id),tithe=sum(rs,'tithe'),offering=sum(rs,'offering'),other=rs.filter(r=>!['tithe','offering'].includes(String(r.giving_type).toLowerCase())).reduce((s,r)=>s+Number(r.amount||0),0);return {m,tithe,offering,other,total:tithe+offering+other,last:rs[0]?.given_on||''};}).sort((a,b)=>memberName(a.m).localeCompare(memberName(b.m)));
    window.__VCCF_FINANCE_ROWS__=memberRows;window.__VCCF_FINANCE_RECORDS__=records;
    return `<style>
      .finance-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.finance-kpi{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px;min-width:0}.finance-kpi .num{font-size:1.45rem;font-weight:900;margin-top:5px}.finance-toolbar{display:flex;gap:9px;flex-wrap:wrap;align-items:center}.finance-toolbar input,.finance-toolbar select{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:10px 11px}.finance-toolbar input{min-width:250px}.finance-member{font-weight:850}.finance-member small{display:block;color:var(--muted);font-weight:500}.finance-total{font-weight:900}.finance-actions{display:flex;gap:7px;flex-wrap:wrap}.finance-note{margin-top:12px;padding:11px 13px;border:1px solid var(--line);border-radius:13px;color:var(--muted);font-size:.78rem}
      @media(max-width:900px){.finance-kpis{grid-template-columns:1fr 1fr}}@media(max-width:600px){.finance-kpis{grid-template-columns:1fr 1fr}.finance-toolbar input{min-width:0;width:100%}.finance-toolbar select{flex:1}}
    </style>
    <div class="finance-kpis">
      <div class="finance-kpi"><div class="suite-muted">This month</div><div class="num">${money(sum(inMonth))}</div></div>
      <div class="finance-kpi"><div class="suite-muted">Tithes this month</div><div class="num">${money(sum(inMonth,'tithe'))}</div></div>
      <div class="finance-kpi"><div class="suite-muted">Offerings this month</div><div class="num">${money(sum(inMonth,'offering'))}</div></div>
      <div class="finance-kpi"><div class="suite-muted">Year to date</div><div class="num">${money(sum(inYear))}</div></div>
    </div>
    <div class="suite-card" style="margin-top:14px">
      <div class="suite-actions" style="justify-content:space-between;align-items:center"><div><h3 style="margin:0">Tithes & Offerings — Every Member</h3><div class="suite-muted">Individual giving history is linked to each member record.</div></div><div class="finance-actions"><button class="btn secondary" data-finance-export="1">Export Giving CSV</button><button class="btn" data-finance-record="1">Record Giving</button></div></div>
      <div class="finance-toolbar" style="margin:13px 0"><input id="financeSearch" placeholder="Search member or member code…"><select id="financeArea"><option value="">All areas</option>${[...new Set(members.map(m=>m.area_id).filter(Boolean))].map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select><select id="financeType"><option value="">All giving</option><option value="tithe">Tithes</option><option value="offering">Offerings</option><option value="other">Other</option></select></div>
      <div class="suite-tablewrap"><table class="suite-table"><thead><tr><th>Member</th><th>Tithes</th><th>Offerings</th><th>Other</th><th>Total</th><th>Last Giving</th><th></th></tr></thead><tbody id="financeRows"></tbody></table></div>
      <div class="finance-note">Financial privacy is enforced by Supabase Row Level Security. This dashboard does not expose giving totals to ordinary members or area leaders.</div>
    </div>`;
  }

  function renderFinanceRows(){
    const body=q('#financeRows');if(!body)return;const search=(q('#financeSearch')?.value||'').toLowerCase().trim(),area=q('#financeArea')?.value||'',type=q('#financeType')?.value||'';
    let rows=(window.__VCCF_FINANCE_ROWS__||[]).filter(x=>{const n=(memberName(x.m)+' '+(x.m.member_code||'')).toLowerCase();if(search&&!n.includes(search))return false;if(area&&x.m.area_id!==area)return false;if(type==='tithe'&&x.tithe<=0)return false;if(type==='offering'&&x.offering<=0)return false;if(type==='other'&&x.other<=0)return false;return true});
    body.innerHTML=rows.map(x=>`<tr><td><div class="finance-member">${esc(memberName(x.m))}<small>${esc(x.m.member_code||'')} · ${x.m.is_active?'Active':'Inactive'}</small></div></td><td>${money(x.tithe)}</td><td>${money(x.offering)}</td><td>${money(x.other)}</td><td class="finance-total">${money(x.total)}</td><td>${ph(x.last)}</td><td><button class="btn secondary" data-finance-member="${x.m.id}">History</button></td></tr>`).join('')||'<tr><td colspan="7" class="suite-empty">No member giving records match the filter.</td></tr>';
  }

  async function financeHistory(memberId){
    const ctx=await me();if(!ctx||!isAdmin(ctx.p))return;const m=(window.__VCCF_FINANCE_ROWS__||[]).find(x=>x.m.id===memberId)?.m;if(!m)return;const rs=(window.__VCCF_FINANCE_RECORDS__||[]).filter(r=>r.member_id===memberId);const tithe=rs.filter(r=>String(r.giving_type).toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0),off=rs.filter(r=>String(r.giving_type).toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0);modal(`${memberName(m)} — Giving History`,`<div class="suite-grid three"><div class="suite-card"><div class="suite-muted">Tithes</div><div class="suite-kpi">${money(tithe)}</div></div><div class="suite-card"><div class="suite-muted">Offerings</div><div class="suite-kpi">${money(off)}</div></div><div class="suite-card"><div class="suite-muted">Total records</div><div class="suite-kpi">${rs.length}</div></div></div><div class="suite-tablewrap" style="margin-top:13px"><table class="suite-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Payment</th><th>Reference</th><th>Notes</th></tr></thead><tbody>${rs.map(r=>`<tr><td>${ph(r.given_on)}</td><td>${esc(r.giving_type)}</td><td><b>${money(r.amount)}</b></td><td>${esc(r.payment_method||'')}</td><td>${esc(r.reference_no||'')}</td><td>${esc(r.notes||'')}</td></tr>`).join('')||'<tr><td colspan="6" class="suite-empty">No giving records.</td></tr>'}</tbody></table></div>`)}

  function openRecordGiving(){const ctxData=window.__VCCF_FINANCE_ROWS__||[];const b=modal('Record Tithe / Offering',`<form id="financeRecordForm" class="suite-form"><div><label>Member</label><select name="member_id" required><option value="">Select member…</option>${ctxData.map(x=>`<option value="${x.m.id}">${esc(memberName(x.m))}</option>`).join('')}</select></div><div class="row"><div><label>Date</label><input name="given_on" type="date" value="${today()}" required></div><div><label>Amount</label><input name="amount" type="number" min="0" step="0.01" required placeholder="0.00"></div></div><div class="row"><div><label>Giving type</label><select name="giving_type"><option>Tithe</option><option>Offering</option><option>Missions</option><option>Building Fund</option><option>Special Offering</option><option>Other</option></select></div><div><label>Payment method</label><select name="payment_method"><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Other</option></select></div></div><div class="row"><div><label>Reference no.</label><input name="reference_no"></div><div><label>Notes</label><input name="notes"></div></div><button class="btn">Save Giving Record</button></form>`);if(!b)return;q('#financeRecordForm',b).onsubmit=async e=>{e.preventDefault();const ctx=await me();if(!ctx||!isAdmin(ctx.p))return;const f=new FormData(e.currentTarget);const r=await ctx.c.from('giving_records').insert({member_id:f.get('member_id'),given_on:f.get('given_on'),giving_type:f.get('giving_type'),amount:Number(f.get('amount')),payment_method:f.get('payment_method'),reference_no:f.get('reference_no')||null,notes:f.get('notes')||null,recorded_by:ctx.user.id});if(r.error){toast(r.error.message);return}close();toast('Giving record saved.');document.querySelector('[data-tab="giving"]')?.click()};}

  function exportGiving(){const rows=[['Member Code','Member','Status','Tithes','Offerings','Other','Total','Last Giving'],...(window.__VCCF_FINANCE_ROWS__||[]).map(x=>[x.m.member_code||'',memberName(x.m),x.m.is_active?'Active':'Inactive',x.tithe,x.offering,x.other,x.total,x.last])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='vccf-member-tithes-offerings.csv';a.click();toast('Member giving CSV exported.');}

  document.addEventListener('click',e=>{
    const t=e.target.closest?.('[data-new-event],[data-event-roster],[data-manage-ministry],[data-export-report],[data-finance-export],[data-finance-record],[data-finance-member]');if(!t)return;
    if(t.dataset.newEvent){e.preventDefault();newEvent()}
    if(t.dataset.eventRoster){e.preventDefault();roster(t.dataset.eventRoster)}
    if(t.dataset.manageMinistry){e.preventDefault();assignMinistry(t.dataset.manageMinistry)}
    if(t.dataset.exportReport){e.preventDefault();exportReport()}
    if(t.dataset.financeExport){e.preventDefault();exportGiving()}
    if(t.dataset.financeRecord){e.preventDefault();openRecordGiving()}
    if(t.dataset.financeMember){e.preventDefault();financeHistory(t.dataset.financeMember)}
  },true);

  document.addEventListener('input',e=>{if(e.target?.id==='financeSearch')renderFinanceRows()});
  document.addEventListener('change',e=>{if(['financeArea','financeType'].includes(e.target?.id))renderFinanceRows()});

  const originalContent=document.querySelector('#vccfSuite');
  const upgradeGiving=async()=>{
    const btn=document.querySelector('#vccfSuite [data-tab="giving"]');
    if(!btn||btn.__financeBound)return;
    btn.__financeBound=true;
    btn.addEventListener('click',async()=>{setTimeout(async()=>{const root=q('#suiteContent');if(!root)return;try{const html=await finance();root.innerHTML=html;renderFinanceRows()}catch(err){root.innerHTML=`<div class="suite-card suite-danger"><b>Unable to load Giving.</b><div class="suite-muted">${esc(err.message||err)}</div></div>`}},0)},true);
  };
  const observer=new MutationObserver(()=>upgradeGiving());
  if(originalContent)observer.observe(originalContent,{childList:true,subtree:true});
  upgradeGiving();
})();