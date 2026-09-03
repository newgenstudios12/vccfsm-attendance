(() => {
'use strict';
if (window.__VCCF_CHURCH_MANAGEMENT_V1__) return;
window.__VCCF_CHURCH_MANAGEMENT_V1__ = true;

const ROOT_ID = 'church';
let activeTab = 'overview';
let loading = false;
let loaded = false;
let eventScanner = null;
let data = {
  areas:[], ministries:[], ministryMembers:[],
  serviceTypes:[], serviceSessions:[],
  events:[], registrations:[], leadership:[],
  pastoral:[], prayers:[], announcements:[], documents:[],
  profiles:[], audit:[], attendance:[]
};

const V = () => window.VCCF;
const appState = () => V()?.getState?.() || {};
const sb = () => V()?.sb;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr = esc;
const role = () => String(appState().profile?.role || '').toLowerCase();
const isAdmin = () => role() === 'admin';
const isPastor = () => role() === 'pastor';
const isAreaLeader = () => role() === 'area_leader';
const canManageChurch = () => isAdmin() || isPastor();
const canManageEvents = () => canManageChurch() || isAreaLeader();
const canManageAnnouncements = canManageEvents;
const canSeePastoral = () => canManageChurch() || isAreaLeader();
const currentUserId = () => appState().session?.user?.id || null;
const currentMemberId = () => appState().profile?.member_id || null;
const areaName = id => data.areas.find(x => x.id === id)?.name || 'Unassigned';
const ministryName = id => data.ministries.find(x => x.id === id)?.name || 'Unassigned';
const memberName = id => {
  const m = (appState().members || []).find(x => x.id === id);
  return m ? (m.display_name || [m.first_name,m.last_name].filter(Boolean).join(' ') || m.member_code || 'Member') : 'Unknown member';
};
const memberOptions = (selected='') => (appState().members || [])
  .slice().sort((a,b)=>memberName(a.id).localeCompare(memberName(b.id)))
  .map(m => '<option value="'+attr(m.id)+'" '+(m.id===selected?'selected':'')+'>'+esc(memberName(m.id))+'</option>').join('');
const areaOptions = (selected='', includeBlank=true) =>
  (includeBlank?'<option value="">None / Church-wide</option>':'') +
  data.areas.filter(a=>a.is_active!==false).map(a => '<option value="'+attr(a.id)+'" '+(a.id===selected?'selected':'')+'>'+esc(a.name)+'</option>').join('');
const ministryOptions = (selected='', includeBlank=true) =>
  (includeBlank?'<option value="">None / Church-wide</option>':'') +
  data.ministries.filter(m=>m.is_active!==false).map(m => '<option value="'+attr(m.id)+'" '+(m.id===selected?'selected':'')+'>'+esc(m.name)+'</option>').join('');
const profileOptions = (selected='') =>
  '<option value="">Unassigned</option>' +
  data.profiles.map(p => '<option value="'+attr(p.user_id)+'" '+(p.user_id===selected?'selected':'')+'>'+esc(p.display_name || p.user_id)+'</option>').join('');
const fmtDate = v => v ? new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'}).format(new Date(v)) : '—';
const fmtDateTime = v => v ? new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)) : '—';
const phDay = v => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const latestSunday = () => { const d=new Date(phDay(new Date())+'T12:00:00+08:00'); d.setDate(d.getDate()-d.getDay()); return phDay(d); };
const nextBirthday = birth => {
  if(!birth) return null;
  const parts=String(birth).split('-'); if(parts.length<3) return null;
  const now=new Date(phDay(new Date())+'T12:00:00+08:00');
  let d=new Date(now.getFullYear()+'-'+parts[1]+'-'+parts[2]+'T12:00:00+08:00');
  if(d<now) d=new Date((now.getFullYear()+1)+'-'+parts[1]+'-'+parts[2]+'T12:00:00+08:00');
  return d;
};
const toLocalInput = v => {
  if (!v) return '';
  const d = new Date(v);
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  const o={}; parts.forEach(p=>o[p.type]=p.value);
  return o.year+'-'+o.month+'-'+o.day+'T'+o.hour+':'+o.minute;
};
const manilaIso = local => local ? new Date(local+':00+08:00').toISOString() : null;
const setBusy = on => { loading = on; document.getElementById('cmsRefresh')?.toggleAttribute('disabled',on); };
const root = () => document.getElementById(ROOT_ID);
const content = () => document.getElementById('cmsContent');

function toast(message, good=false) {
  let t=document.getElementById('cmsToast');
  if(!t){ t=document.createElement('div'); t.id='cmsToast'; t.className='cms-toast'; document.body.appendChild(t); }
  t.textContent=message; t.classList.toggle('good',good); t.classList.add('show');
  clearTimeout(window.__cmsToastTimer); window.__cmsToastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}

async function read(query, fallback=[]) {
  try {
    const r = await query;
    if (r.error) throw r.error;
    return r.data ?? fallback;
  } catch (e) {
    console.warn('CMS load:', e);
    return fallback;
  }
}

async function loadAll(force=false) {
  if (loading) return;
  if (loaded && !force) return;
  const client=sb(); if(!client) return;
  setBusy(true);
  try {
    const since=new Date(Date.now()-90*86400000).toISOString();
    const profileQuery = isAdmin()
      ? client.from('profiles').select('user_id,role,member_id,area_id,display_name').order('display_name')
      : Promise.resolve({data:[]});
    const auditQuery = isAdmin()
      ? client.from('audit_log').select('id,actor_user_id,action,entity_type,entity_id,metadata,created_at').order('created_at',{ascending:false}).limit(100)
      : Promise.resolve({data:[]});
    const pastoralQuery = canSeePastoral()
      ? client.from('pastoral_followups').select('*').order('created_at',{ascending:false}).limit(200)
      : Promise.resolve({data:[]});

    const [
      areas,ministries,ministryMembers,serviceTypes,serviceSessions,events,registrations,
      leadership,pastoral,prayers,announcements,documents,profiles,audit,attendance
    ] = await Promise.all([
      read(client.from('areas').select('id,name,is_active,description,updated_at').order('name')),
      read(client.from('ministries').select('id,name,description,is_active,leader_member_id,created_at,updated_at').order('name')),
      read(client.from('member_ministries').select('id,member_id,ministry_id,role_title,joined_on,created_at')),
      read(client.from('church_service_types').select('*').order('name')),
      read(client.from('church_service_sessions').select('*').order('service_date',{ascending:false}).limit(200)),
      read(client.from('church_events').select('*').order('start_at',{ascending:true}).limit(300)),
      read(client.from('church_event_registrations').select('*').order('registered_at',{ascending:false}).limit(500)),
      read(client.from('church_leadership').select('*').order('display_order').order('created_at')),
      read(pastoralQuery),
      read(client.from('prayer_requests').select('*').order('created_at',{ascending:false}).limit(300)),
      read(client.from('church_announcements').select('*').order('publish_at',{ascending:false}).limit(200)),
      read(client.from('church_documents').select('*').order('created_at',{ascending:false}).limit(200)),
      read(profileQuery),
      read(auditQuery),
      read(client.from('attendance').select('id,member_id,area_id,checked_in_at').gte('checked_in_at',since).order('checked_in_at',{ascending:false}).limit(3000))
    ]);
    Object.assign(data,{areas,ministries,ministryMembers,serviceTypes,serviceSessions,events,registrations,leadership,pastoral,prayers,announcements,documents,profiles,audit,attendance});
    loaded=true;
  } finally {
    setBusy(false);
  }
}

async function writeAudit(action, entityType, entityId=null, metadata={}) {
  try {
    const uid=currentUserId(); if(!uid) return;
    const r=await sb().from('audit_log').insert({actor_user_id:uid,action,entity_type:entityType,entity_id:entityId||null,metadata});
    if(r.error) console.warn('Audit log:',r.error);
  } catch(e){ console.warn('Audit log:',e); }
}

async function saveRow(table, values, id=null, label='Record') {
  const client=sb(); if(!client) throw new Error('Database client unavailable.');
  const payload={...values};
  let q=id ? client.from(table).update(payload).eq('id',id).select().maybeSingle()
           : client.from(table).insert(payload).select().maybeSingle();
  const r=await q;
  if(r.error) throw r.error;
  await writeAudit(id?'update':'create',table,r.data?.id || id,{label});
  loaded=false; await loadAll(true); renderActive();
  toast(label+(id?' updated.':' created.'),true);
}

async function deleteRow(table,id,label='Record') {
  if(!confirm('Delete this '+label.toLowerCase()+'?')) return;
  const r=await sb().from(table).delete().eq('id',id);
  if(r.error){toast(r.error.message);return;}
  await writeAudit('delete',table,id,{label});
  loaded=false; await loadAll(true); renderActive(); toast(label+' deleted.',true);
}

