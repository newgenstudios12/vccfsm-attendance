(() => {
'use strict';
if (window.__VCCF_SUNDAY_DASHBOARD__) return;
window.__VCCF_SUNDAY_DASHBOARD__ = true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const role=()=>String(state().profile?.role||'member').toLowerCase();
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const dateLabel=v=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00'));
const shortDay=v=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'}).format(new Date(v+'T12:00:00+08:00'));
const dayToIso=d=>phDay(d);
let carouselTimer=0;
let dashboardData=null;
let selectedSummary='sunday';

function previousSundayKey(){
  const today=phDay(new Date());
  const d=new Date(today+'T12:00:00+08:00');
  const dow=d.getDay();
  d.setDate(d.getDate()-(dow===0?7:dow));
  return dayToIso(d);
}
function sundayKeysBack(count){
  const first=new Date(previousSundayKey()+'T12:00:00+08:00'),out=[];
  for(let i=count-1;i>=0;i--){const d=new Date(first);d.setDate(d.getDate()-i*7);out.push(dayToIso(d))}
  return out;
}
function scopeCopy(){
  const r=role(),p=state().profile||{};
  if(r==='admin'||r==='pastor') return 'Church-wide Sunday performance and ministry pulse.';
  if(r==='area_leader') return 'Sunday performance for your accessible area and members.';
  return 'Your personal Sunday attendance and church highlights.';
}
function financeAllowed(){return ['admin','pastor'].includes(role())}
function activeMembers(){
  return (state().members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive');
}
function uniqueAttendance(rows,dateKey){
  return new Set(rows.filter(a=>a.checked_in_at&&phDay(a.checked_in_at)===dateKey).map(a=>a.member_id)).size;
}
function sumGiving(rows,dateKey,type){
  const wanted=String(type).toLowerCase();
  return rows.filter(g=>String(g.given_on||'')===dateKey&&String(g.giving_type||'').toLowerCase()===wanted).reduce((n,g)=>n+Number(g.amount||0),0);
}
function publicPhotoUrl(row){
  if(!row)return '';
  if(row.image_url)return row.image_url;
  if(row.storage_path)return sb()?.storage?.from('vccf-gallery')?.getPublicUrl(row.storage_path)?.data?.publicUrl||'';
  return '';
}
function summarySnapshot(rows,type,date,title){
  return (rows||[]).find(x=>String(x.summary_type||'').toLowerCase()===type&&x.summary_date===date&&(!title||String(x.title||'').toLowerCase()===String(title).toLowerCase()))
    ||(rows||[]).find(x=>String(x.summary_type||'').toLowerCase()===type&&x.summary_date===date)
    ||null;
}
function buildTrend(attendance){
  const keys=sundayKeysBack(5),values=keys.map(k=>uniqueAttendance(attendance,k)),max=Math.max(1,...values);
  return keys.map((k,i)=>({date:k,value:values[i],height:Math.max(8,Math.round(values[i]/max*100))}));
}
function currentMonthSundays(){
  const today=phDay(new Date()),ym=today.slice(0,7),keys=sundayKeysBack(8).filter(k=>k.startsWith(ym)&&k<=previousSundayKey());
  return keys;
}
function photoSetFor(data,kind){
  const summary=kind==='event'?data.event.summary:data.sunday.summary;
  const date=kind==='event'?data.event.date:data.sunday.date;
  const linked=(data.summaryPhotos||[]).filter(p=>summary&&p.summary_id===summary.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(p=>({url:p.image_url||publicPhotoUrl(data.photoById[p.photo_id]),caption:p.caption||data.photoById[p.photo_id]?.title||''})).filter(p=>p.url);
  if(linked.length)return linked;
  const dated=(data.galleryPhotos||[]).filter(p=>p.taken_on===date).map(p=>({url:publicPhotoUrl(p),caption:p.title||''})).filter(p=>p.url);
  if(dated.length)return dated;
  return (data.galleryPhotos||[]).filter(p=>p.featured).map(p=>({url:publicPhotoUrl(p),caption:p.title||''})).filter(p=>p.url);
}

async function loadDashboardData(){
  const client=sb();if(!client)throw new Error('Dashboard service is unavailable.');
  const prev=previousSundayKey(),rangeStart=new Date(prev+'T00:00:00+08:00');rangeStart.setDate(rangeStart.getDate()-42);
  const fromIso=rangeStart.toISOString(),nowIso=new Date().toISOString();
  const requests=[
    client.from('attendance').select('member_id,area_id,checked_in_at,source').gte('checked_in_at',fromIso).order('checked_in_at',{ascending:false}),
    client.from('church_events').select('id,title,event_type,start_at,location,status,area_id').lt('start_at',nowIso).order('start_at',{ascending:false}).limit(12),
    client.from('photos').select('id,title,storage_path,taken_on,featured,created_at').order('created_at',{ascending:false}).limit(30)
  ];
  if(financeAllowed())requests.push(client.from('giving_records').select('given_on,giving_type,amount').gte('given_on',dayToIso(rangeStart)).order('given_on',{ascending:false}));
  else requests.push(Promise.resolve({data:[],error:null}));
  if(['admin','pastor','area_leader'].includes(role()))requests.push(client.from('cms_sunday_event_summaries').select('*').order('summary_date',{ascending:false}).limit(30));
  else requests.push(Promise.resolve({data:[],error:null}));
  const [attRes,eventRes,photoRes,giveRes,sumRes]=await Promise.all(requests);
  const fatal=attRes.error||eventRes.error||photoRes.error;if(fatal)throw fatal;
  const events=eventRes.data||[],latestEvent=events[0]||null;
  let regs=[],summaryPhotos=[];
  if(latestEvent){
    const rr=await client.from('church_event_registrations').select('event_id,member_id,status,checked_in_at').eq('event_id',latestEvent.id);
    if(!rr.error)regs=rr.data||[];
  }
  const summaries=sumRes.data||[];
  const sundaySummary=summarySnapshot(summaries,'sunday',prev,'Sunday Worship');
  const eventDate=latestEvent?phDay(latestEvent.start_at):null;
  const eventSummary=latestEvent?summarySnapshot(summaries,'event',eventDate,latestEvent.title):null;
  const sumIds=[sundaySummary?.id,eventSummary?.id].filter(Boolean);
  if(sumIds.length){
    const sp=await client.from('cms_summary_photos').select('id,summary_id,photo_id,image_url,caption,sort_order').in('summary_id',sumIds).order('sort_order');
    if(!sp.error)summaryPhotos=sp.data||[];
  }
  const referenced=[...new Set(summaryPhotos.map(p=>p.photo_id).filter(Boolean))],photoById={};
  if(referenced.length){
    const pr=await client.from('photos').select('id,title,storage_path,taken_on,featured,created_at').in('id',referenced);
    (pr.data||[]).forEach(p=>photoById[p.id]=p);
  }
  const attendance=attRes.data||[],giving=giveRes.data||[],members=activeMembers();
  const prevPresent=uniqueAttendance(attendance,prev),base=Math.max(0,members.length),prevRate=base?Math.round(prevPresent/base*100):0;
  const monthKeys=currentMonthSundays(),monthValues=monthKeys.map(k=>uniqueAttendance(attendance,k)),monthAvg=monthValues.length?Math.round(monthValues.reduce((a,b)=>a+b,0)/monthValues.length):0;
  const checkedRegs=regs.filter(r=>r.checked_in_at||String(r.status||'').toLowerCase()==='attended'),eventAttendance=new Set(checkedRegs.map(r=>r.member_id)).size;
  const roster=regs.filter(r=>String(r.status||'').toLowerCase()!=='cancelled').length;
  const liveSundayTithe=sumGiving(giving,prev,'Tithe'),liveSundayOffering=sumGiving(giving,prev,'Offering');
  const sunday={
    date:prev,title:'Sunday Worship',attendance:sundaySummary?.attendance_count??prevPresent,base:sundaySummary?.member_base_count??base,
    rate:Number(sundaySummary?.attendance_rate??prevRate),tithe:sundaySummary?.tithe_total??liveSundayTithe,offering:sundaySummary?.offering_total??liveSundayOffering,
    notes:sundaySummary?.notes||'',summary:sundaySummary
  };
  const event={
    exists:Boolean(latestEvent),id:latestEvent?.id||null,title:latestEvent?.title||'No completed event yet',date:eventDate,
    attendance:eventSummary?.attendance_count??eventAttendance,base:eventSummary?.member_base_count??roster,
    rate:Number(eventSummary?.attendance_rate??(roster?Math.round(eventAttendance/roster*100):0)),
    tithe:eventSummary?.tithe_total??null,offering:eventSummary?.offering_total??null,notes:eventSummary?.notes||'',summary:eventSummary,
    location:latestEvent?.location||'',eventType:latestEvent?.event_type||'Event'
  };
  return {attendance,giving,galleryPhotos:photoRes.data||[],summaries,summaryPhotos,photoById,sunday,event,trend:buildTrend(attendance),monthAvg,activeCount:base};
}

function renderCarousel(data,kind){
  clearInterval(carouselTimer);
  const host=document.getElementById('summaryCarousel');if(!host)return;
  const photos=photoSetFor(data,kind);
  if(!photos.length){host.innerHTML='<div class="summary-photo-empty"><strong>No summary photos yet</strong><span>Featured gallery photos will appear here automatically when available.</span></div>';return}
  let index=0;
  const draw=()=>{
    const p=photos[index];
    host.innerHTML='<div class="summary-photo-stage"><img src="'+esc(p.url)+'" alt="'+esc(p.caption||'Church summary photo')+'"><div class="summary-photo-overlay"><span>'+(p.caption?esc(p.caption):'Church highlight')+'</span><b>'+(index+1)+' / '+photos.length+'</b></div></div>'+(photos.length>1?'<button class="summary-carousel-arrow prev" type="button" aria-label="Previous photo">‹</button><button class="summary-carousel-arrow next" type="button" aria-label="Next photo">›</button><div class="summary-carousel-dots">'+photos.map((_,i)=>'<button type="button" aria-label="Photo '+(i+1)+'" class="'+(i===index?'active':'')+'" data-carousel-dot="'+i+'"></button>').join('')+'</div>':'');
    host.querySelector('.prev')?.addEventListener('click',()=>{index=(index-1+photos.length)%photos.length;draw()});
    host.querySelector('.next')?.addEventListener('click',()=>{index=(index+1)%photos.length;draw()});
    host.querySelectorAll('[data-carousel-dot]').forEach(b=>b.onclick=()=>{index=Number(b.dataset.carouselDot)||0;draw()});
  };
  draw();
  if(photos.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)carouselTimer=setInterval(()=>{index=(index+1)%photos.length;draw()},5500);
}
function summaryMetric(label,value,sub){return '<div class="summary-metric"><span>'+esc(label)+'</span><strong>'+value+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>'}
function renderSummary(kind){
  const data=dashboardData;if(!data)return;selectedSummary=kind;
  document.querySelectorAll('[data-summary-kind]').forEach(b=>b.classList.toggle('active',b.dataset.summaryKind===kind));
  const item=kind==='event'?data.event:data.sunday,host=document.getElementById('summaryAnalyticsBody');if(!host)return;
  if(kind==='event'&&!item.exists){host.innerHTML='<div class="summary-empty">There is no previous event to summarize yet.</div>';renderCarousel(data,kind);return}
  const finance=financeAllowed(),attendanceText=String(item.attendance)+(item.base?' / '+item.base:'');
  const financeHtml=finance
    ?summaryMetric('Tithes',item.tithe==null?'Not recorded':php(item.tithe),'Summary total')+summaryMetric('Offerings',item.offering==null?'Not recorded':php(item.offering),'Summary total')
    :summaryMetric('Tithes','Restricted','Pastor / Admin only')+summaryMetric('Offerings','Restricted','Pastor / Admin only');
  host.innerHTML='<div class="summary-title-row"><div><span class="summary-kicker">'+(kind==='event'?esc(item.eventType):'PREVIOUS SUNDAY')+'</span><h3>'+esc(item.title)+'</h3><p>'+esc(dateLabel(item.date))+(item.location?' · '+esc(item.location):'')+'</p></div><span class="summary-rate-pill">'+Math.round(Number(item.rate)||0)+'% attendance</span></div><div class="summary-metrics">'+summaryMetric('Attendance',attendanceText,item.base?'Present / expected':'Recorded attendance')+summaryMetric('Attendance rate',Math.round(Number(item.rate)||0)+'%','Participation')+financeHtml+'</div>'+(item.notes?'<div class="summary-note">'+esc(item.notes)+'</div>':'');
  renderCarousel(data,kind);
}
function renderDashboard(){
  const el=document.getElementById('dashboard');if(!el||!dashboardData)return;
  const s=state(),p=s.profile||{},email=s.session?.user?.email||'',name=p.display_name||memberName((s.members||[]).find(m=>m.id===p.member_id))||email||'Kapatid';
  const trend=dashboardData.trend,max=Math.max(1,...trend.map(x=>x.value));
  const topRate=Math.round(Number(dashboardData.sunday.rate)||0);
  el.innerHTML='<section class="welcome-banner card"><div><span class="welcome-kicker">VCCF SANTA MARIA</span><h2>Welcome, Kapatid!</h2><p>'+esc(name)+' · '+esc(scopeCopy())+'</p></div><div class="welcome-date">'+esc(new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric'}).format(new Date()))+'</div></section><div class="dashboard-section-head"><div><span class="dashboard-kicker">SUNDAY ANALYTICS</span><h2>Sunday Analytics & Stats</h2><p>Performance is based on completed Sundays only. Event attendance stays separate.</p></div><span class="scope-chip">'+esc(role().replace(/_/g,' '))+'</span></div><div class="sunday-stat-grid">'+summaryMetric('Previous Sunday',String(dashboardData.sunday.attendance),dateLabel(dashboardData.sunday.date))+summaryMetric('Attendance rate',topRate+'%','Previous Sunday')+summaryMetric('Monthly average',String(dashboardData.monthAvg),'Completed Sundays this month')+summaryMetric(role()==='member'?'Accessible members':'Active members',String(dashboardData.activeCount),'Current analytics scope')+'</div><section class="sunday-trend card"><div class="trend-copy"><span class="dashboard-kicker">5-SUNDAY TREND</span><h3>Attendance movement</h3><p>Each bar represents the accessible attendance count for that Sunday.</p></div><div class="trend-bars">'+trend.map(x=>'<div class="trend-item"><strong>'+x.value+'</strong><div class="trend-track"><i style="height:'+Math.max(8,Math.round(x.value/max*100))+'%"></i></div><span>'+esc(shortDay(x.date))+'</span></div>').join('')+'</div></section><section class="summary-layout"><div class="summary-analytics card"><div class="summary-tabs"><button class="active" type="button" data-summary-kind="sunday">Previous Sunday</button><button type="button" data-summary-kind="event" '+(dashboardData.event.exists?'':'disabled')+'>Latest Event</button></div><div id="summaryAnalyticsBody"></div></div><div class="summary-carousel-card card"><div class="carousel-heading"><div><span class="dashboard-kicker">FEATURED PHOTOS</span><h3>Summary Highlights</h3></div><span>Carousel</span></div><div id="summaryCarousel" class="summary-carousel"></div></div></section>';
  el.querySelectorAll('[data-summary-kind]').forEach(b=>b.onclick=()=>renderSummary(b.dataset.summaryKind));
  renderSummary(selectedSummary==='event'&&dashboardData.event.exists?'event':'sunday');
}
async function refresh(){
  const el=document.getElementById('dashboard');if(!el)return;
  el.innerHTML='<div class="dashboard-loading card">Loading Sunday analytics…</div>';
  try{dashboardData=await loadDashboardData();renderDashboard()}catch(e){console.error('VCCF Sunday Dashboard',e);el.innerHTML='<div class="notice">Sunday analytics could not be loaded. '+esc(e.message||'Please refresh and try again.')+'</div>'}
}
function boot(){
  window.addEventListener('vccf-app-ready',refresh);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-route="dashboard"]'))setTimeout(refresh,30)});
  window.addEventListener('vccf-profile-photo-updated',()=>setTimeout(refresh,30));
  if(document.getElementById('app')?.classList.contains('show'))refresh();
  window.VCCFSundayDashboard={refresh};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();