(()=>{
'use strict';
if(window.__VCCF_UX_5_9_11__)return;
window.__VCCF_UX_5_9_11__=true;

const S=()=>window.VCCF?.getState?.()||{};
const db=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lastMemberId=null;
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
  loadStyle('/vccf-ux-5-9-11.css?v=20260915-1','vccfUxPack');
  return loadScript('/vccf-member-360.js?v=20260915-1','vccfUxMember360')
    .then(()=>loadScript('/vccf-events-gallery.js?v=20260915-1','vccfUxEventsGallery'))
    .then(()=>loadScript('/vccf-event-attendance-gallery.js?v=20260915-1','vccfUxEventAttendanceGallery'));
}

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

function rememberMember(e){const target=e.target.closest?.('[data-view-member],[data-member-id]');if(target)lastMemberId=target.dataset.viewMember||target.dataset.memberId||lastMemberId}
document.addEventListener('click',e=>{rememberMember(e);if(e.target.closest?.('.m360-tabs [data-m360="events"]'))setTimeout(()=>void loadCurrentMemberEvents(),30)},true);

let queued=false;function enhance(){if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;workflowBanner();await Promise.all([enhanceEventCards(),enhanceAttendanceCards()])})}
new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',enhance);
window.addEventListener('vccf-event-photos-updated',async()=>{await refreshPhotoEventIds(true);enhance()});
window.addEventListener('vccf-signed-out',()=>{lastMemberId=null;photoEventIds.clear();photoLoadAt=0});

loadPack().then(()=>setTimeout(enhance,250));
})();
