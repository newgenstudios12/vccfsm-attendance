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
let announcementTimer=0;
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
function upcomingBirthdays(members,days=30,limit=8){
  const todayKey=phDay(new Date()),parts=todayKey.split('-').map(Number),today=new Date(parts[0],parts[1]-1,parts[2]),out=[];
  for(const m of members||[]){
    const raw=String(m.birth_date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))continue;
    const [,mm,dd]=raw.split('-').map(Number);
    let next=new Date(parts[0],mm-1,dd);
    if(next<today)next=new Date(parts[0]+1,mm-1,dd);
    const diff=Math.round((next-today)/86400000);
    if(diff<0||diff>days)continue;
    out.push({member:m,next,diff});
  }
  return out.sort((a,b)=>a.diff-b.diff||memberName(a.member).localeCompare(memberName(b.member))).slice(0,limit);
}
function birthdayDateLabel(date){
  return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'long',day:'numeric'}).format(new Date(date.getFullYear(),date.getMonth(),date.getDate(),12));
}
function birthdayCard(birthdays){
  const items=(birthdays||[]).map(({member,next,diff})=>{
    const name=memberName(member),photo=member.photo_url||'',when=diff===0?'Today':diff===1?'Tomorrow':'In '+diff+' days';
    const avatar=photo?'<img src="'+esc(photo)+'" alt="" loading="lazy">':'<span>'+esc(name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'V')+'</span>';
    return '<div class="birthday-person"><div class="birthday-avatar">'+avatar+'</div><div class="birthday-person-copy"><b>'+esc(name)+'</b><span>'+esc(birthdayDateLabel(next))+'</span></div><span class="birthday-when '+(diff===0?'today':'')+'">'+esc(when)+'</span></div>';
  }).join('');
  return '<section class="birthday-card card"><div class="birthday-head"><div><span class="dashboard-kicker">BIRTHDAYS</span><h3>Upcoming Celebrants 🎂</h3><p>Active members with birthdays in the next 30 days.</p></div><span class="birthday-count">'+(birthdays?.length||0)+' upcoming</span></div><div class="birthday-list">'+(items||'<div class="birthday-empty"><strong>No upcoming birthdays</strong><span>No birthdays are recorded in your accessible member scope for the next 30 days.</span></div>')+'</div></section>';
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
function buildAreaStats(attendance,dateKey,members){
  const accessible=(members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive');
  const presentIds=new Set((attendance||[]).filter(a=>a.checked_in_at&&phDay(a.checked_in_at)===dateKey).map(a=>a.member_id));
  const areas=(state().areas||[]).filter(a=>a.is_active!==false&&(role()!=='area_leader'||a.id===state().profile?.area_id));
  const stats=areas.map(area=>{
    const scoped=accessible.filter(m=>m.area_id===area.id),base=scoped.length,present=scoped.filter(m=>presentIds.has(m.id)).length;
    return {id:area.id,name:area.name||'Area',present,base,rate:base?Math.round(present/base*100):0};
  }).filter(item=>item.base>0||item.present>0);
  const unassigned=accessible.filter(m=>!m.area_id);
  if(unassigned.length&&role()!=='area_leader'){
    const present=unassigned.filter(m=>presentIds.has(m.id)).length;
    stats.push({id:'unassigned',name:'Unassigned',present,base:unassigned.length,rate:Math.round(present/unassigned.length*100)});
  }
  return stats;
}
function areaAttendanceSection(items,dateKey){
  if(role()==='member')return '';
  const cards=(items||[]).map(item=>'<article class="area-attendance-card"><div class="area-attendance-card-head"><div><span>AREA</span><h3>'+esc(item.name)+'</h3></div><b>'+item.rate+'%</b></div><div class="area-attendance-count"><strong>'+item.present+' / '+item.base+'</strong><span>present members</span></div><div class="area-attendance-track" aria-label="'+esc(item.name)+' attendance '+item.rate+' percent"><i style="width:'+Math.max(0,Math.min(100,item.rate))+'%"></i></div></article>').join('');
  return '<section class="area-attendance-section card"><div class="area-attendance-head"><div><span class="dashboard-kicker">PREVIOUS SUNDAY · '+esc(shortDay(dateKey))+'</span><h2>Attendance by Area</h2><p>Attendance performance for each accessible area from the previous Sunday.</p></div><span class="scope-chip">'+(items?.length||0)+' area'+((items?.length||0)===1?'':'s')+'</span></div><div class="area-attendance-grid">'+(cards||'<div class="area-attendance-empty">No area attendance data is available for the previous Sunday.</div>')+'</div></section>';
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
  if(kind==='event'){
    const attached=(data.eventPhotos||[]).filter(p=>p.event_id===data.event.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(p=>({url:p.image_url||publicPhotoUrl(p),caption:p.caption||''})).filter(p=>p.url);
    if(attached.length)return attached;
    if(summary)return [];
  }else if(summary)return [];
  const dated=(data.galleryPhotos||[]).filter(p=>p.taken_on===date).map(p=>({url:publicPhotoUrl(p),caption:p.title||''})).filter(p=>p.url);
  if(dated.length)return dated;
  return (data.galleryPhotos||[]).filter(p=>p.featured).map(p=>({url:publicPhotoUrl(p),caption:p.title||''})).filter(p=>p.url);
}
function summaryPhotoStrip(data,kind){
  const all=photoSetFor(data,kind),photos=all.slice(0,4);
  if(!photos.length)return '<div class="summary-inline-photo-empty">No photos attached to this '+(kind==='event'?'event':'Sunday summary')+' yet.</div>';
  return '<div class="summary-inline-photo-wrap"><div class="summary-inline-photo-head"><span>Photos</span><small>'+all.length+' attached</small></div><div class="summary-inline-photos">'+photos.map(photo=>'<img src="'+esc(photo.url)+'" alt="'+esc(photo.caption||'Summary photo')+'" loading="lazy">').join('')+'</div></div>';
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
  requests.push(client.from('cms_sunday_event_summaries').select('*').eq('workflow_status','posted').order('summary_date',{ascending:false}).limit(30));
  const [attRes,eventRes,photoRes,giveRes,sumRes]=await Promise.all(requests);
  const fatal=attRes.error||eventRes.error||photoRes.error;if(fatal)throw fatal;
  const events=eventRes.data||[],latestEvent=events[0]||null;
  let regs=[],summaryPhotos=[],eventPhotos=[];
  if(latestEvent){
    const [rr,ep]=await Promise.all([
      client.from('church_event_registrations').select('event_id,member_id,status,checked_in_at').eq('event_id',latestEvent.id),
      client.from('church_event_photos').select('id,event_id,image_url,storage_path,caption,sort_order,created_at').eq('event_id',latestEvent.id).order('sort_order').order('created_at')
    ]);
    if(!rr.error)regs=rr.data||[];
    if(!ep.error)eventPhotos=ep.data||[];
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
  const annRes=await client.from('church_announcements').select('id,title,body,audience,publish_at,expires_at,image_url').eq('is_published',true).lte('publish_at',nowIso).or('expires_at.is.null,expires_at.gt.'+nowIso).order('publish_at',{ascending:false}).limit(10);
  const announcements=annRes.error?[]:(annRes.data||[]);
  const attendance=attRes.data||[],giving=giveRes.data||[],members=activeMembers();
  const prevPresent=uniqueAttendance(attendance,prev),base=Math.max(0,members.length),prevRate=base?Math.round(prevPresent/base*100):0;
  const monthKeys=currentMonthSundays(),monthValues=monthKeys.map(k=>uniqueAttendance(attendance,k)),monthAvg=monthValues.length?Math.round(monthValues.reduce((a,b)=>a+b,0)/monthValues.length):0;
  const areaStats=buildAreaStats(attendance,prev,members);
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
  return {attendance,giving,galleryPhotos:photoRes.data||[],summaries,summaryPhotos,eventPhotos,announcements,photoById,sunday,event,areaStats,monthAvg,activeCount:base};
}

function renderCarousel(data,kind){
  clearInterval(carouselTimer);
  const host=document.getElementById('summaryCarousel');if(!host)return;
  const photos=photoSetFor(data,kind);
  if(!photos.length){host.innerHTML='<div class="summary-photo-empty"><strong>No summary photos yet</strong><span>'+(kind==='event'?'Add photos in Event Attendance or attach them to the Event Summary.':'Add photos to the posted Sunday Summary.')+'</span></div>';return}
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
  host.innerHTML='<div class="summary-title-row"><div><span class="summary-kicker">'+(kind==='event'?esc(item.eventType):'PREVIOUS SUNDAY')+'</span><h3>'+esc(item.title)+'</h3><p>'+esc(dateLabel(item.date))+(item.location?' · '+esc(item.location):'')+'</p></div><span class="summary-rate-pill">'+Math.round(Number(item.rate)||0)+'% attendance</span></div><div class="summary-metrics">'+summaryMetric('Attendance',attendanceText,item.base?'Present / expected':'Recorded attendance')+summaryMetric('Attendance rate',Math.round(Number(item.rate)||0)+'%','Participation')+financeHtml+'</div>'+(item.notes?'<div class="summary-note">'+esc(item.notes)+'</div>':'')+summaryPhotoStrip(data,kind);
  renderCarousel(data,kind);
}

function announcementDate(value){
  return value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(value)):'';
}
function renderAnnouncementCarousel(data){
  clearInterval(announcementTimer);
  const host=document.getElementById('dashboardAnnouncementCarousel'),items=data?.announcements||[];
  if(!host||!items.length)return;
  let index=0;
  const draw=()=>{
    const a=items[index],image=a.image_url||'';
    host.innerHTML='<article class="announcement-slide '+(image?'has-image':'text-only')+'">'+
      (image?'<div class="announcement-image"><img src="'+esc(image)+'" alt="'+esc(a.title||'Announcement')+'" loading="lazy"></div>':'')+
      '<div class="announcement-copy"><div class="announcement-meta"><span>ANNOUNCEMENT</span><small>'+esc(announcementDate(a.publish_at))+'</small></div><h3>'+esc(a.title||'Announcement')+'</h3>'+(a.body?'<p>'+esc(a.body)+'</p>':'')+'</div>'+
      (items.length>1?'<button class="announcement-arrow prev" type="button" aria-label="Previous announcement">‹</button><button class="announcement-arrow next" type="button" aria-label="Next announcement">›</button><div class="announcement-dots">'+items.map((_,i)=>'<button type="button" aria-label="Announcement '+(i+1)+'" class="'+(i===index?'active':'')+'" data-announcement-dot="'+i+'"></button>').join('')+'</div>':'')+
      '</article>';
    host.querySelector('.prev')?.addEventListener('click',()=>{index=(index-1+items.length)%items.length;draw()});
    host.querySelector('.next')?.addEventListener('click',()=>{index=(index+1)%items.length;draw()});
    host.querySelectorAll('[data-announcement-dot]').forEach(button=>button.onclick=()=>{index=Number(button.dataset.announcementDot)||0;draw()});
  };
  draw();
  if(items.length>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)announcementTimer=setInterval(()=>{index=(index+1)%items.length;draw()},6500);
}

function renderDashboard(){
  const el=document.getElementById('dashboard');if(!el||!dashboardData)return;
  const s=state(),p=s.profile||{},email=s.session?.user?.email||'',name=p.display_name||memberName((s.members||[]).find(m=>m.id===p.member_id))||email||'Kapatid';
  const topRate=Math.round(Number(dashboardData.sunday.rate)||0),birthdays=upcomingBirthdays(activeMembers());
  el.innerHTML='<section class="welcome-banner card"><div><span class="welcome-kicker">VCCF SANTA MARIA</span><h2>Welcome, Kapatid!</h2><p>'+esc(name)+' · '+esc(scopeCopy())+'</p></div><div class="welcome-date">'+esc(new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric'}).format(new Date()))+'</div></section>'+(dashboardData.announcements?.length?'<section class="dashboard-announcements card"><div class="dashboard-announcement-head"><div><span class="dashboard-kicker">ANNOUNCEMENTS</span><h2>Church Updates</h2></div><span>'+dashboardData.announcements.length+' active</span></div><div id="dashboardAnnouncementCarousel"></div></section>':'')+'<div class="dashboard-section-head"><div><span class="dashboard-kicker">SUNDAY ANALYTICS</span><h2>Sunday Analytics & Stats</h2><p>Performance is based on completed Sundays only. Event attendance stays separate.</p></div><span class="scope-chip">'+esc(role().replace(/_/g,' '))+'</span></div><div class="sunday-stat-grid">'+summaryMetric('Previous Sunday',String(dashboardData.sunday.attendance),dateLabel(dashboardData.sunday.date))+summaryMetric('Attendance rate',topRate+'%','Previous Sunday')+summaryMetric('Monthly average',String(dashboardData.monthAvg),'Completed Sundays this month')+summaryMetric(role()==='member'?'Accessible members':'Active members',String(dashboardData.activeCount),'Current analytics scope')+'</div>'+birthdayCard(birthdays)+areaAttendanceSection(dashboardData.areaStats,dashboardData.sunday.date)+'<section class="summary-layout"><div class="summary-analytics card"><div class="summary-tabs"><button class="active" type="button" data-summary-kind="sunday">Previous Sunday</button><button type="button" data-summary-kind="event" '+(dashboardData.event.exists?'':'disabled')+'>Latest Event</button></div><div id="summaryAnalyticsBody"></div></div><div class="summary-carousel-card card"><div class="carousel-heading"><div><span class="dashboard-kicker">FEATURED PHOTOS</span><h3>Summary Highlights</h3></div><span>Carousel</span></div><div id="summaryCarousel" class="summary-carousel"></div></div></section>';
  renderAnnouncementCarousel(dashboardData);
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
  window.addEventListener('vccf-sunday-summary-posted',()=>setTimeout(refresh,30));
  window.addEventListener('vccf-event-photos-updated',()=>setTimeout(refresh,30));
  window.addEventListener('vccf-announcement-updated',()=>setTimeout(refresh,30));
  if(document.getElementById('app')?.classList.contains('show'))refresh();
  window.VCCFSundayDashboard={refresh};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();