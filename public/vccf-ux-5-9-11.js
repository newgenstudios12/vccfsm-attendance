(()=>{
'use strict';
if(window.__VCCF_UX_5_9_11__)return;
window.__VCCF_UX_5_9_11__=true;

const S=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastMemberId=null;
let fastPreviewActive=false;
let photoEventIds=new Set();
let photoLoadAt=0;

function loadStyle(href,key){
  if(document.querySelector(`link[data-${key}]`))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset[key]='1';document.head.appendChild(link);
}
function loadScript(src,key){
  if(document.querySelector(`script[data-${key}]`))return Promise.resolve();
  return new Promise(resolve=>{const script=document.createElement('script');script.src=src;script.defer=true;script.dataset[key]='1';script.onload=resolve;script.onerror=resolve;document.head.appendChild(script)});
}
function loadPack(){
  loadStyle('/vccf-device-responsive.css?v=20260915-2','vccfUxResponsive');
  loadStyle('/vccf-ux-5-9-11.css?v=20260915-2','vccfUxPack');
  return loadScript('/vccf-member-360.js?v=20260915-1','vccfUxMember360')
    .then(()=>loadScript('/vccf-events-gallery.js?v=20260915-1','vccfUxEventsGallery'))
    .then(()=>loadScript('/vccf-event-attendance-gallery.js?v=20260915-1','vccfUxEventAttendanceGallery'));
}

const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
const initials=v=>String(v||'V').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'V';
const areaName=id=>(S().areas||[]).find(a=>String(a.id)===String(id))?.name||'Unassigned';
const currentRole=()=>String(S().profile?.role||'member').toLowerCase();
const canSeeFinance=m=>['admin','pastor'].includes(currentRole())||String(m?.id)===String(S().profile?.member_id||'');
function memberAddress(m){return [m?.barangay,m?.city_municipality,m?.province].filter(Boolean).join(', ')||m?.address||'Not recorded'}

function renderFastMemberPreview(){
  if(!fastPreviewActive||!lastMemberId)return;
  const host=document.getElementById('members');if(!host)return;
  if(host.querySelector('.m360-head')){fastPreviewActive=false;return}
  if(host.querySelector('[data-m360-fast-preview]'))return;
  const m=(S().members||[]).find(x=>String(x.id)===String(lastMemberId));if(!m)return;
  const active=m.is_active!==false&&String(m.status||'active').toLowerCase()!=='inactive',code=m.member_number||m.member_code||m.id,finance=canSeeFinance(m);
  host.innerHTML=`<div class="m360-fast-preview" data-m360-fast-preview="1"><div class="m360-fast-head"><button class="back-button m360-fast-back" type="button">← Back to members</button><div class="m360-fast-actions"><button class="btn secondary m360-fast-digital" type="button">View Digital ID</button><span class="pill ${active?'active':'inactive'}">${esc(m.status||(active?'Active':'Inactive'))}</span></div></div><section class="panel card"><div class="m360-hero"><div class="m360-photo">${m.photo_url?`<img src="${esc(m.photo_url)}" alt="${esc(memberName(m))}">`:esc(initials(memberName(m)))}</div><div class="m360-identity"><h2 style="margin:0 0 5px">${esc(memberName(m))}</h2><div class="hint">${esc(code)} · ${esc(areaName(m.area_id))} · ${esc(m.member_type||'Member')}</div></div><div class="m360-hero-qr"><div id="m360FastQr" class="m360-qr" aria-label="Member QR code"></div><div class="m360-hero-qr-copy"><strong>Member QR</strong><div class="m360-qr-code">${esc(code)}</div></div></div></div><div class="m360-fast-overview-tab">Overview</div><div class="m360-grid"><div class="m360-box"><span>Area</span><strong>${esc(areaName(m.area_id))}</strong></div><div class="m360-box"><span>Member type</span><strong>${esc(m.member_type||'Member')}</strong></div><div class="m360-box"><span>Address</span><strong>${esc(memberAddress(m))}</strong></div></div><div class="m360-summary-grid"><div class="m360-summary m360-fast-loading"><h3>Sunday Attendance</h3><strong>Loading current month…</strong><div class="hint">Attendance details are loading.</div></div><div class="m360-summary m360-fast-loading"><h3>Ministry</h3><strong>Loading assignments…</strong><div class="hint">Ministry details are loading.</div></div>${finance?'<div class="m360-summary m360-fast-loading"><h3>Giving</h3><strong>Loading summary…</strong><div class="hint">Private giving details are loading.</div></div>':''}</div><div class="m360-summary" style="margin-top:10px"><h3>Recent Sunday Attendance</h3><div class="m360-fast-lines"><div class="m360-fast-line"></div><div class="m360-fast-line"></div><div class="m360-fast-line"></div></div><div class="m360-fast-note">Loading activity without delaying the member profile.</div></div></section></div>`;
  const qr=document.getElementById('m360FastQr');if(qr&&window.QRCode)try{new QRCode(qr,{text:'VCCF-MEMBER:'+String(code),width:96,height:96})}catch(_){}
  host.querySelector('.m360-fast-back')?.addEventListener('click',()=>{fastPreviewActive=false;document.querySelector('.nav [data-route="members"]')?.click()});
  host.querySelector('.m360-fast-digital')?.addEventListener('click',()=>window.VCCFMemberIds?.openMember?.(m.id));
}
function beginFastMemberPreview(id){lastMemberId=id;fastPreviewActive=true;setTimeout(renderFastMemberPreview,0);setTimeout(renderFastMemberPreview,95)}

async function refreshPhotoEventIds(force=false){
  const now=Date.now();if(!force&&now-photoLoadAt<15000)return photoEventIds;
  const client=db();if(!client)return photoEventIds;
  photoLoadAt=now;
  try{const {data,error}=await client.from('church_event_photos').select('event_id').limit(5000);if(error)throw error;photoEventIds=new Set((data||[]).map(x=>String(x.event_id)).filter(Boolean));}
  catch(e){console.warn('VCCF event workflow photos:',e)}
  return photoEventIds;
}

function navigate(route){document.querySelector(`.nav [data-route="${route}"]`)?.click()}
function openEventGallery(id){
  navigate('gallery');
  let tries=0;const timer=setInterval(()=>{tries++;const card=document.querySelector(`[data-gallery-album="event:${CSS.escape(String(id))}"]`);if(card){clearInterval(timer);card.click();return}if(tries>=30)clearInterval(timer)},100);
}

function workflowBanner(){
  const hero=document.querySelector('.vccf-events-hero');
  if(!hero||hero.querySelector('.vccf-event-workflow'))return;
  const flow=document.createElement('div');flow.className='vccf-event-workflow';
  flow.innerHTML='<span><b>1</b> Event</span><i>→</i><span><b>2</b> Attendance</span><i>→</i><span><b>3</b> Photos & Gallery</span>';
  hero.appendChild(flow);
}

async function enhanceEventCards(){
  const grid=document.querySelector('.vccf-events-grid');if(!grid)return;
  workflowBanner();await refreshPhotoEventIds();
  grid.querySelectorAll('.vccf-event-card').forEach(card=>{
    if(card.dataset.workflowEnhanced==='1')return;
    const source=card.querySelector('[data-att],[data-edit]'),id=source?.dataset.att||source?.dataset.edit;if(!id)return;
    card.dataset.workflowEnhanced='1';card.dataset.eventId=id;
    const actions=card.querySelector('.vccf-event-actions');
    if(actions&&photoEventIds.has(String(id))){const b=document.createElement('button');b.type='button';b.className='cms-small vccf-event-gallery-action';b.textContent='Gallery';b.onclick=e=>{e.stopPropagation();openEventGallery(id)};actions.appendChild(b)}
    const body=card.querySelector('.vccf-event-body');if(body){const state=document.createElement('div');state.className='vccf-event-flow-state';state.innerHTML=photoEventIds.has(String(id))?'<span>✓ Attendance ready</span><span>✓ Gallery linked</span>':'<span>Attendance ready</span><span>Add photos from Attendance to create the Gallery album</span>';body.appendChild(state)}
  });
}

async function enhanceAttendanceCards(){
  const gallery=document.querySelector('.event-attendance-gallery');if(!gallery)return;
  await refreshPhotoEventIds();
  gallery.querySelectorAll('.event-attendance-card').forEach(card=>{
    if(card.dataset.workflowEnhanced==='1')return;
    const open=card.querySelector('[data-gallery-open]'),id=open?.dataset.galleryOpen;if(!id)return;
    card.dataset.workflowEnhanced='1';
    const actions=card.querySelector('.event-attendance-card-actions');if(!actions)return;
    if(photoEventIds.has(String(id))){const b=document.createElement('button');b.type='button';b.className='cms-small vccf-event-gallery-action';b.textContent='Open gallery';b.onclick=e=>{e.stopPropagation();openEventGallery(id)};actions.appendChild(b)}
    else{const note=document.createElement('span');note.className='vccf-event-photo-hint';note.textContent='Upload event photos here to create its Gallery album automatically.';card.querySelector('.event-attendance-card-copy')?.appendChild(note)}
  });
}

function phTodayParts(){const parts={};new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')parts[x.type]=x.value});return{year:Number(parts.year),month:Number(parts.month),day:Number(parts.day)}}
function sundayCountToDay(year,month,day){let n=0;for(let d=1;d<=day;d++)if(new Date(Date.UTC(year,month-1,d)).getUTCDay()===0)n++;return n}
async function enhanceMember360Monthly(){
  const grid=document.querySelector('#members .m360-summary-grid');if(!grid||!lastMemberId)return;
  const attendance=[...grid.querySelectorAll('.m360-summary')].find(x=>x.querySelector('h3')?.textContent?.trim()==='Attendance');if(!attendance)return;
  const now=phTodayParts(),key=`${lastMemberId}:${now.year}-${String(now.month).padStart(2,'0')}`;if(attendance.dataset.monthPerformance===key)return;attendance.dataset.monthPerformance=key;
  const mm=String(now.month).padStart(2,'0'),nextMonth=now.month===12?1:now.month+1,nextYear=now.month===12?now.year+1:now.year,start=`${now.year}-${mm}-01T00:00:00+08:00`,end=`${nextYear}-${String(nextMonth).padStart(2,'0')}-01T00:00:00+08:00`;
  try{const {data,error}=await db().from('attendance').select('checked_in_at,attendance_type').eq('member_id',lastMemberId).gte('checked_in_at',start).lt('checked_in_at',end).order('checked_in_at');if(error)throw error;const present=new Set((data||[]).filter(x=>(x.attendance_type||'sunday')==='sunday').map(x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x.checked_in_at)))).size,elapsed=sundayCountToDay(now.year,now.month,now.day),rate=elapsed?Math.round(present/elapsed*100):0,monthName=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'long'}).format(new Date(Date.UTC(now.year,now.month-1,1)));attendance.innerHTML=`<h3>Sunday Attendance · ${esc(monthName)}</h3><strong>${present} / ${elapsed} present</strong><div class="hint">${elapsed?rate+'% of Sundays so far this month':'No Sunday has occurred yet this month.'}</div>`}catch(e){attendance.dataset.monthPerformance='';console.warn('Member 360 monthly attendance:',e)}
}

