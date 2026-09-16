(()=>{
'use strict';
if(window.__VCCF_MEMBER_PROFILE_VISUALS__)return;
window.__VCCF_MEMBER_PROFILE_VISUALS__=true;

if(!document.querySelector('link[data-vccf-member-profile-visuals]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/vccf-member-profile-visuals.css?v=20260915-2';
  link.dataset.vccfMemberProfileVisuals='1';
  document.head.appendChild(link);
}

const S=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
let activeMemberId=null;
let queued=false;
let actionSheet=null;
let memberObserver=null;
let observedMembers=null;
const cache=new Map();

function mobile(){return window.matchMedia('(max-width:700px)').matches}
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
  const t=todayPH(),todayKey=ymd(t.year,t.month,t.day),presentDates=new Set((rows||[]).filter(x=>(x.attendance_type||'sunday')==='sunday').map(x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x.checked_in_at))));
  const currentSundays=sundaysInMonth(t.year,t.month,t.day),present=currentSundays.filter(d=>presentDates.has(d)).length,absent=Math.max(0,currentSundays.length-present),rate=currentSundays.length?Math.round(present/currentSundays.length*100):0;
  const monthSundays=sundaysInMonth(t.year,t.month).map(d=>({date:d,present:presentDates.has(d),upcoming:d>todayKey}));
  let streak=0;for(const s of recentSundays(52)){if(presentDates.has(s))streak++;else break}
  const months=[];for(let delta=-5;delta<=0;delta++){const p=shiftMonth(t.year,t.month,delta),isCurrent=delta===0,sundays=sundaysInMonth(p.year,p.month,isCurrent?t.day:null),pCount=sundays.filter(d=>presentDates.has(d)).length,total=sundays.length;months.push({year:p.year,month:p.month,label:monthLabel(p.year,p.month),present:pCount,total,rate:total?Math.round(pCount/total*100):0})}
  return{year:t.year,month:t.month,monthName:monthLabel(t.year,t.month,true),present,absent,total:currentSundays.length,rate,streak,monthSundays,months};
}
async function loadStats(memberId){
  const t=todayPH(),cacheKey=`${memberId}:${ymd(t.year,t.month,t.day)}`,cached=cache.get(cacheKey);if(cached&&Date.now()-cached.at<60000)return cached.data;
  const first=shiftMonth(t.year,t.month,-5),start=`${first.year}-${String(first.month).padStart(2,'0')}-01T00:00:00+08:00`,end=new Date().toISOString();
  const {data,error}=await db().from('attendance').select('checked_in_at,attendance_type').eq('member_id',memberId).gte('checked_in_at',start).lte('checked_in_at',end).order('checked_in_at');
  if(error)throw error;
  const stats=statsFromRows(data||[]);cache.set(cacheKey,{at:Date.now(),data:stats});return stats;
}
function renderLoading(body){
  let panel=document.getElementById('m360AttendanceVisual');if(panel)return panel;
  panel=document.createElement('section');panel.id='m360AttendanceVisual';panel.className='m360-attendance-visual';panel.innerHTML='<div class="m360-visual-loading">Preparing Sunday attendance statistics…</div>';
  body.prepend(panel);return panel;
}
function renderStats(panel,stats){
  const monthSundays=stats.monthSundays.map(x=>{const state=x.upcoming?'upcoming':x.present?'present':'absent',symbol=x.upcoming?'○':x.present?'✓':'—',status=x.upcoming?'Upcoming':x.present?'Present':'Absent / no check-in',short=x.upcoming?'Upcoming':x.present?'P':'A';return `<div class="m360-sunday-cell ${state}" title="${esc(dateLabel(x.date))}: ${status}"><div class="m360-sunday-dot">${symbol}</div><label>${esc(dateLabel(x.date))}</label><small>${short}</small></div>`}).join('');
  const trend=stats.months.map(x=>`<div class="m360-trend-col" title="${esc(x.label)}: ${x.present}/${x.total} present (${x.rate}%)"><div class="m360-trend-track"><div class="m360-trend-fill" style="height:${Math.max(3,x.rate)}%"></div></div><b>${x.rate}%</b><span>${esc(x.label)}</span></div>`).join('');
  panel.innerHTML=`<div class="m360-attendance-head"><div><h3>Sunday Attendance</h3><p>Attendance consistency and Sunday activity for the current month.</p></div><span class="m360-attendance-month">${esc(stats.monthName)} ${stats.year}</span></div><div class="m360-attendance-kpis"><div class="m360-attendance-rate"><div class="m360-attendance-ring" style="--rate:${stats.rate}"><strong>${stats.rate}%</strong></div><div class="m360-attendance-rate-copy"><span>This month</span><b>${stats.present} of ${stats.total} Sundays present</b></div></div><div class="m360-attendance-stat present"><span>Present</span><strong>${stats.present}</strong><small>This month</small></div><div class="m360-attendance-stat absent"><span>Absent</span><strong>${stats.absent}</strong><small>No check-in</small></div><div class="m360-attendance-stat streak"><span>Streak</span><strong>${stats.streak}</strong><small>Sunday${stats.streak===1?'':'s'} in a row</small></div></div><div class="m360-attendance-subgrid"><div class="m360-attendance-panel"><div class="m360-attendance-panel-head"><b>Sundays this month</b><span>${esc(stats.monthName)} ${stats.year}</span></div><div class="m360-sunday-strip">${monthSundays}</div><div class="m360-attendance-legend"><span class="present"><i></i>Present</span><span class="absent"><i></i>Absent / no check-in</span><span><i style="background:var(--muted)"></i>Upcoming</span></div></div><div class="m360-attendance-panel"><div class="m360-attendance-panel-head"><b>6-Month Trend</b><span>Attendance rate</span></div><div class="m360-trend">${trend}</div></div></div>`;
}
function updateSummary(stats){
  const cards=[...document.querySelectorAll('#members .m360-summary')];
  const card=cards.find(x=>x.querySelector('h3')?.textContent?.trim().startsWith('Attendance')||x.querySelector('h3')?.textContent?.trim().startsWith('Sunday Attendance'));
  if(!card)return;card.dataset.memberVisualAttendance='1';card.hidden=true;card.innerHTML=`<h3>Sunday Attendance · ${esc(stats.monthName)}</h3><strong>${stats.present} / ${stats.total} present</strong><div class="hint">${stats.total?stats.rate+'% attendance this month':'No Sunday has occurred yet this month.'}</div>`;
}
function closeActionSheet(){actionSheet?.remove();actionSheet=null;document.body.classList.remove('m360-sheet-open')}
function openActionSheet(sources){
  closeActionSheet();if(!sources.length)return;
  actionSheet=document.createElement('div');actionSheet.className='m360-action-sheet-backdrop';
  actionSheet.innerHTML=`<div class="m360-action-sheet" role="dialog" aria-modal="true" aria-label="Member actions"><div class="m360-action-sheet-handle"></div><div class="m360-action-sheet-title"><b>Member actions</b><button type="button" aria-label="Close">×</button></div><div class="m360-action-sheet-list"></div></div>`;
  document.body.appendChild(actionSheet);document.body.classList.add('m360-sheet-open');
  const list=actionSheet.querySelector('.m360-action-sheet-list');
  sources.forEach(source=>{const b=document.createElement('button');b.type='button';b.className='m360-sheet-action'+(source.id==='m360delete'?' danger':'');b.textContent=source.textContent.trim();b.onclick=()=>{closeActionSheet();source.click()};list.appendChild(b)});
  actionSheet.querySelector('.m360-action-sheet-title button').onclick=closeActionSheet;
  actionSheet.onclick=e=>{if(e.target===actionSheet)closeActionSheet()};
}
function enhanceMobileChrome(){
  const head=document.querySelector('#members .m360-head'),actions=head?.querySelector('.member-detail-actions'),tabs=document.querySelector('#members .m360-tabs');
  if(!head||!actions)return;
  document.body.classList.add('m360-profile-open');
  if(!mobile()){
    head.classList.remove('m360-mobile-ready');head.querySelector('.m360-mobile-toolbar')?.remove();
    document.getElementById('m360back')?.replaceChildren(document.createTextNode('← Back to members'));
    if(tabs)tabs.style.gridTemplateColumns='';
    return;
  }
  head.classList.add('m360-mobile-ready');
  const back=document.getElementById('m360back');if(back)back.textContent='← Back';
  if(tabs){const count=Math.max(1,tabs.querySelectorAll('button').length);tabs.style.gridTemplateColumns=`repeat(${count},minmax(0,1fr))`}
  let toolbar=head.querySelector('.m360-mobile-toolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.className='m360-mobile-toolbar';head.appendChild(toolbar)}
  toolbar.replaceChildren();
  const status=actions.querySelector('.pill');if(status){const copy=status.cloneNode(true);copy.classList.add('m360-mobile-status');toolbar.appendChild(copy)}
  const all=[...actions.querySelectorAll('button')].filter(b=>!b.hidden),primary=all.find(b=>b.id==='m360edit')||all.find(b=>b.id==='m360digital')||all[0];
  if(primary){const p=document.createElement('button');p.type='button';p.className='m360-mobile-primary';p.textContent=primary.id==='m360edit'?'Edit':'ID';p.onclick=()=>primary.click();toolbar.appendChild(p)}
  const moreSources=all.filter(b=>b!==primary);if(moreSources.length){const more=document.createElement('button');more.type='button';more.className='m360-mobile-more';more.setAttribute('aria-label','More member actions');more.textContent='•••';more.onclick=()=>openActionSheet(moreSources);toolbar.appendChild(more)}
}
async function enhanceProfile(){
  queued=false;
  const body=document.getElementById('m360body');if(!body)return;
  enhanceMobileChrome();
  const id=detectMemberId();if(!id)return;
  const existing=document.getElementById('m360AttendanceVisual');if(existing?.dataset.memberId===id)return;
  existing?.remove();const panel=renderLoading(body);panel.dataset.memberId=id;
  const card=body.closest('.panel.card');card?.classList.add('m360-profile-polished');
  try{const stats=await loadStats(id);if(!panel.isConnected||panel.dataset.memberId!==id)return;renderStats(panel,stats);updateSummary(stats)}catch(e){console.warn('Member 360 visual attendance:',e);if(panel.isConnected)panel.innerHTML='<div class="m360-attendance-empty">Sunday attendance statistics are temporarily unavailable.</div>'}
}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>void enhanceProfile())}
function clearProfileChrome(){document.body.classList.remove('m360-profile-open');closeActionSheet()}
function bindMemberObserver(){
  const members=document.getElementById('members');
  if(members===observedMembers){queue();return}
  memberObserver?.disconnect();observedMembers=members||null;
  if(members){memberObserver=new MutationObserver(queue);memberObserver.observe(members,{childList:true,subtree:true})}
  queue();
}

document.addEventListener('click',e=>{const target=e.target.closest?.('[data-view-member],[data-member-id]');if(target){activeMemberId=target.dataset.viewMember||target.dataset.memberId||activeMemberId;queue()}if(e.target.closest?.('[data-route="members"],#m360back'))setTimeout(()=>{bindMemberObserver();if(!document.querySelector('#members .m360-head'))clearProfileChrome();queue()},80)},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&actionSheet)closeActionSheet()});
let resizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{enhanceMobileChrome();queue()},120)});
window.addEventListener('vccf-member-updated',()=>{cache.clear();queue()});
window.addEventListener('vccf-app-ready',bindMemberObserver);
window.addEventListener('vccf-signed-out',()=>{activeMemberId=null;cache.clear();clearProfileChrome();memberObserver?.disconnect();memberObserver=null;observedMembers=null});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindMemberObserver,{once:true});else bindMemberObserver();
})();
