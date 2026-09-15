(()=>{
'use strict';
if(window.__VCCF_MEMBER_PROFILE_VISUALS__)return;
window.__VCCF_MEMBER_PROFILE_VISUALS__=true;

if(!document.querySelector('link[data-vccf-member-profile-visuals]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/vccf-member-profile-visuals.css?v=20260915-1';
  link.dataset.vccfMemberProfileVisuals='1';
  document.head.appendChild(link);
}

const S=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
let activeMemberId=null;
let queued=false;
const cache=new Map();

function todayPH(){
  const p={};
  new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});
  return{year:Number(p.year),month:Number(p.month),day:Number(p.day)};
}
function ymd(y,m,d){return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function utcDay(y,m,d){return new Date(Date.UTC(y,m-1,d)).getUTCDay()}
function daysInMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate()}
function shiftMonth(y,m,delta){const d=new Date(Date.UTC(y,m-1+delta,1));return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1}}
function monthLabel(y,m,long=false){return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:long?'long':'short'}).format(new Date(Date.UTC(y,m-1,2,12)))}
function dateLabel(key){const [y,m,d]=key.split('-').map(Number);return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)))}
function sundaysInMonth(y,m,throughDay=null){const last=throughDay==null?daysInMonth(y,m):Math.min(throughDay,daysInMonth(y,m)),out=[];for(let d=1;d<=last;d++)if(utcDay(y,m,d)===0)out.push(ymd(y,m,d));return out}
function recentSundays(count){const t=todayPH(),cursor=new Date(Date.UTC(t.year,t.month-1,t.day));while(cursor.getUTCDay()!==0)cursor.setUTCDate(cursor.getUTCDate()-1);const out=[];for(let i=0;i<count;i++){out.push(ymd(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,cursor.getUTCDate()));cursor.setUTCDate(cursor.getUTCDate()-7)}return out}
function detectMemberId(){
  if(activeMemberId&&(S().members||[]).some(m=>String(m.id)===String(activeMemberId)))return String(activeMemberId);
  const title=document.querySelector('#members .m360-identity h2')?.textContent?.trim();
  if(!title)return null;
  const hit=(S().members||[]).find(m=>memberName(m).trim()===title);
  if(hit){activeMemberId=hit.id;return String(hit.id)}
  return null;
}
function statsFromRows(rows){
  const t=todayPH(),presentDates=new Set((rows||[]).filter(x=>(x.attendance_type||'sunday')==='sunday').map(x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x.checked_in_at))));
  const currentSundays=sundaysInMonth(t.year,t.month,t.day),present=currentSundays.filter(d=>presentDates.has(d)).length,absent=Math.max(0,currentSundays.length-present),rate=currentSundays.length?Math.round(present/currentSundays.length*100):0;
  const recent=recentSundays(8).map(d=>({date:d,present:presentDates.has(d)}));
  let streak=0;for(const s of recentSundays(52)){if(presentDates.has(s))streak++;else break}
  const months=[];for(let delta=-5;delta<=0;delta++){const p=shiftMonth(t.year,t.month,delta),isCurrent=delta===0,sundays=sundaysInMonth(p.year,p.month,isCurrent?t.day:null),pCount=sundays.filter(d=>presentDates.has(d)).length,total=sundays.length;months.push({year:p.year,month:p.month,label:monthLabel(p.year,p.month),present:pCount,total,rate:total?Math.round(pCount/total*100):0})}
  return{year:t.year,month:t.month,monthName:monthLabel(t.year,t.month,true),present,absent,total:currentSundays.length,rate,streak,recent,months};
}
async function loadStats(memberId){
  const t=todayPH(),cacheKey=`${memberId}:${ymd(t.year,t.month,t.day)}`,cached=cache.get(cacheKey);if(cached&&Date.now()-cached.at<60000)return cached.data;
  const first=shiftMonth(t.year,t.month,-5),start=`${first.year}-${String(first.month).padStart(2,'0')}-01T00:00:00+08:00`,end=new Date().toISOString();
  const {data,error}=await db().from('attendance').select('checked_in_at,attendance_type').eq('member_id',memberId).gte('checked_in_at',start).lte('checked_in_at',end).order('checked_in_at');
  if(error)throw error;
  const stats=statsFromRows(data||[]);cache.set(cacheKey,{at:Date.now(),data:stats});return stats;
}
function renderLoading(anchor){
  let panel=document.getElementById('m360AttendanceVisual');if(panel)return panel;
  panel=document.createElement('section');panel.id='m360AttendanceVisual';panel.className='m360-attendance-visual';panel.innerHTML='<div class="m360-visual-loading">Preparing Sunday attendance statistics…</div>';
  anchor.insertAdjacentElement('afterend',panel);return panel;
}
function renderStats(panel,stats){
  const recent=stats.recent.map(x=>`<div class="m360-sunday-cell ${x.present?'present':'absent'}" title="${esc(dateLabel(x.date))}: ${x.present?'Present':'Absent'}"><div class="m360-sunday-dot">${x.present?'✓':'—'}</div><label>${esc(dateLabel(x.date))}</label><small>${x.present?'P':'A'}</small></div>`).join('');
  const trend=stats.months.map(x=>`<div class="m360-trend-col" title="${esc(x.label)}: ${x.present}/${x.total} present (${x.rate}%)"><div class="m360-trend-track"><div class="m360-trend-fill" style="height:${Math.max(3,x.rate)}%"></div></div><b>${x.rate}%</b><span>${esc(x.label)}</span></div>`).join('');
  panel.innerHTML=`<div class="m360-attendance-head"><div><h3>Sunday Attendance Statistics</h3><p>A visual view of this member's Sunday Worship consistency.</p></div><span class="m360-attendance-month">${esc(stats.monthName)} ${stats.year}</span></div><div class="m360-attendance-kpis"><div class="m360-attendance-rate"><div class="m360-attendance-ring" style="--rate:${stats.rate}"><strong>${stats.rate}%</strong></div><div class="m360-attendance-rate-copy"><span>This month</span><b>${stats.present} of ${stats.total} Sundays present</b></div></div><div class="m360-attendance-stat present"><span>Present</span><strong>${stats.present}</strong><small>This month</small></div><div class="m360-attendance-stat absent"><span>Absent</span><strong>${stats.absent}</strong><small>This month</small></div><div class="m360-attendance-stat streak"><span>Current streak</span><strong>${stats.streak}</strong><small>Sunday${stats.streak===1?'':'s'} in a row</small></div></div><div class="m360-attendance-subgrid"><div class="m360-attendance-panel"><div class="m360-attendance-panel-head"><b>Last 8 Sundays</b><span>Present / Absent</span></div><div class="m360-sunday-strip">${recent}</div><div class="m360-attendance-legend"><span class="present"><i></i>Present</span><span class="absent"><i></i>Absent / no check-in</span></div></div><div class="m360-attendance-panel"><div class="m360-attendance-panel-head"><b>6-Month Trend</b><span>Attendance rate</span></div><div class="m360-trend">${trend}</div></div></div>`;
}
function updateSummary(stats){
  const cards=[...document.querySelectorAll('#members .m360-summary')];
  const card=cards.find(x=>x.querySelector('h3')?.textContent?.trim().startsWith('Attendance')||x.querySelector('h3')?.textContent?.trim().startsWith('Sunday Attendance'));
  if(!card)return;card.dataset.memberVisualAttendance='1';card.innerHTML=`<h3>Sunday Attendance · ${esc(stats.monthName)}</h3><strong>${stats.present} / ${stats.total} present</strong><div class="hint">${stats.total?stats.rate+'% attendance this month':'No Sunday has occurred yet this month.'}</div>`;
}
async function enhanceProfile(){
  queued=false;
  const body=document.getElementById('m360body'),anchor=body?.querySelector('.m360-summary-grid');if(!body||!anchor)return;
  const id=detectMemberId();if(!id)return;
  const existing=document.getElementById('m360AttendanceVisual');if(existing?.dataset.memberId===id)return;
  existing?.remove();const panel=renderLoading(anchor);panel.dataset.memberId=id;
  const card=body.closest('.panel.card');card?.classList.add('m360-profile-polished');
  try{const stats=await loadStats(id);if(!panel.isConnected||panel.dataset.memberId!==id)return;renderStats(panel,stats);updateSummary(stats)}catch(e){console.warn('Member 360 visual attendance:',e);if(panel.isConnected)panel.innerHTML='<div class="m360-attendance-empty">Sunday attendance statistics are temporarily unavailable.</div>'}
}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>void enhanceProfile())}

document.addEventListener('click',e=>{const target=e.target.closest?.('[data-view-member],[data-member-id]');if(target){activeMemberId=target.dataset.viewMember||target.dataset.memberId||activeMemberId;queue()}if(e.target.closest?.('[data-route="members"],#m360back')){setTimeout(queue,80)}},true);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-member-updated',()=>{cache.clear();queue()});
window.addEventListener('vccf-app-ready',queue);
window.addEventListener('vccf-signed-out',()=>{activeMemberId=null;cache.clear()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();
