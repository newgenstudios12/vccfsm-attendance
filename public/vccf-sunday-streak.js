(()=>{
'use strict';
if(window.__VCCF_SUNDAY_STREAK__)return;
window.__VCCF_SUNDAY_STREAK__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const phDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const dateLabel=key=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(key+'T12:00:00+08:00'));
let cachedMemberId='';
let cachedStats=null;
let loading=false;
let renderTimer=0;
let refreshTimer=0;

function addDays(key,days){
  const d=new Date(key+'T12:00:00+08:00');
  d.setDate(d.getDate()+days);
  return phDay(d);
}
function isSundayKey(key){return new Date(key+'T12:00:00+08:00').getDay()===0}
function previousSundayKey(){
  const today=phDay(new Date()),d=new Date(today+'T12:00:00+08:00'),dow=d.getDay();
  d.setDate(d.getDate()-(dow===0?7:dow));
  return phDay(d);
}
function milestoneFor(streak){
  if(streak>=52)return 'One Year Faithful';
  if(streak>=26)return '26-Sunday Milestone';
  if(streak>=12)return '12-Sunday Milestone';
  if(streak>=4)return '4-Sunday Milestone';
  return '';
}
function computeStats(rows){
  const dates=[...new Set((rows||[]).map(row=>row?.checked_in_at?phDay(row.checked_in_at):'').filter(key=>key&&isSundayKey(key)))].sort();
  if(!dates.length)return {current:0,longest:0,last:null,milestone:''};
  const present=new Set(dates);
  let longest=1,run=1;
  for(let i=1;i<dates.length;i++){
    run=dates[i]===addDays(dates[i-1],7)?run+1:1;
    if(run>longest)longest=run;
  }
  const today=phDay(new Date());
  const anchor=isSundayKey(today)&&present.has(today)?today:previousSundayKey();
  let current=0,cursor=anchor;
  while(present.has(cursor)){current++;cursor=addDays(cursor,-7)}
  return {current,longest,last:dates[dates.length-1],milestone:milestoneFor(current)};
}
function installStyles(){
  if(document.getElementById('vccfSundayStreakStyles'))return;
  const style=document.createElement('style');
  style.id='vccfSundayStreakStyles';
  style.textContent=`
.sunday-stat-grid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}
.vccf-sunday-streak-card{position:relative;overflow:hidden;background:linear-gradient(135deg,rgba(255,138,24,.15),var(--card))!important;border-color:rgba(255,138,24,.38)!important}
.vccf-sunday-streak-card:after{content:"🔥";position:absolute;right:13px;top:10px;font-size:1.8rem;opacity:.17;pointer-events:none}
.vccf-sunday-streak-card strong{color:#c65a00}
.vccf-sunday-streak-card small{max-width:90%}
.vccf-sunday-streak-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.vccf-sunday-streak-chip{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;background:rgba(255,138,24,.12);color:#a84d00;font-size:.61rem;font-weight:900}
:root[data-theme="dark"] .vccf-sunday-streak-card{background:linear-gradient(135deg,rgba(255,138,24,.18),var(--card))!important}
:root[data-theme="dark"] .vccf-sunday-streak-card strong{color:#ffad55}
:root[data-theme="dark"] .vccf-sunday-streak-chip{color:#ffc27e;background:rgba(255,138,24,.16)}
@media(max-width:760px){.sunday-stat-grid{grid-template-columns:1fr 1fr!important}}
@media(max-width:480px){.sunday-stat-grid{grid-template-columns:1fr!important}}
`;
  document.head.appendChild(style);
}
function cardHtml(stats){
  const count=Number(stats?.current)||0,best=Number(stats?.longest)||0;
  const unit=count===1?'Sunday':'Sundays';
  const last=stats?.last?'Last attended: '+dateLabel(stats.last):'No Sunday attendance yet';
  const badge=stats?.milestone?'<span class="vccf-sunday-streak-chip">🏆 '+stats.milestone+'</span>':'';
  return '<span>🔥 Sunday Streak</span><strong>'+count+' '+unit+'</strong><small>Best streak: '+best+' · '+last+'</small>'+(badge?'<div class="vccf-sunday-streak-meta">'+badge+'</div>':'');
}
function render(){
  const profile=state().profile||{},memberId=profile.member_id;
  const old=document.querySelector('[data-vccf-sunday-streak="1"]');
  if(!state().session?.user||!memberId){old?.remove();return}
  const grid=document.querySelector('#dashboard .sunday-stat-grid');
  if(!grid||!cachedStats||cachedMemberId!==memberId)return;
  let card=old;
  if(!card){
    card=document.createElement('div');
    card.className='summary-metric vccf-sunday-streak-card';
    card.dataset.vccfSundayStreak='1';
  }
  card.innerHTML=cardHtml(cachedStats);
  const first=grid.firstElementChild;
  if(card.parentElement!==grid){if(first)first.after(card);else grid.appendChild(card)}
}
function queueRender(delay=30){clearTimeout(renderTimer);renderTimer=setTimeout(render,delay)}
async function refresh(force=false){
  const profile=state().profile||{},memberId=profile.member_id,client=sb();
  if(!state().session?.user||!memberId||!client){cachedMemberId='';cachedStats=null;queueRender();return}
  if(loading)return;
  if(!force&&cachedMemberId===memberId&&cachedStats){queueRender();return}
  loading=true;
  try{
    const result=await client.from('attendance').select('checked_in_at,attendance_type').eq('member_id',memberId).or('attendance_type.eq.sunday,attendance_type.is.null').order('checked_in_at',{ascending:true});
    if(result.error)throw result.error;
    cachedMemberId=memberId;
    cachedStats=computeStats(result.data||[]);
    queueRender();
  }catch(error){
    console.warn('VCCF Sunday Streak:',error);
    cachedMemberId=memberId;
    cachedStats=null;
    document.querySelector('[data-vccf-sunday-streak="1"]')?.remove();
  }finally{loading=false}
}
function queueRefresh(delay=80,force=true){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(force),delay)}
function boot(){
  installStyles();
  const dashboard=document.getElementById('dashboard');
  if(dashboard)new MutationObserver(records=>{
    const relevant=records.some(record=>!record.target?.closest?.('[data-vccf-sunday-streak="1"]'));
    if(relevant)queueRender(20);
  }).observe(dashboard,{childList:true,subtree:true});
  window.addEventListener('vccf-app-ready',()=>queueRefresh(180,true));
  window.addEventListener('vccf-signed-out',()=>{cachedMemberId='';cachedStats=null;document.querySelector('[data-vccf-sunday-streak="1"]')?.remove()});
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-route="dashboard"],[data-view="dashboard"]'))queueRefresh(120,true)});
  queueRefresh(650,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.VCCFSundayStreak={refresh:()=>refresh(true)};
})();