async function loadCurrentMemberEvents(){
  const tab=document.querySelector('.m360-tabs [data-m360="events"]');const body=document.getElementById('m360body');if(!tab||!body||!lastMemberId)return;
  body.innerHTML='<div class="empty">Loading event participation…</div>';
  try{
    const {data,error}=await db().from('church_event_registrations').select('status,checked_in_at,event_id,church_events(title,start_at,status)').eq('member_id',lastMemberId).order('registered_at',{ascending:false}).limit(50);
    if(error)throw error;
    const rows=data||[];
    body.innerHTML=rows.length?`<div class="m360-list">${rows.map(x=>`<div class="m360-row"><span><b>${esc(x.church_events?.title||'Church event')}</b><small>${x.church_events?.start_at?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(x.church_events.start_at)):''}</small></span><b>${esc(x.checked_in_at?'Attended':x.status||'Registered')}</b></div>`).join('')}</div>`:'<div class="empty">No event participation recorded.</div>';
  }catch(e){body.innerHTML='<div class="empty">Event participation is temporarily unavailable.</div>';console.warn('Member 360 events:',e)}
}

function rememberMember(e){
  const target=e.target.closest?.('[data-view-member],[data-member-id]');
  if(target){const id=target.dataset.viewMember||target.dataset.memberId;if(id)beginFastMemberPreview(id)}
  if(e.target.closest?.('[data-route="members"],#m360back,.m360-fast-back'))fastPreviewActive=false;
}
document.addEventListener('click',e=>{rememberMember(e);if(e.target.closest?.('.m360-tabs [data-m360="events"]'))setTimeout(()=>void loadCurrentMemberEvents(),30)},true);

let queued=false;function enhance(){if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;if(fastPreviewActive)renderFastMemberPreview();workflowBanner();await Promise.all([enhanceEventCards(),enhanceAttendanceCards(),enhanceMember360Monthly()])})}
new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',enhance);
window.addEventListener('vccf-event-photos-updated',async()=>{await refreshPhotoEventIds(true);enhance()});
window.addEventListener('vccf-signed-out',()=>{lastMemberId=null;fastPreviewActive=false;photoEventIds.clear();photoLoadAt=0});

loadPack().then(()=>setTimeout(enhance,250));
})();
