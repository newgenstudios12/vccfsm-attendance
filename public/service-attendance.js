(() => {
'use strict';
if(window.__VCCF_SERVICE_ATTENDANCE__)return;
window.__VCCF_SERVICE_ATTENDANCE__=true;

let root=null,scanner=null,scanBusy=false;
const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const areaName=id=>(state().areas||[]).find(a=>a.id===id)?.name||'Unassigned';
const initials=v=>String(v||'V').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const dateBounds=day=>({start:new Date(day+'T00:00:00+08:00').toISOString(),end:new Date(new Date(day+'T00:00:00+08:00').getTime()+86400000).toISOString()});
const serviceType=()=>document.getElementById('serviceAttendanceType')?.value||'bible_study';
const serviceLabel=type=>type==='midweek_service'?'Midweek Service':'Bible Study';
const activeMembers=()=>(state().members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive');

function setStatus(id,message,kind=''){const el=document.getElementById(id);if(!el)return;el.className='attendance-status '+kind;el.textContent=message||''}
function memberFromQr(raw){const code=String(raw||'').trim().replace(/^VCCF-MEMBER:/i,'');return activeMembers().find(m=>String(m.member_code||'')===code||String(m.id)===code)}

async function record(member,source,button,statusId){
  if(!member)return false;
  const type=serviceType(),today=phDay(new Date()),bounds=dateBounds(today),old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Saving…'}setStatus(statusId,'Checking '+serviceLabel(type)+' attendance…');
  try{
    const existing=await sb().from('attendance').select('id').eq('member_id',member.id).eq('attendance_type',type).gte('checked_in_at',bounds.start).lt('checked_in_at',bounds.end).limit(1);
    if(existing.error)throw existing.error;
    if(existing.data?.length){setStatus(statusId,memberName(member)+' is already checked in for '+serviceLabel(type)+' today.','warning');return false}
    const result=await sb().from('attendance').insert({member_id:member.id,area_id:member.area_id,checked_in_by:state().session?.user?.id||null,source,attendance_type:type,checked_in_at:new Date().toISOString()}).select('id,member_id,area_id,checked_in_at,checked_in_by,source,attendance_type').single();
    if(result.error)throw result.error;
    state().attendance=[result.data,...(state().attendance||[]).filter(a=>a.id!==result.data.id)];
    setStatus(statusId,'✓ '+serviceLabel(type)+' attendance recorded for '+memberName(member)+'.','success');
    if(document.getElementById('serviceAttendanceDate')?.value===today)await renderRecords();
    window.dispatchEvent(new CustomEvent('vccf-service-attendance-updated',{detail:{type,memberId:member.id}}));
    return true;
  }catch(error){setStatus(statusId,error.message||'Unable to record attendance.','error');return false}
  finally{if(button){button.disabled=false;button.textContent=old}}
}

async function startScanner(){
  if(!window.Html5Qrcode){setStatus('serviceScannerStatus','Scanner is still loading. Please try again.','error');return}
  if(scanner)return;
  const start=document.getElementById('startServiceAttendanceScan'),stop=document.getElementById('stopServiceAttendanceScan');
  start.disabled=true;setStatus('serviceScannerStatus','Requesting camera access…');
  scanner=new Html5Qrcode('serviceAttendanceReader');
  try{
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},async decoded=>{
      if(scanBusy)return;scanBusy=true;
      const member=memberFromQr(decoded);
      if(!member)setStatus('serviceScannerStatus','QR does not match an accessible member.','error');
      else await record(member,'qr',null,'serviceScannerStatus');
      setTimeout(()=>{scanBusy=false},1200);
    },()=>{});
    stop.disabled=false;setStatus('serviceScannerStatus','Camera is ready for '+serviceLabel(serviceType())+'.','success');
  }catch(error){scanner=null;start.disabled=false;setStatus('serviceScannerStatus','Camera permission or a camera device is required.','error')}
}

async function stopScanner(){
  if(scanner){try{await scanner.stop()}catch(error){}try{scanner.clear()}catch(error){}scanner=null}
  const start=document.getElementById('startServiceAttendanceScan'),stop=document.getElementById('stopServiceAttendanceScan'),reader=document.getElementById('serviceAttendanceReader');
  if(start)start.disabled=false;if(stop)stop.disabled=true;if(reader)reader.innerHTML='<div class="scanner-placeholder">Camera is off</div>';
}

async function renderRecords(){
  const box=document.getElementById('serviceAttendanceTable'),date=document.getElementById('serviceAttendanceDate');if(!box||!date)return;
  box.innerHTML='<div class="loading">Loading attendance…</div>';
  const day=date.value||phDay(new Date()),bounds=dateBounds(day),type=serviceType();
  const result=await sb().from('attendance').select('id,member_id,area_id,checked_in_at,checked_in_by,source,attendance_type').eq('attendance_type',type).gte('checked_in_at',bounds.start).lt('checked_in_at',bounds.end).order('checked_in_at',{ascending:false});
  if(result.error){box.innerHTML='<div class="notice">'+esc(result.error.message)+'</div>';return}
  const rows=result.data||[];
  box.innerHTML=rows.length?'<div class="table-wrap"><table class="table attendance-table"><thead><tr><th>Member</th><th>Area</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>'+rows.map(a=>{
    const m=activeMembers().find(x=>x.id===a.member_id),display=m?memberName(m):a.member_id,photo=m?.photo_url,avatar=photo?'<img class="attendance-avatar" src="'+esc(photo)+'" alt="">':'<span class="attendance-avatar fallback">'+esc(initials(display))+'</span>';
    return '<tr><td><div class="member-name">'+avatar+'<div><b>'+esc(display)+'</b><div class="hint">'+esc(m?.member_code||a.member_id)+'</div></div></div></td><td><span class="pill">'+esc(areaName(a.area_id))+'</span></td><td><span class="service-type-pill">'+esc(serviceLabel(a.attendance_type))+'</span></td><td>'+esc(phDay(a.checked_in_at))+'</td><td>'+esc(new Date(a.checked_in_at).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}))+'</td><td><span class="attendance-present">✓ Present</span></td></tr>';
  }).join('')+'</tbody></table></div>':'<div class="empty">No '+esc(serviceLabel(type))+' attendance for this date.</div>';
}

