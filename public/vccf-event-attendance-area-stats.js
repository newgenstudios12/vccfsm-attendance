(()=>{
'use strict';
if(window.__VCCF_EVENT_ATTENDANCE_AREA_STATS__)return;
window.__VCCF_EVENT_ATTENDANCE_AREA_STATS__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selectedEventId='',scheduled=0,requestSeq=0;

function styles(){
  if(document.getElementById('vccfEventAreaStatsStyles'))return;
  const s=document.createElement('style');s.id='vccfEventAreaStatsStyles';
  s.textContent=`.event-area-stats-section{margin:14px 0 12px;padding-top:13px;border-top:1px solid var(--line)}.event-area-stats-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:9px}.event-area-stats-head h4{margin:0;font-size:.82rem}.event-area-stats-head p{margin:3px 0 0;color:var(--muted);font-size:.66rem;line-height:1.35}.event-area-stats-total{font-size:.65rem;color:var(--muted);font-weight:800;white-space:nowrap}.event-area-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px}.event-area-stat{padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--card-soft,var(--card));min-width:0}.event-area-stat span,.event-area-stat strong,.event-area-stat small{display:block}.event-area-stat span{color:var(--muted);font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.035em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.event-area-stat strong{font-size:1.05rem;margin-top:4px}.event-area-stat small{margin-top:2px;color:var(--muted);font-size:.61rem;line-height:1.35}.event-area-stats-loading{padding:10px;border:1px dashed var(--line);border-radius:11px;color:var(--muted);font-size:.7rem}@media(max-width:620px){.event-area-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.event-area-stats-head{align-items:flex-start;flex-direction:column}.event-area-stats-total{white-space:normal}}`;
  document.head.appendChild(s);
}
function activeAreas(){return (state().areas||[]).filter(a=>a.is_active!==false).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')))}
function memberMap(){return new Map((state().members||[]).map(m=>[String(m.id),m.area_id||'']))}
function isDetail(panel){return Boolean(panel?.querySelector('#backToEventAttendance')&&panel.querySelector('#exportEventAttendance'))}

async function loadAreaStats(eventId){
  const client=sb();if(!client)return {rows:[],memberAreas:memberMap()};
  const reg=await client.from('church_event_registrations').select('member_id,status,checked_in_at').eq('event_id',eventId);
  if(reg.error)throw reg.error;
  const rows=(reg.data||[]).filter(r=>String(r.status||'').toLowerCase()!=='cancelled');
  const map=memberMap(),missing=[...new Set(rows.map(r=>String(r.member_id||'')).filter(id=>id&&!map.has(id)))];
  if(missing.length){
    const m=await client.from('members').select('id,area_id').in('id',missing.slice(0,500));
    if(!m.error)(m.data||[]).forEach(x=>map.set(String(x.id),x.area_id||''));
  }
  return {rows,memberAreas:map};
}
function attended(row){return String(row.status||'').toLowerCase()==='attended'||Boolean(row.checked_in_at)}
function buildStats(rows,map){
  const areas=activeAreas(),by=new Map(areas.map(a=>[String(a.id),{id:String(a.id),name:a.name||'Area',roster:0,attended:0}]));
  let unknown=null;
  rows.forEach(row=>{
    const aid=String(map.get(String(row.member_id||''))||'');let item=aid&&by.get(aid);
    if(!item){if(!unknown)unknown={id:'',name:'Unassigned',roster:0,attended:0};item=unknown}
    item.roster++;if(attended(row))item.attended++;
  });
  const list=[...by.values()];if(unknown&&(unknown.roster||unknown.attended))list.push(unknown);
  return list.map(x=>({...x,rate:x.roster?Math.round(x.attended/x.roster*100):0}));
}
function renderCards(stats,attendanceOnly){
  return stats.map(x=>attendanceOnly
    ?`<div class="event-area-stat"><span title="${esc(x.name)}">${esc(x.name)}</span><strong>${x.attended}</strong><small>${x.attended===1?'attendee':'attendees'}</small></div>`
    :`<div class="event-area-stat"><span title="${esc(x.name)}">${esc(x.name)}</span><strong>${x.attended}</strong><small>${x.roster} roster · ${x.rate}% attended</small></div>`).join('');
}

async function enhance(){
  styles();
  const panel=document.getElementById('eventAttendancePanel');
  if(!selectedEventId||!isDetail(panel))return;
  const top=panel.querySelector(':scope > .event-attendance-head + .cms-panel.card')||panel.querySelector('.cms-panel.card');
  if(!top||top.querySelector(`[data-event-area-stats="${CSS.escape(selectedEventId)}"]`))return;
  top.querySelector('.event-area-stats-section')?.remove();
  const overall=top.querySelector('.event-attendance-stats'),attendanceOnly=overall?.classList.contains('attendance-only');
  const section=document.createElement('section');section.className='event-area-stats-section';section.dataset.eventAreaStats=selectedEventId;
  section.innerHTML='<div class="event-area-stats-head"><div><h4>Attendance by Area</h4><p>Area-level participation for this event.</p></div></div><div class="event-area-stats-loading">Loading area statistics…</div>';
  if(overall)top.insertBefore(section,overall);else top.querySelector('.cms-panel-head')?.insertAdjacentElement('afterend',section);
  const seq=++requestSeq,eventId=selectedEventId;
  try{
    const {rows,memberAreas}=await loadAreaStats(eventId);if(seq!==requestSeq||selectedEventId!==eventId||!section.isConnected)return;
    const stats=buildStats(rows,memberAreas),totalAttended=rows.filter(attended).length;
    section.innerHTML=`<div class="event-area-stats-head"><div><h4>Attendance by Area</h4><p>${attendanceOnly?'Attendees':'Checked-in attendees and roster'} per church area.</p></div><span class="event-area-stats-total">${totalAttended} total attended</span></div><div class="event-area-stats-grid">${renderCards(stats,attendanceOnly)}</div>`;
  }catch(error){if(section.isConnected)section.innerHTML='<div class="event-area-stats-head"><div><h4>Attendance by Area</h4></div></div><div class="event-area-stats-loading">'+esc(error.message||'Unable to load area statistics.')+'</div>'}
}
function queue(){clearTimeout(scheduled);scheduled=setTimeout(enhance,80)}

document.addEventListener('click',e=>{
  const open=e.target.closest?.('[data-open-event-attendance],[data-gallery-open]');
  if(open){selectedEventId=open.dataset.openEventAttendance||open.dataset.galleryOpen||selectedEventId;queue();return}
  if(e.target.closest?.('#backToEventAttendance')){selectedEventId='';requestSeq++}
},true);
new MutationObserver(()=>queue()).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',queue);window.addEventListener('focus',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();