function modal(title, body, onSubmit, saveLabel='Save') {
  document.getElementById('cmsModal')?.remove();
  const wrap=document.createElement('div'); wrap.id='cmsModal'; wrap.className='cms-modal';
  wrap.innerHTML='<div class="cms-modal-card"><div class="cms-modal-head"><h3>'+esc(title)+'</h3><button type="button" class="cms-x" aria-label="Close">×</button></div><form id="cmsModalForm">'+body+'<div class="cms-modal-actions"><button type="button" class="btn secondary cmsCancel">Cancel</button><button type="submit" class="btn">'+esc(saveLabel)+'</button></div><div id="cmsModalMsg" class="msg"></div></form></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();
  wrap.querySelector('.cms-x').onclick=close; wrap.querySelector('.cmsCancel').onclick=close;
  wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
  wrap.querySelector('form').onsubmit=async e=>{
    e.preventDefault();
    const submit=e.target.querySelector('button[type="submit"]'); submit.disabled=true; submit.textContent='Saving…';
    try{ await onSubmit(new FormData(e.target)); close(); }
    catch(err){ const m=wrap.querySelector('#cmsModalMsg'); m.textContent=err.message||String(err); m.style.color='#b42318'; }
    finally{ if(document.body.contains(wrap)){submit.disabled=false;submit.textContent=saveLabel;} }
  };
}

function shell() {
  const r=root(); if(!r || r.dataset.cmsReady) return;
  r.dataset.cmsReady='1';
  r.innerHTML='<div class="cms-shell"><div class="cms-module-tools"><span id="cmsRole" class="cms-role"></span><button id="cmsRefresh" class="btn secondary" type="button">Refresh</button></div><div id="cmsContent" class="cms-content"></div></div>';
  document.getElementById('cmsRefresh').onclick=async()=>{loaded=false;await loadAll(true);renderActive();toast('Church Management refreshed.',true)};
}

function statCard(label,value,hint='') {
  return '<div class="cms-stat card"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong>'+(hint?'<span>'+esc(hint)+'</span>':'')+'</div>';
}
function empty(msg){return '<div class="cms-empty">'+esc(msg)+'</div>';}
function badge(text,kind=''){return '<span class="cms-badge '+kind+'">'+esc(text)+'</span>';}

function renderOverview(){
  const members=appState().members||[];
  const activeMembers=members.filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive');
  const inactiveMembers=members.filter(m=>m.is_active===false||String(m.status||'').toLowerCase()==='inactive');
  const sunday=latestSunday();
  const sundayPresent=new Set(data.attendance.filter(a=>phDay(a.checked_in_at)===sunday).map(a=>a.member_id));
  const sundayRate=activeMembers.length?Math.round(sundayPresent.size/activeMembers.length*100):0;
  const new30=members.filter(m=>m.created_at&&new Date(m.created_at).getTime()>=Date.now()-30*86400000).length;
  const birthdays=members.map(m=>({m,date:nextBirthday(m.birth_date)})).filter(x=>x.date&&x.date.getTime()-Date.now()<=30*86400000).sort((a,b)=>a.date-b.date).slice(0,8);
  const now=Date.now();
  const upcoming=data.events.filter(e=>new Date(e.start_at).getTime()>=now && e.status!=='Cancelled').slice(0,5);
  const published=data.announcements.filter(a=>a.is_published).slice(0,5);
  const activeLeaders=data.leadership.filter(l=>l.is_active).length;
  const pendingPastoral=data.pastoral.filter(x=>String(x.status).toLowerCase()!=='completed').length;
  const openPrayers=data.prayers.filter(x=>!['answered','closed'].includes(String(x.status).toLowerCase())).length;
  content().innerHTML=
    '<div class="cms-stats">'+
      statCard('Total Members',members.length,'Member details remain in the Members module')+
      statCard('Active Members',activeMembers.length)+
      statCard('Inactive Members',inactiveMembers.length)+
      statCard('Sunday Attendance',sundayPresent.size,sunday+' · '+sundayRate+'% of active members')+
      statCard('New Members · 30d',new30)+
      statCard('Areas',data.areas.filter(x=>x.is_active!==false).length)+
      statCard('Ministries',data.ministries.filter(x=>x.is_active!==false).length)+
      statCard('Active Leaders',activeLeaders)+
      statCard('Upcoming Events',upcoming.length)+
      statCard('Open Prayer Requests',openPrayers)+
      statCard('Pastoral Follow-ups',pendingPastoral)+
      statCard('Birthdays · 30d',birthdays.length)+
    '</div>'+
    '<div class="cms-grid two">'+
      '<section class="cms-panel card"><div class="cms-panel-head"><h3>Upcoming Events</h3><button class="cms-link" data-jump="events">Manage</button></div>'+
        (upcoming.length?upcoming.map(e=>'<div class="cms-list-row"><div><b>'+esc(e.title)+'</b><span>'+fmtDateTime(e.start_at)+(e.location?' · '+esc(e.location):'')+'</span></div>'+badge(e.status)+'</div>').join(''):empty('No upcoming events.'))+
      '</section>'+
      '<section class="cms-panel card"><div class="cms-panel-head"><h3>Upcoming Birthdays</h3></div>'+
        (birthdays.length?birthdays.map(x=>'<div class="cms-list-row"><div><b>'+esc(memberName(x.m.id))+'</b><span>'+fmtDate(x.date)+' · '+esc(areaName(x.m.area_id))+'</span></div>'+badge('Birthday')+'</div>').join(''):empty('No birthdays in the next 30 days.'))+
      '</section>'+
    '</div>'+
    '<div class="cms-grid two">'+
      '<section class="cms-panel card"><div class="cms-panel-head"><h3>Announcements</h3><button class="cms-link" data-jump="announcements">Manage</button></div>'+
        (published.length?published.map(a=>'<div class="cms-list-row"><div><b>'+esc(a.title)+'</b><span>'+esc(a.audience)+' · '+fmtDate(a.publish_at)+'</span></div>'+badge(a.is_published?'Published':'Draft',a.is_published?'ok':'')+'</div>').join(''):empty('No announcements yet.'))+
      '</section>'+
      '<section class="cms-panel card"><h3>Ministry Snapshot</h3>'+
      (data.ministries.length?data.ministries.slice(0,8).map(m=>{const n=data.ministryMembers.filter(x=>x.ministry_id===m.id).length;return '<div class="cms-meter-row"><span>'+esc(m.name)+'</span><div class="cms-meter"><i style="width:'+Math.min(100,n*10)+'%"></i></div><b>'+n+'</b></div>'}).join(''):empty('No ministries.'))+
      '</section>'+
    '</div>'+
    '<section class="cms-panel card"><h3>Next Church Services</h3>'+
      (data.serviceSessions.filter(s=>new Date(s.service_date+'T12:00:00+08:00').getTime()>=Date.now()-86400000).slice(0,6).map(s=>'<div class="cms-list-row"><div><b>'+esc(s.title||data.serviceTypes.find(t=>t.id===s.service_type_id)?.name||'Church Service')+'</b><span>'+fmtDate(s.service_date)+' · '+esc(s.theme||'No theme set')+'</span></div>'+badge(s.status)+'</div>').join('')||empty('No service sessions scheduled.'))+
    '</section>';
  content().querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.jump));
}

function renderAreas(){
  const can=canManageChurch();
  const rows=data.areas.map(a=>{
    const members=(appState().members||[]).filter(m=>m.area_id===a.id).length;
    return '<tr><td><b>'+esc(a.name)+'</b><div class="cms-sub">'+esc(a.description||'')+'</div></td><td>'+members+'</td><td>'+badge(a.is_active!==false?'Active':'Inactive',a.is_active!==false?'ok':'muted')+'</td><td class="cms-actions">'+(can?'<button class="cms-small" data-edit="'+a.id+'">Edit</button>':'')+'</td></tr>';
  }).join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Areas</h3><p>Church geographic groups and area-level administration.</p></div>'+(can?'<button id="addArea" class="btn">Add Area</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Area</th><th>Members</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  if(can){
    document.getElementById('addArea').onclick=()=>areaForm();
    content().querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>areaForm(data.areas.find(x=>x.id===b.dataset.edit)));
  }
}
function areaForm(a=null){
  modal(a?'Edit Area':'Add Area',
    '<div class="cms-form-grid"><label>Name<input name="name" required value="'+attr(a?.name||'')+'"></label>'+
    '<label>Status<select name="is_active"><option value="true" '+(a?.is_active!==false?'selected':'')+'>Active</option><option value="false" '+(a?.is_active===false?'selected':'')+'>Inactive</option></select></label></div>'+
    '<label>Description<textarea name="description" rows="3">'+esc(a?.description||'')+'</textarea></label>',
    async f=>saveRow('areas',{name:f.get('name').trim(),description:f.get('description').trim()||null,is_active:f.get('is_active')==='true',updated_at:new Date().toISOString()},a?.id,'Area')
  );
}

