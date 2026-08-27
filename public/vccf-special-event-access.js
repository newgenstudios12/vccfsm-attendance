(()=>{
'use strict';
if(window.__VCCF_SPECIAL_EVENT_ACCESS_V1__)return;
window.__VCCF_SPECIAL_EVENT_ACCESS_V1__=true;
const URL=window.VCCF_SUPABASE_URL,KEY=window.VCCF_SUPABASE_PUBLISHABLE_KEY;
if(!URL||!KEY||!window.supabase)return;
const client=window.supabase.createClient(URL,KEY);

const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');clearTimeout(window.__vccfSeAccessToast);window.__vccfSeAccessToast=setTimeout(()=>x.classList.remove('show'),2800)}};
const nameOf=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||'Member';
const activeMember=m=>m&&m.is_active!==false&&norm(m.status)!=='inactive';
let profile=null;
let events=[];

async function getProfile(){
  const {data:{user}}=await client.auth.getUser();
  if(!user)throw new Error('Please sign in again.');
  const {data,error}=await client.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  profile=data||null;
  return profile;
}
function role(){return norm(profile?.role)}
function isAdmin(){return role()==='admin'}
function isLeader(){return role()==='area leader'||role()==='area_leader'||role()==='leader'}
function isMember(){return role()==='member'}
function canAccess(){return isMember()||isLeader()}

function injectStyle(){
  if(document.getElementById('vccfSeAccessStyle'))return;
  const s=document.createElement('style');s.id='vccfSeAccessStyle';
  s.textContent=`#vccfSpecialEventAccess{margin-top:16px}.vccf-sea-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:14px}.vccf-sea-head h3{margin:0 0 4px}.vccf-sea-muted{color:var(--muted);font-size:.82rem}.vccf-sea-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.vccf-sea-card{border:1px solid var(--line);background:var(--panel);border-radius:16px;padding:16px}.vccf-sea-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.vccf-sea-empty{padding:18px;color:var(--muted);text-align:center;border:1px dashed var(--line);border-radius:12px}.vccf-sea-members{display:grid;gap:8px;margin-top:12px;max-height:360px;overflow:auto}.vccf-sea-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px}.vccf-sea-tools{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.vccf-sea-tools input{width:100%;min-width:0}.vccf-sea-pill{display:inline-block;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:800;background:#1987541a;color:#198754}.vccf-sea-pill.off{background:#6d72801a;color:var(--muted)}.vccf-sea-self{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid var(--line);border-radius:14px;margin-top:12px}.vccf-sea-list{display:grid;gap:10px}.vccf-sea-event-title{font-weight:900}.vccf-sea-event-meta{color:var(--muted);font-size:.82rem;margin-top:4px}@media(max-width:650px){.vccf-sea-tools{grid-template-columns:1fr}.vccf-sea-row{align-items:flex-start;flex-direction:column}.vccf-sea-self{align-items:flex-start;flex-direction:column}.vccf-sea-self button{width:100%}}`;
  document.head.appendChild(s);
}

async function loadEvents(){
  const {data,error}=await client.from('special_events').select('id,title,event_date,event_time,location,description').gte('event_date',today()).order('event_date',{ascending:true}).order('event_time',{ascending:true});
  if(error)throw error;
  events=data||[];
}

async function checkIn(eventId,memberId){
  if(!eventId||!memberId)return;
  const {error}=await client.rpc('set_special_event_attendance',{p_event_id:eventId,p_member_id:memberId,p_source:'self'});
  if(error){toast(error.message||'Unable to check in.');return false}
  toast('Checked in successfully.');
  return true;
}

async function loadAttendanceForEvent(eventId){
  const {data,error}=await client.from('special_event_attendance').select('member_id,checked_in_at,source').eq('event_id',eventId).order('checked_in_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

async function memberCard(event){
  const host=document.createElement('article');host.className='vccf-sea-card';
  const memberId=profile?.member_id;
  let self=null;
  if(memberId){const {data,error}=await client.from('special_event_attendance').select('checked_in_at,source').eq('event_id',event.id).eq('member_id',memberId).maybeSingle();if(error)throw error;self=data||null}
  host.innerHTML=`<div class="vccf-sea-event-title">${esc(event.title)}</div><div class="vccf-sea-event-meta">${esc(event.event_date)}${event.event_time?' · '+esc(String(event.event_time).slice(0,5)):''}${event.location?' · '+esc(event.location):''}</div>${event.description?`<p class="vccf-sea-muted" style="margin:8px 0 0">${esc(event.description)}</p>`:''}<div class="vccf-sea-self"><div><b>${esc(profile?.display_name||'My Attendance')}</b><div class="vccf-sea-muted">${self?'Checked in at '+new Date(self.checked_in_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):'You can only check in yourself.'}</div></div>${self?'<span class="vccf-sea-pill">Checked In</span>':'<button class="btn" data-sea-self>Check In</button>'}</div>`;
  const btn=host.querySelector('[data-sea-self]');
  if(btn)btn.onclick=async()=>{btn.disabled=true;btn.textContent='Checking in…';if(await checkIn(event.id,memberId)){await render()}else{btn.disabled=false;btn.textContent='Check In'}};
  return host;
}

async function leaderCard(event){
  const host=document.createElement('article');host.className='vccf-sea-card';
  const {data:members,error:me}=await client.from('members').select('id,display_name,first_name,last_name,member_code,area_id,status,is_active').eq('area_id',profile.area_id).order('display_name');
  if(me)throw me;
  const visible=(members||[]).filter(activeMember);
  const rows=await loadAttendanceForEvent(event.id);
  const present=new Map(rows.map(r=>[String(r.member_id),r]));
  host.innerHTML=`<div class="vccf-sea-event-title">${esc(event.title)}</div><div class="vccf-sea-event-meta">${esc(event.event_date)}${event.event_time?' · '+esc(String(event.event_time).slice(0,5)):''}${event.location?' · '+esc(event.location):''}</div><div class="vccf-sea-muted" style="margin-top:6px">Area members only · ${present.size} checked in</div><div class="vccf-sea-tools"><input class="search" data-sea-filter placeholder="Search your area"><span></span></div><div class="vccf-sea-members"></div>`;
  const list=host.querySelector('.vccf-sea-members'),filter=host.querySelector('[data-sea-filter]');
  const draw=()=>{
    const q=norm(filter.value);list.innerHTML='';
    const matches=visible.filter(m=>!q||norm(nameOf(m)).includes(q)||norm(m.member_code).includes(q));
    if(!matches.length){list.innerHTML='<div class="vccf-sea-empty">No matching active members in your assigned area.</div>';return}
    matches.forEach(m=>{const p=present.get(String(m.id));const row=document.createElement('div');row.className='vccf-sea-row';row.innerHTML=`<div><b>${esc(nameOf(m))}</b><div class="vccf-sea-muted">${esc(m.member_code||'')}</div></div>${p?'<span class="vccf-sea-pill">Checked In</span>':'<button class="btn" data-sea-check>Check In</button>'}`;const b=row.querySelector('[data-sea-check]');if(b)b.onclick=async()=>{b.disabled=true;b.textContent='Checking in…';if(await checkIn(event.id,m.id)){await render()}else{b.disabled=false;b.textContent='Check In'}};list.appendChild(row)})
  };
  filter.addEventListener('input',draw);draw();
  return host;
}

async function render(){
  if(!canAccess()||isAdmin())return;
  injectStyle();
  const target=document.getElementById('attendance')||document.getElementById('dashboard')||document.querySelector('.main');
  if(!target)return;
  let panel=document.getElementById('vccfSpecialEventAccess');
  if(!panel){panel=document.createElement('section');panel.id='vccfSpecialEventAccess';target.appendChild(panel)}
  panel.innerHTML=`<div class="panel"><div class="vccf-sea-head"><div><h3>Special Events</h3><div class="vccf-sea-muted">${isLeader()?'Check in active members from your assigned area only.':'Check in yourself for upcoming special events.'}</div></div><button class="btn secondary" id="vccfSeaRefresh">Refresh</button></div><div class="vccf-sea-list" id="vccfSeaEvents"></div></div>`;
  const list=panel.querySelector('#vccfSeaEvents');
  if(!events.length){list.innerHTML='<div class="vccf-sea-empty">No upcoming special events are available right now.</div>';return}
  if(isMember()&&!profile?.member_id){list.innerHTML='<div class="vccf-sea-empty">Your account is not linked to a member record yet. Please ask an administrator to link your profile.</div>';return}
  for(const event of events){list.appendChild(isLeader()?await leaderCard(event):await memberCard(event))}
  panel.querySelector('#vccfSeaRefresh').onclick=async()=>{await boot()}
}

async function boot(){
  try{
    await getProfile();
    if(!canAccess()||isAdmin()){document.getElementById('vccfSpecialEventAccess')?.remove();return}
    await loadEvents();
    await render();
  }catch(e){console.warn('Special event access:',e)}
}

function observe(){
  const observer=new MutationObserver(()=>{if(canAccess()&&!document.getElementById('vccfSpecialEventAccess'))setTimeout(render,80)});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{boot();observe()},{once:true});else{boot();observe()}
})();
