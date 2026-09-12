(()=>{
'use strict';
if(window.__VCCF_MUSIC_MINISTRY_MEMBER_READONLY__)return;
window.__VCCF_MUSIC_MINISTRY_MEMBER_READONLY__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'').toLowerCase();
const linkedMember=()=>Boolean(state().profile?.member_id)&&role()!=='guest';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datePH=v=>v?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(v+'T12:00:00+08:00')):'—';
let schedules=[];
let loaded=false;
let loading=false;

function addStyle(){
  if($('#vccfMusicReadonlyCss'))return;
  const s=document.createElement('style');
  s.id='vccfMusicReadonlyCss';
  s.textContent=`
  .mmro-wrap{display:grid;gap:14px}.mmro-hero,.mmro-card{padding:18px 20px}.mmro-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.mmro-hero h2,.mmro-card h3{margin:0 0 6px}.mmro-muted{color:var(--muted);font-size:.82rem;line-height:1.5}.mmro-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,var(--brand) 10%,transparent);color:var(--brand);font-size:.7rem;font-weight:900;white-space:nowrap}.mmro-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mmro-list{display:grid;gap:10px}.mmro-service{border:1px solid var(--line);border-radius:14px;padding:13px;background:var(--card)}.mmro-service-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}.mmro-date{font-weight:900}.mmro-role{display:grid;grid-template-columns:minmax(120px,.7fr) 1fr;gap:9px;padding:7px 0;border-top:1px solid var(--line);font-size:.82rem}.mmro-role:first-child{border-top:0}.mmro-role b{font-size:.75rem;color:var(--muted)}.mmro-song{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--line);font-size:.82rem}.mmro-song:first-child{border-top:0}.mmro-num{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--brand) 10%,transparent);color:var(--brand);font-weight:900;font-size:.72rem}.mmro-empty{padding:18px;text-align:center;color:var(--muted);font-size:.84rem}.mmro-link{color:var(--brand);font-weight:800;text-decoration:none}.mmro-link:hover{text-decoration:underline}.mmro-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:.7rem;font-weight:850;background:var(--card-soft,var(--bg));border:1px solid var(--line)}
  #musicMinistryReadonlyNavGroup .nav-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  @media(max-width:760px){.mmro-grid{grid-template-columns:1fr}.mmro-hero{display:block}.mmro-badge{margin-top:10px}.mmro-role{grid-template-columns:1fr}.mmro-song{grid-template-columns:28px minmax(0,1fr)}.mmro-song>:last-child{grid-column:2}}
  `;
  document.head.appendChild(s);
}

function renameExisting(){
  const group=$('#worshipNavGroup');
  if(!group)return false;
  const label=$('.nav-group-toggle .nav-label',group);
  const toggle=$('.nav-group-toggle',group);
  if(label&&label.textContent!=='Music Ministry')label.textContent='Music Ministry';
  if(toggle&&toggle.title!=='Music Ministry')toggle.title='Music Ministry';
  $('#musicMinistryReadonlyNavGroup')?.remove();
  return true;
}

function ensureView(){
  let view=$('#musicMinistryReadonlyView');
  if(view)return view;
  const main=$('.main');if(!main)return null;
  view=document.createElement('section');
  view.id='musicMinistryReadonlyView';
  view.className='view';
  view.innerHTML='<div class="card" style="padding:20px">Loading Music Ministry…</div>';
  main.appendChild(view);
  return view;
}

