(()=>{
'use strict';
if(window.__VCCF_SUITE_V1__)return;window.__VCCF_SUITE_V1__=true;
const cfg=window.VCCF_SUPABASE_URL&&window.VCCF_SUPABASE_PUBLISHABLE_KEY;
if(!cfg||!window.supabase)return;
const client=window.supabase.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const toast=m=>{const x=$('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2600)}};
let S={user:null,profile:null,member:null,members:[],areas:[],attendance:[],events:[],notifications:[]};
const role=()=>S.profile?.role||null;const isAdmin=()=>role()==='admin';const isLeader=()=>role()==='area_leader';
async function load(){
 const {data:{user}}=await client.auth.getUser();S.user=user;if(!user)return;
 const [p,a,m,att,e,n]=await Promise.all([
   client.from('profiles').select('*,members(*)').eq('user_id',user.id).maybeSingle(),
   client.from('areas').select('*').order('name'),
   client.from('members').select('*').order('display_name'),
   client.from('attendance').select('*').order('checked_in_at',{ascending:false}),
   client.from('vccf_events').select('*').order('event_date',{ascending:true}).limit(100),
   client.from('vccf_notifications').select('*').order('created_at',{ascending:false}).limit(50)
 ]);
 S.profile=p.data;S.areas=a.data||[];S.members=m.data||[];S.attendance=att.data||[];S.events=e.data||[];S.notifications=n.data||[];S.member=p.data?.members||null;
 if(isLeader())S.members=S.members.filter(x=>x.area_id===S.profile.area_id);
}
function memberName(m){return m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||'Member'}
function initials(n){return n.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?'}
function areaName(id){return S.areas.find(x=>x.id===id)?.name||'Unassigned'}
function fmtDate(v){if(!v)return '';return new Date(v+'T12:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}
function addNav(){
 const nav=document.querySelector('.nav');if(!nav||nav.querySelector('[data-suite-view]'))return;
 const items=[['analytics','Analytics','◔'],['events','Events','▣'],['notifications','Notifications','●'],['profile','My Profile','◉']];
 items.forEach(([v,label,icon])=>{const b=document.createElement('button');b.type='button';b.dataset.suiteView=v;b.dataset.view=v;b.innerHTML=`<span aria-hidden="true">${icon}</span> ${label}`;b.onclick=()=>openView(v);nav.appendChild(b)});
}
function addViews(){
 const main=document.querySelector('.main');if(!main||$('suite-analytics'))return;
 const wrap=s=>{const sec=document.createElement('section');sec.id='suite-'+s;sec.className='view';main.appendChild(sec);return sec};
 wrap('analytics').innerHTML=`<div class="suite-shell"><div class="suite-toolbar"><div><div class="suite-muted">Leadership analytics</div><h3 style="margin:4px 0">Attendance overview</h3></div><div class="suite-actions"><select id="suiteAnalyticsRange" class="search"><option value="8">Last 8 weeks</option><option value="16">Last 16 weeks</option></select></div></div><div id="suiteAnalyticsBody"></div></div>`;
 wrap('events').innerHTML=`<div class="suite-shell"><div class="suite-toolbar"><div><div class="suite-muted">Church calendar</div><h3 style="margin:4px 0">Events</h3></div><div class="suite-actions">${isAdmin()?'<button class="btn" id="suiteAddEvent">+ Add event</button>':''}</div></div><div id="suiteEventsList"></div></div>`;
 wrap('notifications').innerHTML=`<div class="suite-shell"><div class="suite-toolbar"><div><div class="suite-muted">Your VCCF inbox</div><h3 style="margin:4px 0">Notifications</h3></div><div class="suite-actions">${isAdmin()?'<button class="btn" id="suiteBroadcast">Broadcast</button>':''}<button class="btn secondary" id="suiteMarkRead">Mark all read</button></div></div><div id="suiteNotificationsList"></div></div>`;
 wrap('profile').innerHTML=`<div class="suite-shell"><div class="suite-toolbar"><div><div class="suite-muted">Member profile</div><h3 style="margin:4px 0">My Profile</h3></div></div><div id="suiteProfileBody"></div></div>`;
}
function openView(v){
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));const t=$(v)||$('suite-'+v);if(t)t.classList.add('active');
 document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',(b.dataset.suiteView||b.dataset.view)===v));
 const pt=$('pageTitle');if(pt)pt.textContent=v==='analytics'?'Analytics':v==='events'?'Events':v==='notifications'?'Notifications':'My Profile';
 if(v==='analytics')renderAnalytics();if(v==='events')renderEvents();if(v==='notifications')renderNotifications();if(v==='profile')renderProfile();
}
function renderAnalytics(){
 const body=$('suiteAnalyticsBody');if(!body)return;const range=Number($('suiteAnalyticsRange')?.value||8);const now=new Date();now.setHours(0,0,0,0);const weeks=[];
 for(let i=range-1;i>=0;i--){const end=new Date(now);end.setDate(now.getDate()-now.getDay()-(i*7));const start=new Date(end);start.setDate(end.getDate()-6);weeks.push({start,end});}
 const scoped=S.members;const ids=new Set(scoped.map(x=>x.id));const scopedAtt=S.attendance.filter(a=>ids.has(a.member_id));
 const vals=weeks.map(w=>scopedAtt.filter(a=>{const d=new Date(a.checked_in_at);return d>=w.start&&d<=new Date(w.end.getTime()+86400000)}).length);const total=vals.reduce((a,b)=>a+b,0);const avg=weeks.length?Math.round(total/weeks.length):0;
 const active=scoped.filter(m=>m.status==='active'||m.is_active!==false).length,inactive=scoped.length-active;
 const areaRows=S.areas.filter(a=>scoped.some(m=>m.area_id===a.id)).map(a=>{const n=scoped.filter(m=>m.area_id===a.id).length;const idsA=new Set(scoped.filter(m=>m.area_id===a.id).map(m=>m.id));const present=new Set(scopedAtt.filter(x=>idsA.has(x.member_id)).map(x=>x.member_id));return{area:a.name,total:n,present:present.size,rate:n?Math.round(present.size/n*100):0}});
 const heat=Array.from({length:56},(_,i)=>{const end=new Date(now);end.setDate(now.getDate()-55+i);const c=scopedAtt.filter(a=>{const d=new Date(a.checked_in_at);return d.toDateString()===end.toDateString()}).length;return`<span class="suite-heat" data-level="${c>=10?4:c>=6?3:c>=3?2:c?1:0}" title="${end.toLocaleDateString()}: ${c} check-ins"></span>`}).join('');
 body.innerHTML=`<div class="suite-kpis"><div class="suite-kpi"><small>Total members</small><strong>${scoped.length}</strong></div><div class="suite-kpi"><small>Active</small><strong>${active}</strong></div><div class="suite-kpi"><small>Inactive</small><strong>${inactive}</strong></div><div class="suite-kpi"><small>Avg check-ins/week</small><strong>${avg}</strong></div></div><div class="suite-grid" style="margin-top:16px"><div class="suite-card suite-col-8"><div class="suite-toolbar"><div><h3 style="margin:0 0 4px">Attendance activity</h3><div class="suite-muted">Daily check-ins over the selected range</div></div></div><div class="suite-heatmap" style="margin-top:14px">${heat}</div></div><div class="suite-card suite-col-4"><h3 style="margin:0 0 12px">Area performance</h3><div class="suite-list">${areaRows.map(r=>`<div><div class="suite-toolbar"><b>${esc(r.area)}</b><span class="suite-badge">${r.rate}%</span></div><div class="suite-progress"><span style="width:${r.rate}%"></span></div><div class="suite-muted" style="margin-top:4px">${r.present} of ${r.total} members checked in</div></div>`).join('')||'<div class="suite-empty">No areas available.</div>'}</div></div></div>`;
 if($('suiteAnalyticsRange'))$('suiteAnalyticsRange').onchange=renderAnalytics;
}
function renderEvents(){
 const el=$('suiteEventsList');if(!el)return;const today=new Date();today.setHours(0,0,0,0);const upcoming=S.events.filter(e=>new Date(e.event_date+'T23:59:59')>=today);
 el.innerHTML=upcoming.map(e=>`<div class="suite-card suite-event" style="margin-bottom:10px"><div class="suite-datebox"><small>${new Date(e.event_date+'T12:00:00').toLocaleDateString('en-PH',{weekday:'short'})}</small><strong>${new Date(e.event_date+'T12:00:00').getDate()}</strong><div class="suite-muted">${new Date(e.event_date+'T12:00:00').toLocaleDateString('en-PH',{month:'short'})}</div></div><div><b>${esc(e.title)}</b><div class="suite-muted">${esc(e.location||'')} ${e.event_time?'· '+e.event_time.slice(0,5):''}</div><div style="margin-top:5px">${esc(e.description||'')}</div></div><div class="suite-actions">${isAdmin()?`<button class="btn secondary" data-event-edit="${e.id}">Edit</button><button class="btn danger" data-event-delete="${e.id}">Delete</button>`:''}</div></div>`).join('')||'<div class="suite-empty">No upcoming events.</div>';
 el.querySelectorAll('[data-event-edit]').forEach(b=>b.onclick=()=>eventModal(S.events.find(x=>x.id===b.dataset.eventEdit)));el.querySelectorAll('[data-event-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this event?'))return;const r=await client.from('vccf_events').delete().eq('id',b.dataset.eventDelete);if(r.error)toast(r.error.message);else{await load();renderEvents();toast('Event deleted.')}});
 if($('suiteAddEvent'))$('suiteAddEvent').onclick=()=>eventModal();
}
function eventModal(e=null){
 const body=`<div class="suite-modal-grid"><div class="field"><label>Title</label><input id="evTitle" value="${esc(e?.title||'')}" required></div><div class="field"><label>Date</label><input id="evDate" type="date" value="${e?.event_date||''}" required></div><div class="field"><label>Time</label><input id="evTime" type="time" value="${e?.event_time?.slice(0,5)||''}"></div><div class="field"><label>Location</label><input id="evLocation" value="${esc(e?.location||'')}"></div><div class="field suite-full"><label>Description</label><textarea id="evDesc" rows="4">${esc(e?.description||'')}</textarea></div></div><button class="btn" id="evSave" style="width:100%;margin-top:12px">Save event</button>`;
 if(typeof openModal==='function')openModal(e?'Edit event':'Add event',body);else{const m=$('modal');$('modalTitle').textContent=e?'Edit event':'Add event';$('modalBody').innerHTML=body;m.classList.add('open')}
 $('evSave').onclick=async()=>{const payload={title:$('evTitle').value.trim(),event_date:$('evDate').value,event_time:$('evTime').value||null,location:$('evLocation').value.trim()||null,description:$('evDesc').value.trim()||null};if(!payload.title||!payload.event_date){toast('Title and date are required.');return}const r=e?await client.from('vccf_events').update(payload).eq('id',e.id):await client.from('vccf_events').insert({...payload,created_by:S.user.id});if(r.error)toast(r.error.message);else{$('modal').classList.remove('open');await load();renderEvents();toast('Event saved.')}};
}
function renderNotifications(){
 const el=$('suiteNotificationsList');if(!el)return;const n=S.notifications;
 el.innerHTML=n.map(x=>`<div class="suite-row ${x.is_read?'':'suite-unread'}"><div class="suite-row-main"><b>${esc(x.title)}</b><small>${esc(x.body||'')}</small></div><div class="suite-actions"><span class="suite-muted">${new Date(x.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</span>${x.is_read?'':`<button class="btn secondary" data-note-read="${x.id}">Read</button>`}</div></div>`).join('')||'<div class="suite-empty">No notifications yet.</div>';
 el.querySelectorAll('[data-note-read]').forEach(b=>b.onclick=async()=>{await client.from('vccf_notifications').update({is_read:true}).eq('id',b.dataset.noteRead);await load();renderNotifications()});
 if($('suiteMarkRead'))$('suiteMarkRead').onclick=async()=>{await client.from('vccf_notifications').update({is_read:true}).eq('user_id',S.user.id).eq('is_read',false);await load();renderNotifications();toast('Notifications marked as read.')};
 if($('suiteBroadcast'))$('suiteBroadcast').onclick=broadcast;
}
async function broadcast(){
 const body=`<div class="field"><label>Title</label><input id="bnTitle"></div><div class="field"><label>Message</label><textarea id="bnBody" rows="4"></textarea></div><button class="btn" id="bnSend">Send to all users</button>`;
 openModal('Broadcast notification',body);$('bnSend').onclick=async()=>{const {data:users,error}=await client.from('profiles').select('user_id');if(error){toast(error.message);return}const rows=(users||[]).map(x=>({user_id:x.user_id,title:$('bnTitle').value.trim(),body:$('bnBody').value.trim(),kind:'announcement'})).filter(x=>x.title);if(!rows.length)return toast('Enter a title.');const r=await client.from('vccf_notifications').insert(rows);if(r.error)toast(r.error.message);else{$('modal').classList.remove('open');toast('Notification sent.')}};
}
function renderProfile(){
 const el=$('suiteProfileBody');if(!el)return;const m=S.member;if(!m){el.innerHTML='<div class="suite-empty">No member profile is linked to this account.</div>';return}
 const name=memberName(m);const photo=m.photo_url;const editable=role()==='member';
 el.innerHTML=`<div class="suite-card"><div class="suite-profile"><div class="suite-avatar">${photo?`<img src="${esc(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`:initials(name)}</div><div><div class="suite-badge">${esc(role())}</div><h2 style="margin:7px 0">${esc(name)}</h2><div class="suite-muted">${esc(areaName(m.area_id))}</div><div class="suite-detail-grid" style="margin-top:16px"><div class="suite-detail"><small>Status</small><b>${esc(m.status|| (m.is_active===false?'inactive':'active'))}</b></div><div class="suite-detail"><small>Birthday</small><b>${esc(m.birth_date||'—')}</b></div><div class="suite-detail"><small>Address</small><b>${esc(m.address||'—')}</b></div><div class="suite-detail"><small>Member code</small><b>${esc(m.member_code||'—')}</b></div></div>${editable?'<button class="btn" id="suiteRequestEdit" style="margin-top:14px">Request profile change</button>':''}</div></div></div><div class="suite-grid" style="margin-top:16px"><div class="suite-card suite-col-8"><h3 style="margin:0 0 12px">Attendance history</h3><div class="suite-list">${S.attendance.filter(a=>a.member_id===m.id).slice(0,30).map(a=>`<div class="suite-row"><div class="suite-row-main"><b>${fmtDate(new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}))}</b><small>${new Date(a.checked_in_at).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'})} · ${esc(areaName(a.area_id))}</small></div><span class="suite-badge">Present</span></div>`).join('')||'<div class="suite-empty">No attendance history.</div>'}</div></div><div class="suite-card suite-col-4"><h3 style="margin:0 0 12px">Member tips</h3><div class="suite-notice">Keep your address and birthday up to date so leaders can maintain accurate records.</div></div></div>`;
 if(editable)$('suiteRequestEdit').onclick=()=>profileRequest(m);
}
function profileRequest(m){
 const body=`<div class="suite-notice" style="margin-bottom:12px">Changes are reviewed by an administrator before they update the official member record.</div><div class="suite-modal-grid"><div class="field"><label>Address</label><input id="rqAddress" value="${esc(m.address||'')}"></div><div class="field"><label>Birthday</label><input id="rqBirth" type="date" value="${m.birth_date||''}"></div><div class="field suite-full"><label>Reason / note</label><textarea id="rqNote" rows="3"></textarea></div></div><button class="btn" id="rqSave">Submit request</button>`;
 openModal('Request profile change',body);$('rqSave').onclick=async()=>{const changes={address:$('rqAddress').value.trim(),birth_date:$('rqBirth').value, note:$('rqNote').value.trim()};const r=await client.from('member_edit_requests').insert({member_id:m.id,requested_by:S.user.id,requested_changes:changes});if(r.error)toast(r.error.message);else{$('modal').classList.remove('open');toast('Request submitted to administrators.')}};
}
async function quickActions(){
 const d=$('dashboard');if(!d||$('suiteQuickActions'))return;const box=document.createElement('div');box.id='suiteQuickActions';box.className='suite-card';box.style.marginBottom='16px';box.innerHTML=`<div class="suite-toolbar"><div><h3 style="margin:0 0 4px">Quick actions</h3><div class="suite-muted">Jump directly to the most common tasks.</div></div></div><div class="suite-actions" style="margin-top:12px"><button class="btn" data-qa="members">Members</button><button class="btn" data-qa="attendance">Attendance</button><button class="btn secondary" data-qa="analytics">Analytics</button><button class="btn secondary" data-qa="events">Events</button><button class="btn secondary" data-qa="profile">My Profile</button><button class="btn secondary" data-qa="notifications">Notifications</button></div>`;d.prepend(box);box.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>openView(b.dataset.qa));}
function injectAnalyticsIntoDashboard(){
 const d=$('dashboard');if(!d||$('suiteDashboardMini'))return;const card=document.createElement('div');card.id='suiteDashboardMini';card.className='suite-card';card.style.marginTop='16px';card.innerHTML='<div class="suite-toolbar"><div><h3 style="margin:0 0 4px">Attendance pulse</h3><div class="suite-muted">A quick view of recent check-in momentum.</div></div><button class="btn secondary" id="suiteOpenAnalytics">Open analytics</button></div><div id="suitePulse" style="margin-top:14px"></div>';d.appendChild(card);$('suiteOpenAnalytics').onclick=()=>openView('analytics');const pulse=$('suitePulse');const recent=S.attendance.slice(0,7);const max=Math.max(1,...recent.map((_,i)=>recent.slice(i,i+1).length));pulse.innerHTML=`<div class="suite-progress"><span style="width:${Math.min(100,recent.length*14.2)}%"></span></div><div class="suite-muted" style="margin-top:6px">${recent.length} recent attendance records loaded.</div>`;}
function registerPwa(){if(!('serviceWorker'in navigator))return;navigator.serviceWorker.register('/vccf-sw.js').catch(()=>{});}
async function init(){await load();addNav();addViews();quickActions();injectAnalyticsIntoDashboard();renderAnalytics();renderEvents();renderNotifications();renderProfile();registerPwa();
 const unread=S.notifications.filter(x=>!x.is_read).length;if(unread){const b=document.querySelector('[data-suite-view="notifications"]');if(b)b.innerHTML='<span aria-hidden="true">●</span> Notifications <span class="suite-badge" style="margin-left:auto">'+unread+'</span>'}
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(init,800));
})();
