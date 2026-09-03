(() => {
'use strict';
if(window.__VCCF_SUNDAY_SUMMARY__)return;
window.__VCCF_SUNDAY_SUMMARY__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canFinance=()=>['admin','pastor'].includes(role());
const canPost=canFinance;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const dateLabel=v=>new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00'));
let currentSummary=null;
let currentPhotos=[];
let liveStats={attendance:0,base:0,rate:0,tithe:0,offering:0};
let pendingFiles=[];

function latestSunday(){
  const d=new Date(phDay(new Date())+'T12:00:00+08:00');
  d.setDate(d.getDate()-d.getDay());
  return phDay(d);
}
function isSunday(day){return new Date(day+'T12:00:00+08:00').getDay()===0}
function bounds(day){const start=new Date(day+'T00:00:00+08:00');return {start:start.toISOString(),end:new Date(start.getTime()+86400000).toISOString()}}
function activeBase(){return (state().members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive').length}
function statusText(status){return ({not_prepared:'Not prepared',draft:'Draft',submitted:'Submitted for posting',posted:'Posted on dashboard'})[status]||'Draft'}
function statusClass(status){return status==='posted'?'posted':status==='submitted'?'submitted':status==='not_prepared'?'not-prepared':'draft'}
function setMsg(message,kind=''){
  const el=document.getElementById('sundaySummaryMessage');if(!el)return;
  el.className='sunday-summary-message '+kind;el.textContent=message||'';
}
function getForm(){
  return {
    notes:String(document.getElementById('sundaySummaryNotes')?.value||'').trim(),
    tithe:canFinance()?Number(document.getElementById('sundaySummaryTithe')?.value||0):Number(currentSummary?.tithe_total||0),
    offering:canFinance()?Number(document.getElementById('sundaySummaryOffering')?.value||0):Number(currentSummary?.offering_total||0)
  };
}
function photoCard(photo,locked){
  return '<article class="summary-photo-thumb"><img src="'+esc(photo.image_url||'')+'" alt="'+esc(photo.caption||'Sunday summary photo')+'"><div><span>'+esc(photo.caption||'Sunday Worship')+'</span>'+(!locked?'<button type="button" data-remove-summary-photo="'+esc(photo.id)+'">Remove</button>':'')+'</div></article>';
}
function pendingCard(item,index){
  return '<article class="summary-photo-thumb pending"><img src="'+esc(item.preview)+'" alt="Photo preview"><div><span>'+esc(item.file.name)+'</span><button type="button" data-remove-pending-photo="'+index+'">Remove</button></div></article>';
}
function renderPhotos(){
  const host=document.getElementById('sundaySummaryPhotos');if(!host)return;
  const locked=currentSummary?.workflow_status==='posted';
  const html=[...currentPhotos.map(p=>photoCard(p,locked)),...pendingFiles.map((p,i)=>pendingCard(p,i))].join('');
  host.innerHTML=html||'<div class="summary-photo-placeholder"><b>No photos added yet.</b><span>Photos added here become the dashboard carousel after this summary is posted.</span></div>';
  host.querySelectorAll('[data-remove-pending-photo]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.removePendingPhoto);URL.revokeObjectURL(pendingFiles[i]?.preview||'');pendingFiles.splice(i,1);renderPhotos()});
  host.querySelectorAll('[data-remove-summary-photo]').forEach(b=>b.onclick=()=>removeExistingPhoto(b.dataset.removeSummaryPhoto));
}

function recentSundayDays(count=12){
  const days=[],start=new Date(latestSunday()+'T12:00:00+08:00');
  for(let i=0;i<count;i++){const d=new Date(start);d.setDate(start.getDate()-(i*7));days.push(phDay(d))}
  return days;
}
function shortDate(v){return new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'}).format(new Date(v+'T12:00:00+08:00'))}
function summaryGalleryCard(item){
  const s=item.summary,status=s?.workflow_status||'not_prepared',cover=item.cover?.image_url||'',attendance=s?.workflow_status==='posted'?Number(s.attendance_count||0):item.attendance,base=s?.workflow_status==='posted'?Number(s.member_base_count||item.base):item.base,rate=s?.workflow_status==='posted'?Number(s.attendance_rate||0):(base?Math.round(attendance/base*100):0);
  const action=status==='submitted'&&canPost()?'Review & Post':status==='posted'?'View Posted Summary':status==='draft'?'Continue Summary':'Prepare Summary';
  return '<article class="summary-gallery-card card" data-summary-card="'+esc(item.day)+'">'+
    '<div class="summary-gallery-cover '+(cover?'has-photo':'')+'">'+(cover?'<img src="'+esc(cover)+'" alt="'+esc(item.cover.caption||'Sunday summary photo')+'" loading="lazy">':'<div class="summary-gallery-placeholder"><span>VCCF</span><b>'+esc(shortDate(item.day))+'</b></div>')+'<span class="summary-gallery-status '+statusClass(status)+'">'+esc(statusText(status))+'</span></div>'+
    '<div class="summary-gallery-copy"><span class="summary-gallery-date">'+esc(dateLabel(item.day))+'</span><h3>Sunday Worship</h3><div class="summary-gallery-metrics"><div><b>'+attendance+'</b><span>Attendance</span></div><div><b>'+Math.round(rate)+'%</b><span>Rate</span></div><div><b>'+item.photoCount+'</b><span>Photos</span></div></div><button type="button" class="summary-gallery-open" data-open-summary="'+esc(item.day)+'">'+esc(action)+' →</button></div>'+
  '</article>';
}
async function renderGallery(){
  const root=document.getElementById('sundaySummaryWorkspace');if(!root)return;
  pendingFiles.forEach(x=>URL.revokeObjectURL(x.preview));pendingFiles=[];currentSummary=null;currentPhotos=[];
  root.innerHTML='<section class="summary-gallery-shell"><div class="summary-gallery-hero card"><div><span class="sunday-summary-kicker">SUNDAY ATTENDANCE SUMMARIES</span><h2>Summary Gallery</h2><p>Choose a Sunday first, then review the full summary before submitting or posting it.</p></div><div class="summary-gallery-picker"><label>Open another Sunday<input id="summaryGalleryDate" type="date" value="'+esc(latestSunday())+'"></label><button id="openSummaryDate" class="btn secondary" type="button">Open</button></div></div><div class="summary-gallery-loading card">Loading recent Sunday summaries…</div></section>';
  const days=recentSundayDays(12),earliest=days[days.length-1],latest=days[0],rangeStart=bounds(earliest).start,rangeEnd=bounds(latest).end,client=sb();
  const [sumRes,attRes]=await Promise.all([
    client.from('cms_sunday_event_summaries').select('*').eq('summary_type','sunday').gte('summary_date',earliest).lte('summary_date',latest).order('summary_date',{ascending:false}),
    client.from('attendance').select('member_id,checked_in_at').gte('checked_in_at',rangeStart).lt('checked_in_at',rangeEnd)
  ]);
  if(sumRes.error||attRes.error){
    const error=sumRes.error||attRes.error;root.innerHTML='<section class="summary-gallery-shell"><div class="notice">'+esc(error.message||'Unable to load Sunday summaries.')+'</div></section>';return;
  }
  const summaries=sumRes.data||[],summaryByDay=new Map(summaries.map(s=>[s.summary_date,s])),attendanceByDay=new Map();
  (attRes.data||[]).forEach(row=>{const day=phDay(row.checked_in_at);if(!attendanceByDay.has(day))attendanceByDay.set(day,new Set());attendanceByDay.get(day).add(row.member_id)});
  const summaryIds=summaries.map(s=>s.id),photosBySummary=new Map();
  if(summaryIds.length){
    const photoRes=await client.from('cms_summary_photos').select('id,summary_id,image_url,caption,sort_order').in('summary_id',summaryIds).order('sort_order');
    if(!photoRes.error)(photoRes.data||[]).forEach(photo=>{if(!photosBySummary.has(photo.summary_id))photosBySummary.set(photo.summary_id,[]);photosBySummary.get(photo.summary_id).push(photo)});
  }
  const base=activeBase(),items=days.map(day=>{const summary=summaryByDay.get(day)||null,photos=summary?photosBySummary.get(summary.id)||[]:[];return {day,summary,cover:photos[0]||null,photoCount:photos.length,attendance:attendanceByDay.get(day)?.size||0,base}});
  const counts={draft:0,submitted:0,posted:0,not_prepared:0};items.forEach(item=>counts[item.summary?.workflow_status||'not_prepared']=(counts[item.summary?.workflow_status||'not_prepared']||0)+1);
  root.innerHTML='<section class="summary-gallery-shell"><div class="summary-gallery-hero card"><div><span class="sunday-summary-kicker">SUNDAY ATTENDANCE SUMMARIES</span><h2>Summary Gallery</h2><p>Choose a Sunday first, then review the full summary before submitting or posting it.</p></div><div class="summary-gallery-picker"><label>Open another Sunday<input id="summaryGalleryDate" type="date" value="'+esc(latestSunday())+'"></label><button id="openSummaryDate" class="btn secondary" type="button">Open</button></div></div>'+
    '<div class="summary-gallery-status-row"><span><i class="draft"></i>'+counts.draft+' Draft</span><span><i class="submitted"></i>'+counts.submitted+' Submitted</span><span><i class="posted"></i>'+counts.posted+' Posted</span><span><i class="not-prepared"></i>'+counts.not_prepared+' Not prepared</span></div>'+
    '<div class="summary-gallery-grid">'+items.map(summaryGalleryCard).join('')+'</div></section>';
  const picker=document.getElementById('summaryGalleryDate'),open=()=>{const day=picker?.value||latestSunday();if(!isSunday(day)){alert('Please choose a Sunday.');return}load(day)};
  document.getElementById('openSummaryDate').onclick=open;
  picker.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open()}};
  root.querySelectorAll('[data-open-summary]').forEach(button=>button.onclick=()=>load(button.dataset.openSummary));
}

async function load(day){
  const root=document.getElementById('sundaySummaryWorkspace');if(!root)return;
  pendingFiles.forEach(x=>URL.revokeObjectURL(x.preview));pendingFiles=[];
  if(!isSunday(day)){
    root.innerHTML='<div class="summary-detail-toolbar"><button id="backToSummaryGallery" class="back-button" type="button">← Summary gallery</button></div><section class="sunday-summary-card card"><div class="sunday-summary-head"><div><span class="sunday-summary-kicker">SUNDAY SUMMARY</span><h2>Sunday Attendance Summary</h2><p>Select a Sunday to prepare its summary.</p></div><label class="summary-date-control">Sunday date<input id="sundaySummaryDate" type="date" value="'+esc(day)+'"></label></div><div class="notice">The selected date is not a Sunday. Choose a Sunday to create or review a summary.</div></section>';
    document.getElementById('backToSummaryGallery').onclick=renderGallery;
    document.getElementById('backToSummaryGallery')?.addEventListener('click',renderGallery);
  document.getElementById('sundaySummaryDate').onchange=e=>load(e.currentTarget.value);
    return;
  }
  root.innerHTML='<section class="sunday-summary-card card"><div class="sunday-summary-loading">Loading Sunday summary…</div></section>';
  const b=bounds(day),client=sb();
  const reqs=[
    client.from('attendance').select('member_id').gte('checked_in_at',b.start).lt('checked_in_at',b.end),
    client.from('cms_sunday_event_summaries').select('*').eq('summary_type','sunday').eq('summary_date',day).maybeSingle()
  ];
  if(canFinance())reqs.push(client.from('giving_records').select('giving_type,amount').eq('given_on',day));
  else reqs.push(Promise.resolve({data:[],error:null}));
  const [attRes,sumRes,giveRes]=await Promise.all(reqs);
  if(attRes.error||sumRes.error){
    const e=attRes.error||sumRes.error;root.innerHTML='<section class="sunday-summary-card card"><div class="notice">'+esc(e.message||'Unable to load Sunday summary.')+'</div></section>';return;
  }
  currentSummary=sumRes.data||null;
  const attendance=new Set((attRes.data||[]).map(a=>a.member_id)).size,base=activeBase(),rate=base?Math.round(attendance/base*100):0;
  const giving=giveRes.data||[],sumType=t=>giving.filter(g=>String(g.giving_type||'').toLowerCase()===t).reduce((n,g)=>n+Number(g.amount||0),0);
  liveStats={attendance,base,rate,tithe:sumType('tithe'),offering:sumType('offering')};
  currentPhotos=[];
  if(currentSummary){
    const photos=await client.from('cms_summary_photos').select('id,summary_id,image_url,caption,sort_order,storage_path,uploaded_by').eq('summary_id',currentSummary.id).order('sort_order');
    if(!photos.error)currentPhotos=photos.data||[];
  }
  render(day);
}
function metric(label,value,sub){return '<div class="summary-editor-metric"><span>'+esc(label)+'</span><strong>'+value+'</strong><small>'+esc(sub||'')+'</small></div>'}
function render(day){
  const root=document.getElementById('sundaySummaryWorkspace');if(!root)return;
  const status=currentSummary?.workflow_status||'draft',posted=status==='posted',submitted=status==='submitted',finance=canFinance();
  const tithe=currentSummary?Number(currentSummary.tithe_total||0):liveStats.tithe;
  const offering=currentSummary?Number(currentSummary.offering_total||0):liveStats.offering;
  const notes=currentSummary?.notes||'';
  const savedAttendance=currentSummary?.attendance_count;
  const savedRate=currentSummary?.attendance_rate;
  const attendance=posted?Number(savedAttendance??liveStats.attendance):liveStats.attendance;
  const rate=posted?Number(savedRate??liveStats.rate):liveStats.rate;
  root.innerHTML='<div class="summary-detail-toolbar"><button id="backToSummaryGallery" class="back-button" type="button">← Summary gallery</button><span>Open a summary to review complete details before posting.</span></div><section class="sunday-summary-card card"><div class="sunday-summary-head"><div><span class="sunday-summary-kicker">SUNDAY SUMMARY</span><h2>Sunday Attendance Summary</h2><p>This is the same summary used by the dashboard after it is posted.</p></div><div class="summary-head-actions"><span class="summary-workflow-pill '+statusClass(status)+'">'+esc(statusText(status))+'</span><label class="summary-date-control">Sunday date<input id="sundaySummaryDate" type="date" value="'+esc(day)+'"></label></div></div><div class="summary-workflow-line"><span class="'+(status==='draft'?'active':'done')+'">1 Draft</span><i></i><span class="'+(submitted?'active':posted?'done':'')+'">2 Submitted</span><i></i><span class="'+(posted?'active':'')+'">3 Posted</span></div><div class="summary-editor-metrics">'+metric('Attendance',String(attendance),posted?'Posted count':'Live Sunday count')+metric('Member base',String(posted?Number(currentSummary?.member_base_count||liveStats.base):liveStats.base),'Active members in your scope')+metric('Attendance rate',Math.round(rate)+'%','Sunday participation')+(finance?metric('Live tithes',php(liveStats.tithe),'Recorded for this Sunday'):metric('Giving','Restricted','Pastor / Admin only'))+'</div><div class="summary-editor-grid"><div class="summary-editor-fields"><label>Summary notes<textarea id="sundaySummaryNotes" rows="5" placeholder="Sunday highlights, observations, or notes…" '+(posted?'disabled':'')+'>'+esc(notes)+'</textarea></label>'+(finance?'<div class="summary-money-grid"><label>Tithes<input id="sundaySummaryTithe" type="number" min="0" step="0.01" value="'+esc(tithe)+'" '+(posted?'disabled':'')+'></label><label>Offerings<input id="sundaySummaryOffering" type="number" min="0" step="0.01" value="'+esc(offering)+'" '+(posted?'disabled':'')+'></label></div>':'<div class="summary-finance-restricted">Tithes and offerings are completed during Pastor/Admin review.</div>')+'</div><div class="summary-photo-editor"><div class="summary-photo-editor-head"><div><b>Summary photos</b><span>These exact photos will be featured in the dashboard carousel after posting.</span></div>'+(posted?'':'<label class="summary-add-photo">+ Add photos<input id="sundaySummaryPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>')+'</div><div id="sundaySummaryPhotos" class="summary-photo-grid"></div></div></div><div class="summary-submit-bar"><div><b>'+esc(statusText(status))+'</b><span>'+(posted?'This Sunday summary is live on the dashboard.':submitted?(canPost()?'Review the summary, then post it to the dashboard.':'Waiting for Pastor/Admin to post this summary.'):'Save changes or submit when the Sunday summary is ready.')+'</span></div><div class="summary-submit-actions">'+(!posted?'<button id="saveSundaySummary" class="btn secondary" type="button">'+(submitted?'Save changes':'Save draft')+'</button>':'')+(!posted&&!submitted?'<button id="submitSundaySummary" class="btn" type="button">Submit summary</button>':'')+(submitted&&canPost()?'<button id="postSundaySummary" class="btn" type="button">Post to dashboard</button>':'')+'</div></div><div id="sundaySummaryMessage" class="sunday-summary-message"></div></section>';
  document.getElementById('sundaySummaryDate').onchange=e=>load(e.currentTarget.value);
  const input=document.getElementById('sundaySummaryPhotoInput');
  if(input)input.onchange=()=>{const files=Array.from(input.files||[]).filter(f=>f.type.startsWith('image/')).slice(0,12-currentPhotos.length-pendingFiles.length);files.forEach(file=>pendingFiles.push({file,preview:URL.createObjectURL(file)}));input.value='';renderPhotos()};
  document.getElementById('saveSundaySummary')?.addEventListener('click',e=>save('save',e.currentTarget,day));
  document.getElementById('submitSundaySummary')?.addEventListener('click',e=>save('submit',e.currentTarget,day));
  document.getElementById('postSundaySummary')?.addEventListener('click',e=>save('post',e.currentTarget,day));
  renderPhotos();
}
async function ensureSummary(day){
  if(currentSummary)return currentSummary;
  const form=getForm(),values={summary_type:'sunday',title:'Sunday Worship',summary_date:day,attendance_count:liveStats.attendance,member_base_count:liveStats.base,attendance_rate:liveStats.rate,tithe_total:canFinance()?form.tithe:0,offering_total:canFinance()?form.offering:0,notes:form.notes||null,created_by:state().session?.user?.id||null,workflow_status:'draft'};
  const result=await sb().from('cms_sunday_event_summaries').insert(values).select('*').single();
  if(result.error)throw result.error;currentSummary=result.data;return result.data;
}
function prepareSummaryPhoto(file){
  return new Promise((resolve,reject)=>{
    if(!file?.type?.startsWith('image/'))return reject(new Error('Only image files can be added.'));
    if(file.size>12*1024*1024)return reject(new Error(file.name+' is larger than 12 MB.'));
    const reader=new FileReader();
    reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx)return reject(new Error('Could not prepare '+file.name));ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare '+file.name)),'image/jpeg',.86)};img.onerror=()=>reject(new Error('Could not read '+file.name));img.src=reader.result};reader.onerror=()=>reject(new Error('Could not read '+file.name));reader.readAsDataURL(file);
  });
}
async function uploadPending(day){
  if(!pendingFiles.length||!currentSummary)return;
  const batch=pendingFiles.slice(),startOrder=currentPhotos.length;
  for(let i=0;i<batch.length;i++){
    const item=batch[i],blob=await prepareSummaryPhoto(item.file);
    const token=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2))+'.jpg';
    const path='summary/'+currentSummary.id+'/'+Date.now()+'-'+token;
    const upload=await sb().storage.from('vccf-gallery').upload(path,blob,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
    if(upload.error)throw upload.error;
    const url=sb().storage.from('vccf-gallery').getPublicUrl(path).data.publicUrl;
    const row=await sb().from('cms_summary_photos').insert({summary_id:currentSummary.id,image_url:url,storage_path:path,caption:'Sunday Worship · '+dateLabel(day),sort_order:startOrder+i,uploaded_by:state().session?.user?.id||null}).select('*').single();
    if(row.error){await sb().storage.from('vccf-gallery').remove([path]);throw row.error}
    currentPhotos.push(row.data);
    URL.revokeObjectURL(item.preview);
  }
  pendingFiles=[];
}
async function save(action,button,day){
  const old=button.textContent;button.disabled=true;button.textContent=action==='post'?'Posting…':action==='submit'?'Submitting…':'Saving…';setMsg('');
  try{
    await ensureSummary(day);
    if(currentSummary.workflow_status==='posted')throw new Error('This summary is already posted.');
    const form=getForm(),updates={attendance_count:liveStats.attendance,member_base_count:liveStats.base,attendance_rate:liveStats.rate,notes:form.notes||null};
    if(canFinance()){updates.tithe_total=form.tithe;updates.offering_total=form.offering}
    const saved=await sb().from('cms_sunday_event_summaries').update(updates).eq('id',currentSummary.id).select('*').single();
    if(saved.error)throw saved.error;currentSummary=saved.data;
    await uploadPending(day);
    let success='Sunday summary saved.';
    if(action==='submit'){
      const submitted=await sb().from('cms_sunday_event_summaries').update({workflow_status:'submitted'}).eq('id',currentSummary.id).select('*').single();
      if(submitted.error)throw submitted.error;currentSummary=submitted.data;success='Sunday summary submitted. It is not on the dashboard yet.';
    }else if(action==='post'){
      if(currentSummary.workflow_status!=='submitted')throw new Error('Submit the Sunday summary before posting it.');
      const posted=await sb().from('cms_sunday_event_summaries').update({workflow_status:'posted'}).eq('id',currentSummary.id).select('*').single();
      if(posted.error)throw posted.error;currentSummary=posted.data;success='Sunday summary posted to the dashboard.';window.dispatchEvent(new CustomEvent('vccf-sunday-summary-posted',{detail:{summaryId:currentSummary.id,date:day}}));window.VCCFSundayDashboard?.refresh?.();
    }
    render(day);setMsg(success,'success');
  }catch(error){console.error('Sunday summary save',error);setMsg(error.message||'Unable to save the Sunday summary.','error')}
  finally{if(document.body.contains(button)){button.disabled=false;button.textContent=old}}
}
async function removeExistingPhoto(id){
  if(!currentSummary||currentSummary.workflow_status==='posted')return;
  const row=currentPhotos.find(p=>p.id===id);if(!row)return;
  if(!confirm('Remove this photo from the Sunday summary?'))return;
  const del=await sb().from('cms_summary_photos').delete().eq('id',id);if(del.error){setMsg(del.error.message,'error');return}
  if(row.storage_path)await sb().storage.from('vccf-gallery').remove([row.storage_path]);
  currentPhotos=currentPhotos.filter(p=>p.id!==id);renderPhotos();setMsg('Photo removed.','success');
}
function mount(){
  const root=document.getElementById('sundaySummaryWorkspace');if(!root)return;
  const leaders=['admin','pastor','area_leader'];
  if(!leaders.includes(role())){root.innerHTML='';return}
  renderGallery();
}
window.VCCFSundaySummary={mount,load,renderGallery};
window.addEventListener('vccf-app-ready',()=>setTimeout(mount,60));
})();