(()=>{
'use strict';
if(window.__VCCF_AREA_LEADER_DASHBOARD__)return;
window.__VCCF_AREA_LEADER_DASHBOARD__=true;

const S=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb;
const role=()=>String(S().profile?.role||'').toLowerCase();
const areaId=()=>S().profile?.area_id||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const phDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const nameOf=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
const activeAreaMembers=()=>(S().members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive'&&m.area_id===areaId());
const areaName=()=>S().areas?.find(a=>a.id===areaId())?.name||'My Area';
let timer=0,loading=false,cache=null,cacheAt=0,observer=null;

function sundayDates(count=4){
  const out=[];const d=new Date(phDay(new Date())+'T12:00:00+08:00');d.setDate(d.getDate()-d.getDay());
  for(let i=0;i<count;i++){out.push(phDay(d));d.setDate(d.getDate()-7)}
  return out;
}
function bounds(day){const start=new Date(day+'T00:00:00+08:00');return{start:start.toISOString(),end:new Date(start.getTime()+86400000).toISOString()}}
function birthdayWithin7(m){if(!m?.birth_date)return false;const now=new Date(phDay(new Date())+'T12:00:00+08:00');for(let i=0;i<7;i++){const d=new Date(now);d.setDate(now.getDate()+i);if(String(m.birth_date).slice(5,10)===phDay(d).slice(5,10))return true}return false}
function daysSince(v){return v?Math.floor((Date.now()-new Date(v).getTime())/86400000):9999}
async function safe(p,fallback=null){try{const r=await p;if(r?.error)throw r.error;return r?.data??fallback}catch(e){console.warn('Area Leader dashboard:',e?.message||e);return fallback}}

async function load(force=false){
  if(role()!=='area_leader'||!areaId()||!db())return null;
  if(!force&&cache&&Date.now()-cacheAt<60000)return cache;
  const dates=sundayDates(4),latest=dates[0],b=bounds(dates[3]),aid=areaId();
  const [attendance,submission]=await Promise.all([
    safe(db().from('attendance').select('member_id,checked_in_at').eq('area_id',aid).eq('attendance_type','sunday').gte('checked_in_at',b.start).lt('checked_in_at',bounds(latest).end),[]),
    safe(db().from('sunday_attendance_submissions').select('status,present_count,absent_count,active_member_count,submitted_at').eq('area_id',aid).eq('sunday_date',latest).maybeSingle(),null)
  ]);
  const members=activeAreaMembers(),presentByDate=new Map(dates.map(x=>[x,new Set()]));
  (attendance||[]).forEach(r=>{const key=phDay(new Date(r.checked_in_at));if(presentByDate.has(key))presentByDate.get(key).add(String(r.member_id))});
  const latestPresent=presentByDate.get(latest)||new Set();
  const finalized=submission?.status==='submitted';
  const followup=members.filter(m=>dates.slice(0,3).every(d=>!presentByDate.get(d)?.has(String(m.id))));
  const birthdays=members.filter(birthdayWithin7);
  const newMembers=members.filter(m=>daysSince(m.created_at)<=30);
  cache={dates,latest,submission,finalized,total:members.length,present:latestPresent.size,remaining:Math.max(0,members.length-latestPresent.size),followup,birthdays,newMembers};cacheAt=Date.now();return cache;
}

function styles(){if(document.getElementById('vccfAreaLeaderDashboardCss'))return;const s=document.createElement('style');s.id='vccfAreaLeaderDashboardCss';s.textContent=`
.vccf-area-dashboard{margin:16px 0 22px;padding:18px}.vccf-area-dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px}.vccf-area-dash-head h2{margin:3px 0 5px;font-size:1.15rem}.vccf-area-dash-head p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.45}.vccf-area-dash-kicker{font-size:.65rem;font-weight:900;letter-spacing:.12em;color:var(--brand)}.vccf-area-dash-state{padding:7px 10px;border:1px solid var(--line);border-radius:999px;font-size:.68rem;font-weight:900;white-space:nowrap}.vccf-area-dash-state.done{background:#e8f7ee;color:#167647;border-color:#c9ead6}.vccf-area-dash-state.open{background:#fff7ed;color:#9a3412;border-color:#fed7aa}.vccf-area-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.vccf-area-kpi{padding:13px;border:1px solid var(--line);border-radius:14px;background:color-mix(in srgb,var(--card) 97%,var(--brand) 3%)}.vccf-area-kpi span{display:block;color:var(--muted);font-size:.65rem;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.vccf-area-kpi strong{display:block;margin-top:5px;font-size:1.25rem}.vccf-area-kpi small{display:block;margin-top:4px;color:var(--muted);font-size:.65rem;line-height:1.35}.vccf-area-dash-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;margin-top:12px}.vccf-area-task{padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}.vccf-area-task h3{margin:0 0 9px;font-size:.85rem}.vccf-area-task-list{display:grid;gap:7px}.vccf-area-task-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:.75rem}.vccf-area-task-row:last-child{border-bottom:0}.vccf-area-task-row b{display:block}.vccf-area-task-row span{color:var(--muted);font-size:.67rem}.vccf-area-task-count{flex:0 0 auto;min-width:30px;text-align:center;padding:4px 7px;border-radius:999px;background:color-mix(in srgb,var(--brand) 9%,transparent);color:var(--brand);font-size:.68rem;font-weight:900}.vccf-area-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vccf-area-action{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:11px;padding:10px;text-align:left;cursor:pointer;font-size:.72rem;font-weight:850}.vccf-area-action:hover{border-color:color-mix(in srgb,var(--brand) 45%,var(--line));color:var(--brand)}.vccf-area-action.primary{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;border:0}.vccf-area-date{font-weight:850;color:var(--muted);font-size:.7rem}.vccf-area-empty{color:var(--muted);font-size:.72rem;line-height:1.45;padding:4px 0}@media(max-width:900px){.vccf-area-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.vccf-area-dash-grid{grid-template-columns:1fr}}@media(max-width:620px){.vccf-area-dashboard{padding:14px}.vccf-area-dash-head{flex-direction:column}.vccf-area-kpis{grid-template-columns:1fr 1fr}.vccf-area-actions{grid-template-columns:1fr}.vccf-area-kpi strong{font-size:1.08rem}}
`;document.head.appendChild(s)}
function go(route){const el=document.querySelector(`[data-route="${route}"],[data-view="${route}"]`);if(el){el.click();return true}return false}
function listNames(items,max=3){if(!items.length)return'';const shown=items.slice(0,max).map(nameOf);return shown.join(', ')+(items.length>max?` +${items.length-max} more`:'')}
function renderTasks(d){
  const rows=[];
  if(d.followup.length)rows.push(`<div class="vccf-area-task-row"><div><b>Needs follow-up</b><span>${esc(listNames(d.followup))}</span></div><i class="vccf-area-task-count">${d.followup.length}</i></div>`);
  if(d.birthdays.length)rows.push(`<div class="vccf-area-task-row"><div><b>Birthdays in the next 7 days</b><span>${esc(listNames(d.birthdays))}</span></div><i class="vccf-area-task-count">${d.birthdays.length}</i></div>`);
  if(d.newMembers.length)rows.push(`<div class="vccf-area-task-row"><div><b>New members this month</b><span>${esc(listNames(d.newMembers))}</span></div><i class="vccf-area-task-count">${d.newMembers.length}</i></div>`);
  return rows.length?rows.join(''):'<div class="vccf-area-empty">No follow-up, birthday, or new-member items need attention right now.</div>';
}
async function render(force=false){
  if(role()!=='area_leader')return;
  const root=document.getElementById('dashboard');if(!root?.classList.contains('active')||loading)return;
  loading=true;try{const d=await load(force);if(!d)return;styles();let section=document.getElementById('vccfAreaLeaderDashboard');if(!section){section=document.createElement('section');section.id='vccfAreaLeaderDashboard';section.className='card vccf-area-dashboard';const forYou=document.getElementById('vccfForYou'),word=document.getElementById('vccfDailyVerseCard'),welcome=root.querySelector('.welcome-banner');const anchor=forYou||word||welcome;anchor?anchor.insertAdjacentElement('afterend',section):root.prepend(section)}
    const status=d.finalized?'✓ Attendance submitted':d.submission?.status==='reopened'?'Attendance reopened':'Attendance open';
    section.innerHTML=`<div class="vccf-area-dash-head"><div><span class="vccf-area-dash-kicker">AREA LEADER</span><h2>${esc(areaName())} Dashboard</h2><p>Sunday attendance, member care, and the items that need your attention.</p></div><span class="vccf-area-dash-state ${d.finalized?'done':'open'}">${esc(status)}</span></div>
      <div class="vccf-area-kpis"><div class="vccf-area-kpi"><span>Active Members</span><strong>${d.total}</strong><small>Your assigned area</small></div><div class="vccf-area-kpi"><span>Present</span><strong>${d.present}</strong><small>${esc(d.latest)} Sunday</small></div><div class="vccf-area-kpi"><span>${d.finalized?'Absent':'Unmarked'}</span><strong>${d.remaining}</strong><small>${d.finalized?'Finalized attendance':'Submit when complete'}</small></div><div class="vccf-area-kpi"><span>Follow-up</span><strong>${d.followup.length}</strong><small>Absent for 3 Sundays</small></div></div>
      <div class="vccf-area-dash-grid"><div class="vccf-area-task"><h3>Member Care</h3><div class="vccf-area-task-list">${renderTasks(d)}</div></div><div class="vccf-area-task"><h3>Quick Actions</h3><div class="vccf-area-actions"><button class="vccf-area-action primary" data-area-route="attendance">Take / finish attendance</button><button class="vccf-area-action" data-area-route="members">Open my members</button><button class="vccf-area-action" data-area-route="notifications">Area notifications</button><button class="vccf-area-action" data-area-refresh>Refresh dashboard</button></div></div></div>`;
    section.querySelectorAll('[data-area-route]').forEach(b=>b.onclick=()=>go(b.dataset.areaRoute));section.querySelector('[data-area-refresh]')?.addEventListener('click',()=>schedule(true,20));
  }finally{loading=false}
}
function schedule(force=false,delay=250){clearTimeout(timer);timer=setTimeout(()=>render(force),delay)}
function boot(){if(role()!=='area_leader')return;styles();schedule(false,800);const root=document.getElementById('dashboard');if(root&&!observer){observer=new MutationObserver(()=>{if(root.classList.contains('active')&&!document.getElementById('vccfAreaLeaderDashboard'))schedule(false,100)});observer.observe(root,{childList:true,subtree:false})}}
window.addEventListener('vccf-app-ready',boot);window.addEventListener('vccf-members-changed',()=>{cache=null;schedule(true)});window.addEventListener('vccf-signed-out',()=>{cache=null;cacheAt=0;document.getElementById('vccfAreaLeaderDashboard')?.remove()});document.addEventListener('click',e=>{if(e.target.closest?.('[data-route="dashboard"],[data-view="dashboard"]'))schedule(false,350);if(e.target.closest?.('#vccfChecklistSubmit,#checkinBtn')){cache=null;schedule(true,1100)}});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1100),{once:true});else setTimeout(boot,1100);
})();