function populateMembers(){
  const search=document.getElementById('serviceAttendanceMemberSearch'),select=document.getElementById('serviceAttendanceMemberSelect');if(!search||!select)return;
  const q=search.value.trim().toLowerCase(),members=activeMembers().filter(m=>!q||(memberName(m)+' '+(m.member_code||'')+' '+areaName(m.area_id)).toLowerCase().includes(q)).slice(0,100);
  select.innerHTML='<option value="">Select a member</option>'+members.map(m=>'<option value="'+m.id+'">'+esc(memberName(m))+' — '+esc(m.member_code||areaName(m.area_id))+'</option>').join('');
}

function render(){
  if(!root)return;
  root.innerHTML='<section class="service-attendance-hero card"><div><span class="attendance-service-kicker">NON-SUNDAY ATTENDANCE</span><h2>Bible Study & Midweek Service</h2><p>Record attendance on any day. These records stay separate from Sunday attendance performance.</p></div><label>Service type<select id="serviceAttendanceType"><option value="bible_study">Bible Study</option><option value="midweek_service">Midweek Service</option></select></label></section>'+
  '<div class="attendance-workflow"><section class="attendance-action-card card"><div class="attendance-card-title"><span class="attendance-step">1</span><div><h2>Scan member QR</h2><p>Scan a member QR for the selected service type.</p></div></div><div id="serviceAttendanceReader" class="attendance-scanner"><div class="scanner-placeholder">Camera is off</div></div><div class="attendance-actions"><button id="startServiceAttendanceScan" class="btn" type="button">Start camera</button><button id="stopServiceAttendanceScan" class="btn secondary" type="button" disabled>Stop</button></div><div id="serviceScannerStatus" class="attendance-status" role="status"></div></section>'+
  '<section class="attendance-action-card card"><div class="attendance-card-title"><span class="attendance-step">2</span><div><h2>Manual attendance</h2><p>Search an accessible member and record attendance.</p></div></div><label class="attendance-field">Search member<input id="serviceAttendanceMemberSearch" placeholder="Search name, code, or area…" autocomplete="off"></label><label class="attendance-field">Member<select id="serviceAttendanceMemberSelect"><option value="">Select a member</option></select></label><button id="manualServiceAttendanceCheckin" class="btn attendance-primary" type="button">Record attendance</button><div id="serviceAttendanceResult" class="attendance-status" role="status"></div></section></div>'+
  '<section class="attendance-records card"><div class="attendance-records-head"><div><h2 id="serviceAttendanceRecordsTitle">Bible Study Attendance Records</h2><p>Review this service attendance for any selected date.</p></div><div class="attendance-record-controls"><label>Date<input id="serviceAttendanceDate" type="date" value="'+phDay(new Date())+'"></label><button id="refreshServiceAttendance" class="btn secondary" type="button">Refresh</button></div></div><div id="serviceAttendanceTable" class="loading">Loading attendance…</div></section>';

  const type=document.getElementById('serviceAttendanceType');
  type.onchange=async()=>{await stopScanner();document.getElementById('serviceAttendanceRecordsTitle').textContent=serviceLabel(type.value)+' Attendance Records';await renderRecords()};
  document.getElementById('serviceAttendanceMemberSearch').oninput=populateMembers;populateMembers();
  document.getElementById('manualServiceAttendanceCheckin').onclick=async e=>{const m=activeMembers().find(x=>x.id===document.getElementById('serviceAttendanceMemberSelect').value);if(!m){setStatus('serviceAttendanceResult','Select a member first.','error');return}await record(m,'manual',e.currentTarget,'serviceAttendanceResult')};
  document.getElementById('startServiceAttendanceScan').onclick=startScanner;
  document.getElementById('stopServiceAttendanceScan').onclick=stopScanner;
  document.getElementById('serviceAttendanceDate').onchange=renderRecords;
  document.getElementById('refreshServiceAttendance').onclick=renderRecords;
  renderRecords();
}

function mount(container=document.getElementById('serviceAttendancePanel')){root=container;if(root)render()}
async function unmount(){await stopScanner();if(root)root.innerHTML='';root=null}
window.VCCFServiceAttendance={mount,unmount,refresh:renderRecords};
})();