function renderMinistries(){
  const can=canManageChurch();
  const rows=data.ministries.map(m=>{
    const count=data.ministryMembers.filter(x=>x.ministry_id===m.id).length;
    const leader=m.leader_member_id?memberName(m.leader_member_id):'Not assigned';
    return '<tr><td><b>'+esc(m.name)+'</b><div class="cms-sub">'+esc(m.description||'')+'</div></td><td>'+esc(leader)+'</td><td>'+count+'</td><td>'+badge(m.is_active!==false?'Active':'Inactive',m.is_active!==false?'ok':'muted')+'</td><td class="cms-actions">'+(canManageChurch()?'<button class="cms-small" data-edit-ministry="'+m.id+'">Edit</button>':'')+(can?'<button class="cms-small" data-assign="'+m.id+'">Assign</button>':'')+'</td></tr>';
  }).join('');
  const membership=data.ministryMembers.slice(0,100).map(mm=>'<tr><td>'+esc(memberName(mm.member_id))+'</td><td>'+esc(ministryName(mm.ministry_id))+'</td><td>'+esc(mm.role_title||'Member')+'</td><td>'+esc(mm.joined_on||'—')+'</td><td>'+(can?'<button class="cms-small danger-text" data-remove-membership="'+mm.id+'">Remove</button>':'')+'</td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Ministries</h3><p>Ministry directory, leaders and participation.</p></div>'+(canManageChurch()?'<button id="addMinistry" class="btn">Add Ministry</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Ministry</th><th>Leader</th><th>Members</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>'+
    '<section class="cms-panel card"><div class="cms-panel-head"><h3>Ministry Memberships</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Member</th><th>Ministry</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>'+(membership||'<tr><td colspan="5">'+empty('No ministry memberships yet.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addMinistry')?.addEventListener('click',()=>ministryForm());
  content().querySelectorAll('[data-edit-ministry]').forEach(b=>b.onclick=()=>ministryForm(data.ministries.find(x=>x.id===b.dataset.editMinistry)));
  content().querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>membershipForm(b.dataset.assign));
  content().querySelectorAll('[data-remove-membership]').forEach(b=>b.onclick=()=>deleteRow('member_ministries',b.dataset.removeMembership,'Ministry membership'));
}
function ministryForm(m=null){
  modal(m?'Edit Ministry':'Add Ministry',
    '<div class="cms-form-grid"><label>Name<input name="name" required value="'+attr(m?.name||'')+'"></label>'+
    '<label>Status<select name="is_active"><option value="true" '+(m?.is_active!==false?'selected':'')+'>Active</option><option value="false" '+(m?.is_active===false?'selected':'')+'>Inactive</option></select></label></div>'+
    '<label>Ministry leader<select name="leader_member_id"><option value="">Not assigned</option>'+memberOptions(m?.leader_member_id||'')+'</select></label>'+
    '<label>Description<textarea name="description" rows="3">'+esc(m?.description||'')+'</textarea></label>',
    async f=>saveRow('ministries',{name:f.get('name').trim(),description:f.get('description').trim()||null,is_active:f.get('is_active')==='true',leader_member_id:f.get('leader_member_id')||null,updated_at:new Date().toISOString()},m?.id,'Ministry')
  );
}
function membershipForm(ministryId){
  modal('Assign Ministry Member',
    '<label>Member<select name="member_id" required><option value="">Select member</option>'+memberOptions()+'</select></label>'+
    '<label>Ministry<select name="ministry_id" required>'+ministryOptions(ministryId,false)+'</select></label>'+
    '<div class="cms-form-grid"><label>Role / responsibility<input name="role_title" placeholder="Member, Leader, Coordinator"></label><label>Joined on<input name="joined_on" type="date"></label></div>',
    async f=>saveRow('member_ministries',{member_id:f.get('member_id'),ministry_id:f.get('ministry_id'),role_title:f.get('role_title').trim()||null,joined_on:f.get('joined_on')||null},null,'Ministry membership')
  );
}

function renderServices(){
  const can=canManageChurch();
  const typeRows=data.serviceTypes.map(t=>'<tr><td><b>'+esc(t.name)+'</b><div class="cms-sub">'+esc(t.description||'')+'</div></td><td>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.day_of_week]+'</td><td>'+esc(t.start_time?.slice(0,5)||'—')+'</td><td>'+esc(t.location||'—')+'</td><td>'+badge(t.is_active?'Active':'Inactive',t.is_active?'ok':'muted')+'</td><td>'+(can?'<button class="cms-small" data-service-type="'+t.id+'">Edit</button>':'')+'</td></tr>').join('');
  const sessions=data.serviceSessions.slice(0,100).map(s=>{const att=new Set(data.attendance.filter(a=>phDay(a.checked_in_at)===s.service_date).map(a=>a.member_id)).size;return '<tr><td><b>'+esc(s.title||data.serviceTypes.find(t=>t.id===s.service_type_id)?.name||'Church Service')+'</b><div class="cms-sub">'+esc(s.theme||s.scripture||'')+'</div></td><td>'+esc(s.service_date)+'</td><td>'+esc(s.preacher_member_id?memberName(s.preacher_member_id):(s.guest_preacher||'—'))+'</td><td>'+att+'</td><td>'+badge(s.status,s.status==='Completed'?'ok':'')+'</td><td>'+(can?'<button class="cms-small" data-service-session="'+s.id+'">Edit</button>':'')+'</td></tr>';}).join('');
  content().innerHTML='<div class="cms-grid one"><section class="cms-panel card"><div class="cms-panel-head"><div><h3>Service Schedules</h3><p>Recurring church service templates.</p></div>'+(can?'<button id="addServiceType" class="btn">Add Schedule</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Service</th><th>Day</th><th>Time</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>'+typeRows+'</tbody></table></div></section>'+
    '<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Service Sessions</h3><p>Actual scheduled/completed church services.</p></div>'+(can?'<button id="addServiceSession" class="btn">Add Session</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Service</th><th>Date</th><th>Preacher</th><th>Attendance</th><th>Status</th><th></th></tr></thead><tbody>'+(sessions||'<tr><td colspan="6">'+empty('No service sessions yet.')+'</td></tr>')+'</tbody></table></div></section></div>';
  document.getElementById('addServiceType')?.addEventListener('click',()=>serviceTypeForm());
  document.getElementById('addServiceSession')?.addEventListener('click',()=>serviceSessionForm());
  content().querySelectorAll('[data-service-type]').forEach(b=>b.onclick=()=>serviceTypeForm(data.serviceTypes.find(x=>x.id===b.dataset.serviceType)));
  content().querySelectorAll('[data-service-session]').forEach(b=>b.onclick=()=>serviceSessionForm(data.serviceSessions.find(x=>x.id===b.dataset.serviceSession)));
}
function serviceTypeForm(t=null){
  modal(t?'Edit Service Schedule':'Add Service Schedule',
    '<div class="cms-form-grid"><label>Name<input name="name" required value="'+attr(t?.name||'')+'"></label><label>Day<select name="day_of_week">'+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d,i)=>'<option value="'+i+'" '+(Number(t?.day_of_week)===i?'selected':'')+'>'+d+'</option>').join('')+'</select></label></div>'+
    '<div class="cms-form-grid"><label>Start time<input name="start_time" type="time" value="'+attr(t?.start_time?.slice(0,5)||'')+'"></label><label>Location<input name="location" value="'+attr(t?.location||'')+'"></label></div>'+
    '<label>Status<select name="is_active"><option value="true" '+(t?.is_active!==false?'selected':'')+'>Active</option><option value="false" '+(t?.is_active===false?'selected':'')+'>Inactive</option></select></label>'+
    '<label>Description<textarea name="description" rows="3">'+esc(t?.description||'')+'</textarea></label>',
    async f=>saveRow('church_service_types',{name:f.get('name').trim(),day_of_week:Number(f.get('day_of_week')),start_time:f.get('start_time')||null,location:f.get('location').trim()||null,is_active:f.get('is_active')==='true',description:f.get('description').trim()||null,created_by:t?.created_by||currentUserId(),updated_at:new Date().toISOString()},t?.id,'Service schedule')
  );
}
function serviceSessionForm(s=null){
  modal(s?'Edit Service Session':'Add Service Session',
    '<div class="cms-form-grid"><label>Service type<select name="service_type_id"><option value="">Custom / None</option>'+data.serviceTypes.map(t=>'<option value="'+attr(t.id)+'" '+(s?.service_type_id===t.id?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label><label>Date<input name="service_date" type="date" required value="'+attr(s?.service_date||'')+'"></label></div>'+
    '<label>Title<input name="title" value="'+attr(s?.title||'')+'" placeholder="Optional custom title"></label>'+
    '<div class="cms-form-grid"><label>Preacher (member)<select name="preacher_member_id"><option value="">Guest / not set</option>'+memberOptions(s?.preacher_member_id||'')+'</select></label><label>Guest preacher<input name="guest_preacher" value="'+attr(s?.guest_preacher||'')+'"></label></div>'+
    '<div class="cms-form-grid"><label>Theme<input name="theme" value="'+attr(s?.theme||'')+'"></label><label>Scripture<input name="scripture" value="'+attr(s?.scripture||'')+'"></label></div>'+
    '<label>Status<select name="status">'+['Scheduled','Completed','Cancelled'].map(x=>'<option '+(s?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
    '<label>Notes<textarea name="notes" rows="4">'+esc(s?.notes||'')+'</textarea></label>',
    async f=>saveRow('church_service_sessions',{service_type_id:f.get('service_type_id')||null,service_date:f.get('service_date'),title:f.get('title').trim()||null,preacher_member_id:f.get('preacher_member_id')||null,guest_preacher:f.get('guest_preacher').trim()||null,theme:f.get('theme').trim()||null,scripture:f.get('scripture').trim()||null,status:f.get('status'),notes:f.get('notes').trim()||null,created_by:s?.created_by||currentUserId(),updated_at:new Date().toISOString()},s?.id,'Service session')
  );
}

function renderEvents(){
  void stopEventAttendanceScanner();
  const can=canManageEvents();
  const rows=data.events.map(e=>{
    const mode=e.participation_mode||(e.registration_required?'registration_required':'registration_optional'),eventRegs=data.registrations.filter(r=>r.event_id===e.id&&r.status!=='Cancelled'),regs=eventRegs.length,attended=eventRegs.filter(r=>r.status==='Attended'||r.checked_in_at).length;
    const scope=e.area_id?areaName(e.area_id):(e.ministry_id?ministryName(e.ministry_id):'Church-wide');
    const participation=mode==='attendance_only'?'<b>'+attended+' attendees</b><div class="cms-sub">Attendance only</div>':'<b>'+regs+(e.capacity?' / '+e.capacity:'')+'</b><div class="cms-sub">'+attended+' attended · '+(regs?Math.round(attended/regs*100):0)+'%</div>';
    return '<tr><td><b>'+esc(e.title)+'</b><div class="cms-sub">'+esc(e.event_type)+' · '+esc(scope)+'</div></td><td>'+fmtDateTime(e.start_at)+'</td><td>'+esc(e.location||'—')+'</td><td>'+participation+'</td><td>'+badge(e.status,e.status==='Completed'?'ok':'')+'</td><td class="cms-actions">'+(can?'<button class="cms-small" data-event-edit="'+e.id+'">Edit</button>'+(mode==='attendance_only'?'':'<button class="cms-small" data-event-register="'+e.id+'">Register</button>'):'')+'</td></tr>';
  }).join('');
  const regRows=data.registrations.slice(0,100).map(r=>'<tr><td>'+esc(data.events.find(e=>e.id===r.event_id)?.title||'Event')+'</td><td>'+esc(memberName(r.member_id))+'</td><td>'+badge(r.status,r.status==='Attended'?'ok':'')+'</td><td>'+fmtDateTime(r.checked_in_at)+'</td><td>'+fmtDate(r.registered_at)+'</td><td>'+(canManageChurch()?'<button class="cms-small danger-text" data-reg-delete="'+r.id+'">Remove</button>':'')+'</td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Events</h3><p>Create activities and manage registration. Check-ins are handled in the Attendance module.</p></div>'+(can?'<button id="addEvent" class="btn">Add Event</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Start</th><th>Location</th><th>Participation</th><th>Status</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>'+
    '<section class="cms-panel card"><div class="cms-panel-head"><h3>Recent Registrations</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th>Member</th><th>Status</th><th>Checked in</th><th>Registered</th><th></th></tr></thead><tbody>'+(regRows||'<tr><td colspan="6">'+empty('No registrations yet.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addEvent')?.addEventListener('click',()=>eventForm());
  content().querySelectorAll('[data-event-edit]').forEach(b=>b.onclick=()=>eventForm(data.events.find(x=>x.id===b.dataset.eventEdit)));
  content().querySelectorAll('[data-event-register]').forEach(b=>b.onclick=()=>registrationForm(b.dataset.eventRegister));
  content().querySelectorAll('[data-reg-delete]').forEach(b=>b.onclick=()=>deleteRow('church_event_registrations',b.dataset.regDelete,'Registration'));
}

function eventMemberOptions(eventId,query=''){
  const registered=new Set(data.registrations.filter(r=>r.event_id===eventId&&r.status!=='Cancelled').map(r=>r.member_id));
  const q=String(query).trim().toLowerCase();
  return (appState().members||[]).filter(m=>!q||(memberName(m.id)+' '+(m.member_code||'')).toLowerCase().includes(q)).slice().sort((a,b)=>memberName(a.id).localeCompare(memberName(b.id))).map(m=>'<option value="'+attr(m.id)+'">'+esc(memberName(m.id))+(registered.has(m.id)?' · Registered':'')+'</option>').join('');
}
function renderEventAttendance(eventId){
  const event=data.events.find(e=>e.id===eventId);if(!event){renderEvents();return;}const mode=event.participation_mode||(event.registration_required?'registration_required':'registration_optional'),attendanceOnly=mode==='attendance_only',regs=data.registrations.filter(r=>r.event_id===eventId&&r.status!=='Cancelled'),attended=regs.filter(r=>r.status==='Attended'||r.checked_in_at),rate=regs.length?Math.round(attended.length/regs.length*100):0,displayRows=attendanceOnly?attended:regs;
  content().innerHTML='<div class="event-attendance-head"><button id="backToEvents" class="cms-small" type="button">← Back to events</button><button id="exportEventAttendance" class="btn secondary" type="button">Export CSV</button></div><section class="cms-panel card"><div class="cms-panel-head"><div><span class="cms-kicker">EVENT ATTENDANCE</span><h3>'+esc(event.title)+'</h3><p>'+fmtDateTime(event.start_at)+' · '+esc(event.location||'Location not set')+'</p></div>'+badge(attendanceOnly?'Attendance only':event.status,event.status==='Completed'?'ok':'')+'</div><div class="event-attendance-stats '+(attendanceOnly?'attendance-only':'')+'">'+(attendanceOnly?'<div><span>Total attendees</span><strong>'+attended.length+'</strong></div><div><span>Registration</span><strong>Not required</strong></div>':'<div><span>Roster</span><strong>'+regs.length+'</strong></div><div><span>Attended</span><strong>'+attended.length+'</strong></div><div><span>Attendance rate</span><strong>'+rate+'%</strong></div><div><span>Not checked in</span><strong>'+Math.max(0,regs.length-attended.length)+'</strong></div>')+'</div><div class="cms-info">'+(attendanceOnly?'Members are added directly when they check in; no registration list is required. ':'')+'Event attendance is stored separately and does not affect Sunday attendance performance.</div></section><div class="event-checkin-grid"><section class="cms-panel card"><div class="cms-panel-head"><div><h3>Scan member QR</h3><p>Scan the QR from the member profile.</p></div></div><div id="eventAttendanceReader" class="event-scanner"><span>Camera is off</span></div><div class="cms-actions event-scan-actions"><button id="startEventScanner" class="btn" type="button">Start camera</button><button id="stopEventScanner" class="btn secondary" type="button" disabled>Stop</button></div><div id="eventScannerStatus" class="event-checkin-status" role="status"></div></section><section class="cms-panel card"><div class="cms-panel-head"><div><h3>Manual check-in</h3><p>'+(attendanceOnly?'Select any accessible member and record attendance directly.':'Registered and walk-in members can be checked in.')+'</p></div></div><label class="event-member-search">Search member<input id="eventMemberSearch" placeholder="Search name or member code…"></label><label class="event-member-search">Member<select id="eventMemberSelect"><option value="">Select a member</option>'+eventMemberOptions(eventId)+'</select></label><button id="eventManualCheckin" class="btn" type="button">Check in member</button><div id="eventManualStatus" class="event-checkin-status" role="status"></div></section></div><section class="cms-panel card"><div class="cms-panel-head"><div><h3>'+(attendanceOnly?'Event Attendees':'Event Roster')+'</h3><p>'+(attendanceOnly?'Members who attended this event.':'Attendance status and check-in time for this event.')+'</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Member</th><th>Area</th><th>Status</th><th>Check-in</th><th>Source</th><th></th></tr></thead><tbody>'+(displayRows.length?displayRows.map(r=>{const m=(appState().members||[]).find(x=>x.id===r.member_id),isIn=r.status==='Attended'||r.checked_in_at;return '<tr><td><b>'+esc(memberName(r.member_id))+'</b><div class="cms-sub">'+esc(m?.member_code||'')+'</div></td><td>'+esc(areaName(m?.area_id))+'</td><td>'+badge(isIn?'Attended':r.status,isIn?'ok':'')+'</td><td>'+fmtDateTime(r.checked_in_at)+'</td><td>'+esc(r.check_in_source||'—')+'</td><td><button class="cms-small '+(isIn?'danger-text':'')+'" data-event-toggle="'+r.id+'">'+(isIn?'Undo check-in':'Check in')+'</button></td></tr>'}).join(''):'<tr><td colspan="6">'+empty(attendanceOnly?'No attendees have checked in yet.':'No one is registered yet. Use manual check-in for walk-ins.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('backToEvents').onclick=async()=>{await stopEventAttendanceScanner();renderEvents()};document.getElementById('exportEventAttendance').onclick=()=>exportEventAttendance(event,regs);document.getElementById('startEventScanner').onclick=()=>startEventAttendanceScanner(eventId);document.getElementById('stopEventScanner').onclick=stopEventAttendanceScanner;
  const search=document.getElementById('eventMemberSearch'),select=document.getElementById('eventMemberSelect');search.oninput=()=>{select.innerHTML='<option value="">Select a member</option>'+eventMemberOptions(eventId,search.value)};
  document.getElementById('eventManualCheckin').onclick=e=>{if(!select.value){setEventAttendanceStatus('eventManualStatus','Select a member first.','error');return}checkInEventMember(eventId,select.value,'manual',e.currentTarget,'eventManualStatus')};
  content().querySelectorAll('[data-event-toggle]').forEach(b=>b.onclick=()=>toggleEventAttendance(b.dataset.eventToggle,eventId));
}
function setEventAttendanceStatus(id,message,kind=''){const el=document.getElementById(id);if(!el)return;el.className='event-checkin-status '+kind;el.textContent=message}
function eventMemberFromQr(raw){const code=String(raw||'').trim().replace(/^VCCF-MEMBER:/i,'');return (appState().members||[]).find(m=>String(m.member_code||'')===code||String(m.id)===code)}
async function checkInEventMember(eventId,memberId,source,button,statusId){
  const member=(appState().members||[]).find(m=>m.id===memberId);if(!member)return;const old=button?.textContent;if(button){button.disabled=true;button.textContent='Saving…'}setEventAttendanceStatus(statusId,'Recording event attendance…');
  try{const existing=data.registrations.find(r=>r.event_id===eventId&&r.member_id===memberId);if(existing&&(existing.status==='Attended'||existing.checked_in_at)){setEventAttendanceStatus(statusId,memberName(memberId)+' is already checked in.','warning');return}const values={status:'Attended',checked_in_at:new Date().toISOString(),checked_in_by:currentUserId(),check_in_source:source};const query=existing?sb().from('church_event_registrations').update(values).eq('id',existing.id).select().single():sb().from('church_event_registrations').insert({event_id:eventId,member_id:memberId,...values}).select().single();const result=await query;if(result.error)throw result.error;if(existing)data.registrations=data.registrations.map(r=>r.id===result.data.id?result.data:r);else data.registrations.unshift(result.data);await writeAudit('event_check_in','church_event_registrations',result.data.id,{event_id:eventId,member_id:memberId,source});await stopEventAttendanceScanner();renderEventAttendance(eventId);toast(memberName(memberId)+' checked in.',true)}catch(error){setEventAttendanceStatus(statusId,error.message||'Unable to check in.','error')}finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent=old}}
}
async function toggleEventAttendance(registrationId,eventId){const reg=data.registrations.find(r=>r.id===registrationId),event=data.events.find(e=>e.id===eventId);if(!reg||!event)return;const checked=reg.status==='Attended'||reg.checked_in_at,attendanceOnly=(event.participation_mode||(event.registration_required?'registration_required':'registration_optional'))==='attendance_only';if(checked&&!confirm('Undo this event check-in?'))return;if(checked&&attendanceOnly){const removed=await sb().from('church_event_registrations').delete().eq('id',registrationId);if(removed.error){toast(removed.error.message);return}data.registrations=data.registrations.filter(r=>r.id!==registrationId)}else{const values=checked?{status:'Registered',checked_in_at:null,checked_in_by:null,check_in_source:null}:{status:'Attended',checked_in_at:new Date().toISOString(),checked_in_by:currentUserId(),check_in_source:'manual'},result=await sb().from('church_event_registrations').update(values).eq('id',registrationId).select().single();if(result.error){toast(result.error.message);return}data.registrations=data.registrations.map(r=>r.id===registrationId?result.data:r)}await writeAudit(checked?'event_check_in_undo':'event_check_in','church_event_registrations',registrationId,{event_id:eventId,member_id:reg.member_id});renderEventAttendance(eventId);toast(checked?'Check-in removed.':'Member checked in.',true)}
async function startEventAttendanceScanner(eventId){if(!window.Html5Qrcode){setEventAttendanceStatus('eventScannerStatus','Scanner is still loading.','error');return}if(eventScanner)return;const start=document.getElementById('startEventScanner'),stop=document.getElementById('stopEventScanner');start.disabled=true;setEventAttendanceStatus('eventScannerStatus','Requesting camera access…');eventScanner=new Html5Qrcode('eventAttendanceReader');try{await eventScanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},async decoded=>{const m=eventMemberFromQr(decoded);if(!m){setEventAttendanceStatus('eventScannerStatus','QR does not match an accessible member.','error');return}await checkInEventMember(eventId,m.id,'qr',null,'eventScannerStatus')},()=>{});stop.disabled=false;setEventAttendanceStatus('eventScannerStatus','Camera ready. Point it at a member QR.','success')}catch(error){eventScanner=null;start.disabled=false;setEventAttendanceStatus('eventScannerStatus','Camera permission or a camera device is required.','error')}}
async function stopEventAttendanceScanner(){if(eventScanner){try{await eventScanner.stop()}catch(error){}try{eventScanner.clear()}catch(error){}eventScanner=null}const start=document.getElementById('startEventScanner'),stop=document.getElementById('stopEventScanner');if(start)start.disabled=false;if(stop)stop.disabled=true}
function exportEventAttendance(event,regs){const attendanceOnly=(event.participation_mode||(event.registration_required?'registration_required':'registration_optional'))==='attendance_only',records=attendanceOnly?regs.filter(r=>r.status==='Attended'||r.checked_in_at):regs,rows=[['Member','Member Code','Area','Status','Checked In','Source']];records.forEach(r=>{const m=(appState().members||[]).find(x=>x.id===r.member_id);rows.push([memberName(r.member_id),m?.member_code||'',areaName(m?.area_id),r.status,r.checked_in_at?fmtDateTime(r.checked_in_at):'',r.check_in_source||''])});const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=(event.title||'event').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-attendance.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function eventForm(e=null){
  const participation=e?.participation_mode||(e?.registration_required?'registration_required':'registration_optional');
  modal(e?'Edit Event':'Add Event',
    '<div class="cms-form-grid"><label>Title<input name="title" required value="'+attr(e?.title||'')+'"></label><label>Type<input name="event_type" value="'+attr(e?.event_type||'General')+'"></label></div>'+
    '<div class="cms-form-grid"><label>Start<input name="start_at" type="datetime-local" required value="'+attr(toLocalInput(e?.start_at))+'"></label><label>End<input name="end_at" type="datetime-local" value="'+attr(toLocalInput(e?.end_at))+'"></label></div>'+
    '<div class="cms-form-grid"><label>Area<select name="area_id">'+areaOptions(e?.area_id||'')+'</select></label><label>Ministry<select name="ministry_id">'+ministryOptions(e?.ministry_id||'')+'</select></label></div>'+
    '<div class="cms-form-grid"><label>Location<input name="location" value="'+attr(e?.location||'')+'"></label><label>Capacity<input name="capacity" type="number" min="0" value="'+attr(e?.capacity??'')+'"></label></div>'+
    '<div class="cms-form-grid"><label>Status<select name="status">'+['Draft','Scheduled','Completed','Cancelled'].map(x=>'<option '+(e?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Participation workflow<select name="participation_mode"><option value="registration_required" '+(participation==='registration_required'?'selected':'')+'>Registration required</option><option value="registration_optional" '+(participation==='registration_optional'?'selected':'')+'>Registration optional</option><option value="attendance_only" '+(participation==='attendance_only'?'selected':'')+'>Attendance only — no registration</option></select></label></div>'+
    '<label>Description<textarea name="description" rows="4">'+esc(e?.description||'')+'</textarea></label>',
    async f=>{const mode=f.get('participation_mode');return saveRow('church_events',{title:f.get('title').trim(),event_type:f.get('event_type').trim()||'General',start_at:manilaIso(f.get('start_at')),end_at:manilaIso(f.get('end_at')),area_id:f.get('area_id')||null,ministry_id:f.get('ministry_id')||null,location:f.get('location').trim()||null,capacity:f.get('capacity')?Number(f.get('capacity')):null,status:f.get('status'),participation_mode:mode,registration_required:mode==='registration_required',description:f.get('description').trim()||null,created_by:e?.created_by||currentUserId(),updated_at:new Date().toISOString()},e?.id,'Event')}
  );
}
function registrationForm(eventId){
  const registrable=data.events.filter(e=>(e.participation_mode||(e.registration_required?'registration_required':'registration_optional'))!=='attendance_only');
  modal('Register Member',
    '<label>Event<select name="event_id" required>'+registrable.map(e=>'<option value="'+attr(e.id)+'" '+(e.id===eventId?'selected':'')+'>'+esc(e.title)+'</option>').join('')+'</select></label>'+
    '<label>Member<select name="member_id" required><option value="">Select member</option>'+memberOptions()+'</select></label>'+
    '<label>Status<select name="status">'+['Registered','Confirmed','Attended','Cancelled'].map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
    '<label>Notes<textarea name="notes" rows="3"></textarea></label>',
    async f=>saveRow('church_event_registrations',{event_id:f.get('event_id'),member_id:f.get('member_id'),status:f.get('status'),notes:f.get('notes').trim()||null},null,'Registration')
  );
}

function renderLeadership(){
  const can=canManageChurch();
  const rows=data.leadership.map(l=>'<tr><td><b>'+esc(memberName(l.member_id))+'</b></td><td>'+esc(l.role_title)+'</td><td>'+esc(l.leadership_type)+'</td><td>'+esc(l.area_id?areaName(l.area_id):(l.ministry_id?ministryName(l.ministry_id):'Church-wide'))+'</td><td>'+badge(l.is_active?'Active':'Inactive',l.is_active?'ok':'muted')+'</td><td>'+(can?'<button class="cms-small" data-leader-edit="'+l.id+'">Edit</button><button class="cms-small danger-text" data-leader-delete="'+l.id+'">Delete</button>':'')+'</td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Leadership Directory</h3><p>Pastors, elders, area leaders and ministry leaders.</p></div>'+(can?'<button id="addLeader" class="btn">Add Leader</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Member</th><th>Role</th><th>Type</th><th>Scope</th><th>Status</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">'+empty('No leadership assignments yet.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addLeader')?.addEventListener('click',()=>leadershipForm());
  content().querySelectorAll('[data-leader-edit]').forEach(b=>b.onclick=()=>leadershipForm(data.leadership.find(x=>x.id===b.dataset.leaderEdit)));
  content().querySelectorAll('[data-leader-delete]').forEach(b=>b.onclick=()=>deleteRow('church_leadership',b.dataset.leaderDelete,'Leadership assignment'));
}
function leadershipForm(l=null){
  modal(l?'Edit Leadership Assignment':'Add Leadership Assignment',
    '<label>Member<select name="member_id" required><option value="">Select member</option>'+memberOptions(l?.member_id||'')+'</select></label>'+
    '<div class="cms-form-grid"><label>Role title<input name="role_title" required value="'+attr(l?.role_title||'')+'" placeholder="Senior Pastor, Area 1 Leader"></label><label>Type<select name="leadership_type">'+['Pastor','Elder','Deacon','Area Leader','Ministry Leader','Other'].map(x=>'<option '+(l?.leadership_type===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
    '<div class="cms-form-grid"><label>Area<select name="area_id">'+areaOptions(l?.area_id||'')+'</select></label><label>Ministry<select name="ministry_id">'+ministryOptions(l?.ministry_id||'')+'</select></label></div>'+
    '<div class="cms-form-grid"><label>Start date<input name="start_date" type="date" value="'+attr(l?.start_date||'')+'"></label><label>End date<input name="end_date" type="date" value="'+attr(l?.end_date||'')+'"></label></div>'+
    '<div class="cms-form-grid"><label>Status<select name="is_active"><option value="true" '+(l?.is_active!==false?'selected':'')+'>Active</option><option value="false" '+(l?.is_active===false?'selected':'')+'>Inactive</option></select></label><label>Display order<input name="display_order" type="number" value="'+attr(l?.display_order??0)+'"></label></div>',
    async f=>saveRow('church_leadership',{member_id:f.get('member_id'),role_title:f.get('role_title').trim(),leadership_type:f.get('leadership_type'),area_id:f.get('area_id')||null,ministry_id:f.get('ministry_id')||null,start_date:f.get('start_date')||null,end_date:f.get('end_date')||null,is_active:f.get('is_active')==='true',display_order:Number(f.get('display_order')||0),created_by:l?.created_by||currentUserId(),updated_at:new Date().toISOString()},l?.id,'Leadership assignment')
  );
}

function renderPastoral(){
  const rows=data.pastoral.map(p=>'<tr><td><b>'+esc(memberName(p.member_id))+'</b><div class="cms-sub">'+esc(p.followup_type||'General')+'</div></td><td>'+esc(p.reason)+'</td><td>'+badge(p.priority||'Normal')+'</td><td>'+esc(p.followup_on||'—')+'</td><td>'+badge(p.status,p.status==='Completed'?'ok':'')+'</td><td><button class="cms-small" data-pastoral-edit="'+p.id+'">Edit</button></td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Pastoral Care</h3><p>Restricted follow-ups, visits and care notes. Access is limited by role and area.</p></div><button id="addPastoral" class="btn">Add Follow-up</button></div>'+
    '<div class="cms-sensitive">Pastoral notes are private leadership records. Avoid recording unnecessary medical, financial, or other highly sensitive details.</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Member</th><th>Reason</th><th>Priority</th><th>Follow-up</th><th>Status</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">'+empty('No pastoral follow-ups.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addPastoral').onclick=()=>pastoralForm();
  content().querySelectorAll('[data-pastoral-edit]').forEach(b=>b.onclick=()=>pastoralForm(data.pastoral.find(x=>x.id===b.dataset.pastoralEdit)));
}
function pastoralForm(p=null){
  modal(p?'Edit Pastoral Follow-up':'Add Pastoral Follow-up',
    '<label>Member<select name="member_id" required><option value="">Select member</option>'+memberOptions(p?.member_id||'')+'</select></label>'+
    '<div class="cms-form-grid"><label>Type<input name="followup_type" value="'+attr(p?.followup_type||'General')+'"></label><label>Priority<select name="priority">'+['Low','Normal','High','Urgent'].map(x=>'<option '+(p?.priority===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
    '<label>Reason<input name="reason" required value="'+attr(p?.reason||'')+'"></label>'+
    '<div class="cms-form-grid"><label>Status<select name="status">'+['Pending','In Progress','Completed','Deferred'].map(x=>'<option '+(p?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Follow-up date<input name="followup_on" type="date" value="'+attr(p?.followup_on||'')+'"></label></div>'+
    (data.profiles.length?'<label>Assigned to<select name="assigned_to">'+profileOptions(p?.assigned_to||'')+'</select></label>':'')+
    '<label>Notes<textarea name="notes" rows="5">'+esc(p?.notes||'')+'</textarea></label>',
    async f=>saveRow('pastoral_followups',{member_id:f.get('member_id'),followup_type:f.get('followup_type').trim()||'General',priority:f.get('priority'),reason:f.get('reason').trim(),status:f.get('status'),followup_on:f.get('followup_on')||null,assigned_to:f.get('assigned_to')||p?.assigned_to||currentUserId(),notes:f.get('notes').trim()||null,confidential:true,created_by:p?.created_by||currentUserId(),updated_at:new Date().toISOString()},p?.id,'Pastoral follow-up')
  );
}

function renderPrayer(){
  const rows=data.prayers.map(p=>'<tr><td><b>'+(p.is_anonymous?'Anonymous':esc(memberName(p.member_id)))+'</b><div class="cms-sub">'+esc(p.category||'General')+'</div></td><td class="cms-clamp">'+esc(p.request_text)+'</td><td>'+badge(p.visibility||'Private')+'</td><td>'+badge(p.status,p.status==='Answered'?'ok':'')+'</td><td>'+fmtDate(p.created_at)+'</td><td><button class="cms-small" data-prayer-edit="'+p.id+'">Edit</button></td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Prayer Requests</h3><p>Requests can remain private or be shared with leadership.</p></div><button id="addPrayer" class="btn">Add Request</button></div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Requester</th><th>Request</th><th>Visibility</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">'+empty('No prayer requests.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addPrayer').onclick=()=>prayerForm();
  content().querySelectorAll('[data-prayer-edit]').forEach(b=>b.onclick=()=>prayerForm(data.prayers.find(x=>x.id===b.dataset.prayerEdit)));
}
function prayerForm(p=null){
  const selectable=canSeePastoral() ? '<option value="">Select member</option>'+memberOptions(p?.member_id||'') : '<option value="'+attr(currentMemberId())+'" selected>'+esc(memberName(currentMemberId()))+'</option>';
  modal(p?'Edit Prayer Request':'Add Prayer Request',
    '<label>Member<select name="member_id" required>'+selectable+'</select></label>'+
    '<div class="cms-form-grid"><label>Category<input name="category" value="'+attr(p?.category||'')+'" placeholder="Family, Healing, Guidance"></label><label>Visibility<select name="visibility">'+['Private','Leaders','Church'].map(x=>'<option '+(p?.visibility===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
    '<label>Prayer request<textarea name="request_text" rows="5" required>'+esc(p?.request_text||'')+'</textarea></label>'+
    '<div class="cms-form-grid"><label>Status<select name="status">'+['Praying','Follow-up','Answered','Closed'].map(x=>'<option '+(p?.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Anonymous<select name="is_anonymous"><option value="false" '+(!p?.is_anonymous?'selected':'')+'>No</option><option value="true" '+(p?.is_anonymous?'selected':'')+'>Yes</option></select></label></div>',
    async f=>saveRow('prayer_requests',{member_id:f.get('member_id'),category:f.get('category').trim()||null,visibility:f.get('visibility'),request_text:f.get('request_text').trim(),status:f.get('status'),is_anonymous:f.get('is_anonymous')==='true',assigned_to:p?.assigned_to||null,answered_at:f.get('status')==='Answered'?(p?.answered_at||new Date().toISOString()):null,updated_at:new Date().toISOString()},p?.id,'Prayer request')
  );
}

function renderAnnouncements(){
  const can=canManageAnnouncements();
  const rows=data.announcements.map(a=>'<tr><td><b>'+esc(a.title)+'</b><div class="cms-sub">'+esc(a.body.slice(0,100))+(a.body.length>100?'…':'')+'</div></td><td>'+badge(a.audience)+'</td><td>'+fmtDateTime(a.publish_at)+'</td><td>'+badge(a.is_published?'Published':'Draft',a.is_published?'ok':'muted')+'</td><td>'+(can?'<button class="cms-small" data-ann-edit="'+a.id+'">Edit</button>':'')+'</td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Announcements</h3><p>Church-wide or targeted announcements.</p></div>'+(can?'<button id="addAnnouncement" class="btn">Add Announcement</button>':'')+'</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Announcement</th><th>Audience</th><th>Publish</th><th>Status</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">'+empty('No announcements.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addAnnouncement')?.addEventListener('click',()=>announcementForm());
  content().querySelectorAll('[data-ann-edit]').forEach(b=>b.onclick=()=>announcementForm(data.announcements.find(x=>x.id===b.dataset.annEdit)));
}
function announcementForm(a=null){
  modal(a?'Edit Announcement':'Add Announcement',
    '<label>Title<input name="title" required value="'+attr(a?.title||'')+'"></label><label>Message<textarea name="body" rows="5" required>'+esc(a?.body||'')+'</textarea></label>'+
    '<div class="cms-form-grid"><label>Audience<select name="audience">'+['All','Leaders','Area','Ministry'].map(x=>'<option '+(a?.audience===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Published<select name="is_published"><option value="true" '+(a?.is_published!==false?'selected':'')+'>Published</option><option value="false" '+(a?.is_published===false?'selected':'')+'>Draft</option></select></label></div>'+
    '<div class="cms-form-grid"><label>Area<select name="area_id">'+areaOptions(a?.area_id||'')+'</select></label><label>Ministry<select name="ministry_id">'+ministryOptions(a?.ministry_id||'')+'</select></label></div>'+
    '<div class="cms-form-grid"><label>Publish at<input name="publish_at" type="datetime-local" value="'+attr(toLocalInput(a?.publish_at||new Date().toISOString()))+'"></label><label>Expires at<input name="expires_at" type="datetime-local" value="'+attr(toLocalInput(a?.expires_at))+'"></label></div>',
    async f=>saveRow('church_announcements',{title:f.get('title').trim(),body:f.get('body').trim(),audience:f.get('audience'),area_id:f.get('area_id')||null,ministry_id:f.get('ministry_id')||null,is_published:f.get('is_published')==='true',publish_at:manilaIso(f.get('publish_at'))||new Date().toISOString(),expires_at:manilaIso(f.get('expires_at')),created_by:a?.created_by||currentUserId(),updated_at:new Date().toISOString()},a?.id,'Announcement')
  );
}

function renderDocuments(){
  const can=canManageChurch();
  const rows=data.documents.map(d=>{
    let link='—';
    if(d.storage_path) link='<button class="cms-small" data-doc-file="'+d.id+'">Open File</button>';
    else if(d.external_url) link='<a class="cms-link" href="'+attr(d.external_url)+'" target="_blank" rel="noopener">Open Link</a>';
    return '<tr><td><b>'+esc(d.title)+'</b><div class="cms-sub">'+esc(d.file_name||d.description||'')+'</div></td><td>'+esc(d.category)+'</td><td>'+badge(d.visibility)+'</td><td>'+link+'</td><td>'+badge(d.is_active?'Active':'Inactive',d.is_active?'ok':'muted')+'</td><td>'+(can?'<button class="cms-small" data-doc-edit="'+d.id+'">Edit</button>':'')+'</td></tr>';
  }).join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Documents</h3><p>Church forms, policies, reference links and administrative documents.</p></div>'+(can?'<button id="addDocument" class="btn">Add Document</button>':'')+'</div>'+
    '<div class="cms-info">Uploaded files are stored in a private bucket. Access is checked by role/scope and files are opened through short-lived signed links.</div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Document</th><th>Category</th><th>Visibility</th><th>Access</th><th>Status</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">'+empty('No documents yet.')+'</td></tr>')+'</tbody></table></div></section>';
  document.getElementById('addDocument')?.addEventListener('click',()=>documentForm());
  content().querySelectorAll('[data-doc-edit]').forEach(b=>b.onclick=()=>documentForm(data.documents.find(x=>x.id===b.dataset.docEdit)));
  content().querySelectorAll('[data-doc-file]').forEach(b=>b.onclick=()=>openDocument(data.documents.find(x=>x.id===b.dataset.docFile)));
}
async function openDocument(d){
  if(!d) return;
  if(d.storage_path){
    const r=await sb().storage.from('vccf-church-documents').createSignedUrl(d.storage_path,120);
    if(r.error){toast(r.error.message);return;}
    window.open(r.data.signedUrl,'_blank','noopener');
    return;
  }
  if(d.external_url) window.open(d.external_url,'_blank','noopener');
}
function documentForm(d=null){
  modal(d?'Edit Document':'Add Document',
    '<label>Title<input name="title" required value="'+attr(d?.title||'')+'"></label>'+
    '<div class="cms-form-grid"><label>Category<input name="category" value="'+attr(d?.category||'General')+'"></label><label>Visibility<select name="visibility">'+['All','Leaders','Admin'].map(x=>'<option '+(d?.visibility===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
    '<label>Upload file<input name="file" type="file"><span class="cms-sub">'+(d?.file_name?'Current file: '+esc(d.file_name):'Maximum 50 MB. Leave blank to keep the current file.')+'</span></label>'+
    '<label>External / secure link<input name="external_url" type="url" value="'+attr(d?.external_url||'')+'" placeholder="https://"></label>'+
    '<div class="cms-form-grid"><label>Area<select name="area_id">'+areaOptions(d?.area_id||'')+'</select></label><label>Ministry<select name="ministry_id">'+ministryOptions(d?.ministry_id||'')+'</select></label></div>'+
    '<label>Status<select name="is_active"><option value="true" '+(d?.is_active!==false?'selected':'')+'>Active</option><option value="false" '+(d?.is_active===false?'selected':'')+'>Inactive</option></select></label>'+
    '<label>Description<textarea name="description" rows="4">'+esc(d?.description||'')+'</textarea></label>',
    async f=>saveDocument(f,d)
  );
}
async function saveDocument(f,d=null){
  const client=sb(); if(!client) throw new Error('Database client unavailable.');
  const file=f.get('file');
  let newPath=null;
  let payload={
    title:f.get('title').trim(),
    category:f.get('category').trim()||'General',
    visibility:f.get('visibility'),
    external_url:f.get('external_url').trim()||null,
    area_id:f.get('area_id')||null,
    ministry_id:f.get('ministry_id')||null,
    is_active:f.get('is_active')==='true',
    description:f.get('description').trim()||null,
    created_by:d?.created_by||currentUserId(),
    updated_at:new Date().toISOString(),
    storage_path:d?.storage_path||null,
    file_name:d?.file_name||null,
    mime_type:d?.mime_type||null,
    file_size:d?.file_size||null
  };
  if(file && file.name){
    if(file.size>50*1024*1024) throw new Error('The selected file is larger than 50 MB.');
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'document';
    newPath='documents/'+crypto.randomUUID()+'/'+safe;
    const up=await client.storage.from('vccf-church-documents').upload(newPath,file,{upsert:false,contentType:file.type||undefined});
    if(up.error) throw up.error;
    payload.storage_path=newPath;
    payload.file_name=file.name;
    payload.mime_type=file.type||null;
    payload.file_size=file.size;
  }
  try{
    const q=d
      ? client.from('church_documents').update(payload).eq('id',d.id).select().maybeSingle()
      : client.from('church_documents').insert(payload).select().maybeSingle();
    const r=await q;
    if(r.error) throw r.error;
    if(newPath && d?.storage_path && d.storage_path!==newPath){
      await client.storage.from('vccf-church-documents').remove([d.storage_path]);
    }
    await writeAudit(d?'update':'create','church_documents',r.data?.id||d?.id,{title:payload.title,file:payload.file_name});
    loaded=false;await loadAll(true);renderActive();toast('Document '+(d?'updated.':'created.'),true);
  }catch(err){
    if(newPath) await client.storage.from('vccf-church-documents').remove([newPath]);
    throw err;
  }
}

function renderReports(){
  const members=appState().members||[];
  const active=members.filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive');
  const inactive=members.filter(m=>m.is_active===false||String(m.status||'').toLowerCase()==='inactive');
  const new30=members.filter(m=>m.created_at&&new Date(m.created_at).getTime()>=Date.now()-30*86400000).length;
  const last30=data.attendance.filter(a=>new Date(a.checked_in_at).getTime()>=Date.now()-30*86400000);
  const attendanceMembers=new Set(last30.map(a=>a.member_id));
  const attendanceRate=active.length?Math.round(attendanceMembers.size/active.length*100):0;
  const areaRows=data.areas.map(a=>{
    const total=members.filter(m=>m.area_id===a.id).length;
    const activeArea=active.filter(m=>m.area_id===a.id).length;
    const present=new Set(last30.filter(x=>x.area_id===a.id).map(x=>x.member_id)).size;
    const rate=activeArea?Math.round(present/activeArea*100):0;
    return '<tr><td>'+esc(a.name)+'</td><td>'+total+'</td><td>'+activeArea+'</td><td>'+present+'</td><td>'+rate+'%</td></tr>';
  }).join('');
  const ministryRows=data.ministries.map(m=>'<tr><td>'+esc(m.name)+'</td><td>'+data.ministryMembers.filter(x=>x.ministry_id===m.id).length+'</td><td>'+esc(m.leader_member_id?memberName(m.leader_member_id):'—')+'</td></tr>').join('');
  const inactiveRows=inactive.slice(0,150).map(m=>'<tr><td>'+esc(memberName(m.id))+'</td><td>'+esc(areaName(m.area_id))+'</td><td>'+esc(m.status||'Inactive')+'</td></tr>').join('');
  content().innerHTML='<div class="cms-stats">'+
    statCard('Active Members',active.length)+statCard('Inactive Members',inactive.length)+statCard('New Members · 30d',new30)+statCard('30-day unique attendance',attendanceMembers.size)+statCard('30-day member reach',attendanceRate+'%')+statCard('Upcoming events',data.events.filter(e=>new Date(e.start_at)>new Date()).length)+statCard('Completed services',data.serviceSessions.filter(s=>s.status==='Completed').length)+
    '</div>'+
    '<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Area Comparison · Last 30 Days</h3><p>Unique attendance reach compared with active members.</p></div><button id="exportCmsReport" class="btn secondary">Export CSV</button></div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Area</th><th>Total</th><th>Active</th><th>Reached</th><th>Reach Rate</th></tr></thead><tbody>'+areaRows+'</tbody></table></div></section>'+
    '<div class="cms-grid two"><section class="cms-panel card"><h3>Ministry Participation</h3><div class="table-wrap"><table class="table"><thead><tr><th>Ministry</th><th>Members</th><th>Leader</th></tr></thead><tbody>'+ministryRows+'</tbody></table></div></section>'+
    '<section class="cms-panel card"><h3>Inactive Members</h3><div class="table-wrap"><table class="table"><thead><tr><th>Member</th><th>Area</th><th>Status</th></tr></thead><tbody>'+(inactiveRows||'<tr><td colspan="3">'+empty('No inactive members.')+'</td></tr>')+'</tbody></table></div></section></div>';
  document.getElementById('exportCmsReport').onclick=exportReport;
}
function exportReport(){
  const rows=[['Metric','Value'],['Total Members',(appState().members||[]).length],['Active Areas',data.areas.filter(a=>a.is_active!==false).length],['Active Ministries',data.ministries.filter(m=>m.is_active!==false).length],['Leadership Assignments',data.leadership.filter(l=>l.is_active).length],['Upcoming Events',data.events.filter(e=>new Date(e.start_at)>new Date()).length],['Open Prayer Requests',data.prayers.filter(p=>!['Answered','Closed'].includes(p.status)).length]];
  rows.push([]); rows.push(['Area','Members','30-day attendance reach']);
  data.areas.forEach(a=>{
    const ms=(appState().members||[]).filter(m=>m.area_id===a.id);
    const reached=new Set(data.attendance.filter(x=>x.area_id===a.id&&new Date(x.checked_in_at).getTime()>=Date.now()-30*86400000).map(x=>x.member_id)).size;
    rows.push([a.name,ms.length,reached]);
  });
  const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='vccf-church-management-report.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function renderAccess(){
  if(!isAdmin()){content().innerHTML=empty('Administrator access required.');return;}
  const rows=data.profiles.map(p=>'<tr><td><b>'+esc(p.display_name||'Unnamed account')+'</b><div class="cms-sub">'+esc(p.member_id?memberName(p.member_id):'No linked member')+'</div></td><td>'+badge(String(p.role).replace(/_/g,' '))+'</td><td>'+esc(p.area_id?areaName(p.area_id):'—')+'</td><td><button class="cms-small" data-access-edit="'+p.user_id+'">Edit Access</button></td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>User & Access Management</h3><p>Authentication remains separate from member records. This controls app authorization only.</p></div></div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Account</th><th>Role</th><th>Area</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
  content().querySelectorAll('[data-access-edit]').forEach(b=>b.onclick=()=>accessForm(data.profiles.find(x=>x.user_id===b.dataset.accessEdit)));
}
function accessForm(p){
  modal('Edit Access — '+(p.display_name||'Account'),
    '<label>Role<select name="role">'+[['admin','Admin'],['pastor','Pastor'],['area_leader','Area Leader'],['member','Member']].map(([v,l])=>'<option value="'+v+'" '+(p.role===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    '<label>Area<select name="area_id">'+areaOptions(p.area_id||'')+'</select></label>'+
    '<div class="cms-info">Admin and Pastor accounts are church-wide. Area Leader accounts must be assigned to an Area. Members can access their own member record.</div>',
    async f=>{
      let ar=f.get('area_id')||null, rr=f.get('role'); if(rr==='admin'||rr==='pastor') ar=null;
      if(rr==='area_leader'&&!ar) throw new Error('Select an Area for the Area Leader.');
      const r=await sb().from('profiles').update({role:rr,area_id:ar,updated_at:new Date().toISOString()}).eq('user_id',p.user_id);
      if(r.error) throw r.error;
      await writeAudit('update','profiles',null,{user_id:p.user_id,role:rr,area_id:ar});
      loaded=false; await loadAll(true); renderActive(); toast('Access updated.',true);
    }
  );
}

function renderAudit(){
  if(!isAdmin()){content().innerHTML=empty('Administrator access required.');return;}
  const rows=data.audit.map(a=>'<tr><td>'+fmtDateTime(a.created_at)+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.entity_type||'—')+'</td><td>'+esc(data.profiles.find(p=>p.user_id===a.actor_user_id)?.display_name||a.actor_user_id||'System')+'</td><td class="cms-json">'+esc(JSON.stringify(a.metadata||{}))+'</td></tr>').join('');
  content().innerHTML='<section class="cms-panel card"><div class="cms-panel-head"><div><h3>Activity / Audit Log</h3><p>Recent Church Management changes.</p></div></div>'+
    '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Actor</th><th>Metadata</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5">'+empty('No audit entries.')+'</td></tr>')+'</tbody></table></div></section>';
}

function renderActive(){
  if(!root()) return;
  const roleEl=document.getElementById('cmsRole');if(roleEl)roleEl.textContent=(role()||'member').replace(/_/g,' ');
  if(!loaded){ content().innerHTML='<div class="cms-panel card">'+empty('Loading Church Management…')+'</div>'; loadAll().then(renderActive); return; }
  const map={overview:renderOverview,areas:renderAreas,ministries:renderMinistries,services:renderServices,events:renderEvents,leadership:renderLeadership,pastoral:renderPastoral,prayer:renderPrayer,announcements:renderAnnouncements,documents:renderDocuments,reports:renderReports,access:renderAccess,audit:renderAudit};
  (map[activeTab]||renderOverview)();
}

async function init(){
  if(!document.getElementById('app')?.classList.contains('show')) return;
  shell();
  await loadAll();
  renderActive();
}

function navigate(tab){
  activeTab=tab||'overview';
  shell();
  renderActive();
  window.dispatchEvent(new CustomEvent('vccf-cms-route',{detail:{route:activeTab}}));
}
window.VCCFChurchManagement={navigate,refresh:async()=>{loaded=false;await loadAll(true);renderActive();}};

window.addEventListener('vccf-app-ready',()=>setTimeout(init,0));
window.addEventListener('vccf-signed-out',()=>{loaded=false;data={areas:[],ministries:[],ministryMembers:[],serviceTypes:[],serviceSessions:[],events:[],registrations:[],leadership:[],pastoral:[],prayers:[],announcements:[],documents:[],profiles:[],audit:[],attendance:[]};});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
else setTimeout(init,0);
})();