function ensureNav(){
  if(renameExisting()||!linkedMember())return;
  const nav=$('.sidebar .nav');
  if(!nav||$('#musicMinistryReadonlyNavGroup'))return;
  const group=document.createElement('div');
  group.id='musicMinistryReadonlyNavGroup';
  group.className='nav-group';
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
  const chev='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  group.innerHTML='<button class="nav-group-toggle" type="button" aria-expanded="false" title="Music Ministry"><span class="nav-icon">'+icon+'</span><span class="nav-label">Music Ministry</span><span class="nav-chevron">'+chev+'</span></button><div class="nav-children"><div class="nav-children-inner"><button class="nav-item nav-child" type="button" data-mmro-view="schedule"><span class="nav-label">Schedule of Ministers</span></button><button class="nav-item nav-child" type="button" data-mmro-view="lineup"><span class="nav-label">Worship Line-Up</span></button></div></div>';
  const more=$$('.nav-section-label',nav).find(x=>String(x.textContent||'').trim().toLowerCase()==='more');
  if(more)nav.insertBefore(group,more);else nav.appendChild(group);
  const toggle=$('.nav-group-toggle',group);
  toggle.onclick=()=>{const open=group.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));};
  $$('[data-mmro-view]',group).forEach(b=>b.onclick=()=>openView(b.dataset.mmroView));
}

async function loadData(force=false){
  if(loaded&&!force)return schedules;
  if(loading)return schedules;
  const client=sb();if(!client)throw new Error('Music Ministry service is unavailable.');
  loading=true;
  try{
    const {data,error}=await client.rpc('get_music_ministry_readonly');
    if(error)throw error;
    schedules=Array.isArray(data)?data:[];
    loaded=true;
    return schedules;
  }finally{loading=false;}
}

function assignmentsHtml(s){
  const rows=Array.isArray(s.assignments)?s.assignments:[];
  return rows.length?rows.map(a=>'<div class="mmro-role"><b>'+esc(a.ministry_role||'Ministry')+'</b><span>'+esc(a.member_name||'Member')+(a.notes?'<small class="mmro-muted" style="display:block">'+esc(a.notes)+'</small>':'')+'</span></div>').join(''):'<div class="mmro-empty" style="padding:8px 0">No ministers assigned yet.</div>';
}

function scheduleCard(s){
  return '<div class="mmro-service"><div class="mmro-service-head"><div><div class="mmro-date">'+esc(datePH(s.service_date))+'</div><div class="mmro-muted">'+esc(s.service_name||'Sunday Worship Service')+'</div></div><span class="mmro-status">Read only</span></div>'+(s.notes?'<div class="mmro-muted" style="margin-bottom:8px">'+esc(s.notes)+'</div>':'')+assignmentsHtml(s)+'</div>';
}

function songHtml(song){
  const ref=song.reference_url?'<a class="mmro-link" href="'+esc(song.reference_url)+'" target="_blank" rel="noopener noreferrer">Reference</a>':'';
  return '<div class="mmro-song"><span class="mmro-num">'+esc(song.position||'')+'</span><span><b>'+esc(song.title||'Song')+'</b>'+(song.artist?'<small class="mmro-muted" style="display:block">'+esc(song.artist)+'</small>':'')+(song.notes?'<small class="mmro-muted" style="display:block">'+esc(song.notes)+'</small>':'')+'</span><span class="mmro-muted">'+esc(song.song_key||'')+(ref?(song.song_key?' · ':'')+ref:'')+'</span></div>';
}

function lineupCard(s){
  const l=s.lineup;
  if(!l)return '<div class="mmro-service"><div class="mmro-service-head"><div><div class="mmro-date">'+esc(datePH(s.service_date))+'</div><div class="mmro-muted">'+esc(s.service_name||'Sunday Worship Service')+'</div></div><span class="mmro-status">No line-up</span></div><div class="mmro-empty" style="padding:8px 0">No worship line-up has been posted for this service.</div></div>';
  const songs=Array.isArray(l.songs)?l.songs:[];
  const offertory=l.offertory_title?'<div class="mmro-song"><span class="mmro-num">₱</span><span><b>'+esc(l.offertory_title)+'</b><small class="mmro-muted" style="display:block">Offertory'+(l.offertory_artist?' · '+esc(l.offertory_artist):'')+'</small>'+(l.offertory_notes?'<small class="mmro-muted" style="display:block">'+esc(l.offertory_notes)+'</small>':'')+'</span><span class="mmro-muted">'+esc(l.offertory_key||'')+(l.offertory_reference_url?' · <a class="mmro-link" href="'+esc(l.offertory_reference_url)+'" target="_blank" rel="noopener noreferrer">Reference</a>':'')+'</span></div>':'';
  return '<div class="mmro-service"><div class="mmro-service-head"><div><div class="mmro-date">'+esc(datePH(s.service_date))+'</div><div class="mmro-muted">'+esc(s.service_name||'Sunday Worship Service')+'</div></div><span class="mmro-status">'+esc(l.status||'Draft')+'</span></div>'+songs.map(songHtml).join('')+offertory+(l.revision_note?'<div class="mmro-muted" style="margin-top:9px"><b>Revision note:</b> '+esc(l.revision_note)+'</div>':'')+'</div>';
}

function render(mode){
  const view=ensureView();if(!view)return;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sorted=schedules.slice().sort((a,b)=>String(a.service_date).localeCompare(String(b.service_date)));
  const upcoming=sorted.filter(s=>String(s.service_date)>=today);
  const recent=sorted.filter(s=>String(s.service_date)<today).slice(-8).reverse();
  const card=mode==='lineup'?lineupCard:scheduleCard;
  const heading=mode==='lineup'?'Worship Line-Up':'Schedule of Ministers';
  view.innerHTML='<div class="mmro-wrap"><section class="card mmro-hero"><div><h2>'+heading+'</h2><div class="mmro-muted">Music Ministry information is available to church members in read-only mode. Editing remains limited to authorized ministry leaders and assigned Worship Leaders.</div></div><span class="mmro-badge">Member · Read only</span></section><div class="mmro-grid"><section class="card mmro-card"><h3>Upcoming Services</h3><div class="mmro-list">'+(upcoming.map(card).join('')||'<div class="mmro-empty">No upcoming Music Ministry schedule yet.</div>')+'</div></section><section class="card mmro-card"><h3>Recent Services</h3><div class="mmro-list">'+(recent.map(card).join('')||'<div class="mmro-empty">No recent Music Ministry records yet.</div>')+'</div></section></div></div>';
}

async function openView(mode){
  if(!linkedMember())return;
  $$('.main .view').forEach(v=>v.classList.remove('active'));
  const view=ensureView();view?.classList.add('active');
  $$('.sidebar .nav-item,.sidebar [data-route],.sidebar .nav-group-toggle').forEach(x=>x.classList.remove('active'));
  const group=$('#musicMinistryReadonlyNavGroup');
  group?.classList.add('open');
  const toggle=$('.nav-group-toggle',group);toggle?.classList.add('active');toggle?.setAttribute('aria-expanded','true');
  $$('[data-mmro-view]',group).forEach(x=>x.classList.toggle('active',x.dataset.mmroView===mode));
  const title=$('#title'),hint=$('.top .hint');
  if(title)title.textContent=mode==='lineup'?'Worship Line-Up':'Schedule of Ministers';
  if(hint)hint.textContent='Music Ministry · Member read-only access';
  $('.sidebar')?.classList.remove('open');$('#mobileShade')?.classList.remove('open');
  if(view)view.innerHTML='<div class="card" style="padding:20px">Loading Music Ministry…</div>';
  try{await loadData();render(mode)}catch(e){if(view)view.innerHTML='<div class="card" style="padding:20px;color:#b42318"><b>Unable to load Music Ministry.</b><div style="margin-top:6px">'+esc(e?.message||e)+'</div></div>';}
  window.scrollTo({top:0,behavior:'smooth'});
}

function boot(){
  addStyle();
  if(renameExisting())return;
  if(!linkedMember())return;
  ensureView();ensureNav();
}

window.addEventListener('vccf-app-ready',()=>setTimeout(boot,650));
window.addEventListener('vccf-profile-updated',()=>setTimeout(boot,500));
setTimeout(boot,1200);
})();