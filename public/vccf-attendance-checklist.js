(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_CHECKLIST__)return;
window.__VCCF_ATTENDANCE_CHECKLIST__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const ownArea=()=>state().profile?.area_id||'';
const canUse=()=>['admin','pastor','area_leader'].includes(role());
const canRemove=()=>['admin','area_leader'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const nameOf=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
const areaOf=id=>(state().areas||[]).find(a=>a.id===id)?.name||'Unassigned';
const bounds=day=>({start:new Date(day+'T00:00:00+08:00').toISOString(),end:new Date(new Date(day+'T00:00:00+08:00').getTime()+86400000).toISOString()});
const activeMembers=()=>{
  const area=role()==='area_leader'?ownArea():'';
  return (state().members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive'&&(!area||m.area_id===area));
};

let original=new Set();
let draft=new Set();
let loadedDay='';
let loading=false;
let saving=false;
let submitting=false;
let submission=null;
let observer=null;

function styles(){
  if(document.getElementById('vccfChecklistStyles'))return;
  const s=document.createElement('style');
  s.id='vccfChecklistStyles';
  s.textContent=`
  .vccf-checklist{margin-top:16px;padding:18px}.vccf-checklist-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.vccf-checklist-head h2{margin:0 0 5px;font-size:1.05rem}.vccf-checklist-head p{margin:0;color:var(--muted);font-size:.76rem;line-height:1.45}.vccf-checklist-badge{padding:6px 10px;border:1px solid var(--line);border-radius:999px;font-size:.69rem;font-weight:900;color:var(--muted);white-space:nowrap}.vccf-checklist-badge.dirty{background:#fff7ed;color:#9a3412;border-color:#fed7aa}
  .vccf-checklist-filters{display:grid;grid-template-columns:minmax(190px,1.4fr) minmax(150px,.8fr) minmax(150px,.8fr);gap:10px}.vccf-checklist-filters label{display:grid;gap:5px;font-size:.7rem;font-weight:850}.vccf-checklist-filters input,.vccf-checklist-filters select{width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--input,var(--card));color:var(--text)}
  .vccf-checklist-tools{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:11px 0}.vccf-checklist-tools>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.vccf-checklist-count{font-size:.73rem;font-weight:850;color:var(--muted)}.vccf-checklist-note{padding:9px 11px;margin-bottom:10px;border-radius:10px;background:rgba(22,118,71,.07);color:#167647;font-size:.7rem;line-height:1.4}.vccf-checklist-note.warn{background:#fff7ed;color:#9a3412}
  .vccf-checklist-list{display:grid;gap:7px;max-height:520px;overflow:auto;padding:2px}.vccf-check-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card-soft,var(--card));cursor:pointer}.vccf-check-row.checked{background:rgba(22,118,71,.06);border-color:rgba(22,118,71,.25)}.vccf-check-row.locked{cursor:default;opacity:.86}.vccf-check-row input{width:20px;height:20px;accent-color:#167647}.vccf-check-copy{min-width:0}.vccf-check-copy b,.vccf-check-copy span{display:block}.vccf-check-copy b{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vccf-check-copy span{margin-top:3px;color:var(--muted);font-size:.68rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vccf-check-present{color:#167647;font-size:.68rem;font-weight:900}.vccf-checklist-empty{padding:26px 12px;text-align:center;color:var(--muted);font-size:.78rem}.vccf-checklist-status{min-height:18px;margin-top:8px;font-size:.73rem;color:var(--muted)}.vccf-checklist-status.success{color:#167647}.vccf-checklist-status.error{color:#b42318}
  .vccf-checklist-badge.submitted{background:#e8f7ee;color:#167647;border-color:#c9ead6}.vccf-checklist-submit{font-weight:900}.vccf-checklist-reopen{font-weight:850}.vccf-check-row.finalized{cursor:default}.vccf-check-unmarked{color:var(--muted);font-size:.66rem;font-weight:800}
  @media(max-width:760px){.vccf-checklist{padding:14px}.vccf-checklist-head{flex-direction:column}.vccf-checklist-filters{grid-template-columns:1fr}.vccf-checklist-tools{align-items:stretch;flex-direction:column}.vccf-checklist-tools>div{display:grid;grid-template-columns:1fr 1fr;width:100%}.vccf-checklist-count{grid-column:1/-1}.vccf-checklist-tools .save-checklist,.vccf-checklist-tools .vccf-checklist-submit,.vccf-checklist-tools .vccf-checklist-reopen{grid-column:1/-1}.vccf-checklist-list{max-height:58vh}.vccf-check-row{grid-template-columns:auto minmax(0,1fr)}.vccf-check-present,.vccf-check-unmarked{grid-column:2}}
  `;
  document.head.appendChild(s);
}

function status(text='',kind=''){
  const el=document.getElementById('vccfChecklistStatus');
  if(!el)return;
  el.className='vccf-checklist-status '+kind;
  el.textContent=text;
}
function day(){return document.getElementById('vccfChecklistDate')?.value||document.getElementById('richAttendanceDate')?.value||phDay(new Date())}
function selectedArea(){return document.getElementById('vccfChecklistArea')?.value||''}
function submissionArea(){return role()==='area_leader'?ownArea():selectedArea()}
function isFinalized(){return submission?.status==='submitted'}
function canReopen(){return ['admin','pastor'].includes(role())}
function query(){return String(document.getElementById('vccfChecklistSearch')?.value||'').trim().toLowerCase()}
function scopedMembers(){const a=selectedArea();return activeMembers().filter(m=>!a||m.area_id===a)}
function visibleMembers(){
  const q=query();
  return scopedMembers().filter(m=>!q||(nameOf(m)+' '+(m.member_number||'')+' '+(m.member_code||'')+' '+areaOf(m.area_id)).toLowerCase().includes(q));
}
function changedCount(){
  const ids=new Set([...original,...draft]);
  let n=0;
  ids.forEach(id=>{if(original.has(id)!==draft.has(id))n++});
  return n;
}
function stampFor(d){return d===phDay(new Date())?new Date().toISOString():new Date(d+'T12:00:00+08:00').toISOString()}

function summary(){
  const total=scopedMembers();
  const present=total.filter(m=>draft.has(String(m.id))).length;
  const absent=Math.max(0,total.length-present);
  const count=document.getElementById('vccfChecklistCount');
  if(count)count.textContent=`Present ${present} · ${isFinalized()?'Absent':'Unmarked'} ${absent} · Total ${total.length}${query()?` · ${visibleMembers().length} shown`:''}`;
  const badge=document.getElementById('vccfChecklistBadge');
  const changes=changedCount();
  if(badge){
    badge.textContent=isFinalized()?'✓ Submitted':changes?`${changes} unsaved change${changes===1?'':'s'}`:submission?.status==='reopened'?'Reopened':'Saved';
    badge.classList.toggle('dirty',!isFinalized()&&changes>0);
    badge.classList.toggle('submitted',isFinalized());
  }
  const submit=document.getElementById('vccfChecklistSubmit'),reopen=document.getElementById('vccfChecklistReopen'),areaId=submissionArea();
  if(submit){submit.hidden=!areaId||isFinalized();submit.disabled=saving||submitting;}
  if(reopen){reopen.hidden=!areaId||!isFinalized()||!canReopen();reopen.disabled=submitting;}
}

function render(){
  const list=document.getElementById('vccfChecklistList');
  if(!list)return;
  const members=visibleMembers();
  if(!members.length){
    list.innerHTML='<div class="vccf-checklist-empty">No active members match these filters.</div>';
    summary();
    return;
  }
  list.innerHTML=members.map(m=>{
    const id=String(m.id),checked=draft.has(id),locked=isFinalized()||(checked&&!canRemove());
    return `<label class="vccf-check-row ${checked?'checked':''} ${locked?'locked':''} ${isFinalized()?'finalized':''}">
      <input type="checkbox" data-vccf-check-member="${esc(id)}" ${checked?'checked':''} ${locked?'disabled':''}>
      <span class="vccf-check-copy"><b>${esc(nameOf(m))}</b><span>${esc(m.member_number||m.member_code||'No member number')} · ${esc(areaOf(m.area_id))}</span></span>
      <span class="${checked?'vccf-check-present':'vccf-check-unmarked'}">${checked?'✓ Present':isFinalized()?'Absent':'Not marked'}</span>
    </label>`;
  }).join('');
  list.querySelectorAll('[data-vccf-check-member]').forEach(input=>input.addEventListener('change',()=>{
    const id=String(input.dataset.vccfCheckMember||'');
    if(input.checked)draft.add(id);else draft.delete(id);
    const row=input.closest('.vccf-check-row');
    row?.classList.toggle('checked',input.checked);
    const mark=row?.querySelector('.vccf-check-present,.vccf-check-unmarked');
    if(mark){mark.className=input.checked?'vccf-check-present':'vccf-check-unmarked';mark.textContent=input.checked?'✓ Present':'Not marked';}
    summary();
  }));
  summary();
}

function fillAreas(){
  const select=document.getElementById('vccfChecklistArea');
  if(!select)return;
  if(role()==='area_leader'){
    const id=ownArea();
    select.innerHTML=id?`<option value="${esc(id)}">${esc(areaOf(id))}</option>`:'<option value="">No assigned area</option>';
    select.disabled=true;
    return;
  }
  const current=select.value;
  const areas=(state().areas||[]).filter(a=>a.is_active!==false&&activeMembers().some(m=>m.area_id===a.id));
  select.innerHTML='<option value="">All areas</option>'+areas.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
}

async function load(force=false){
  if(!canUse()||loading)return;
  const d=day();
  if(!force&&loadedDay===d){render();return}
  loading=true;
  status('Loading checklist…');
  const list=document.getElementById('vccfChecklistList');
  if(list)list.innerHTML='<div class="vccf-checklist-empty">Loading attendance…</div>';
  try{
    const b=bounds(d);
    let req=sb().from('attendance').select('id,member_id,area_id,checked_in_at,source,attendance_type').eq('attendance_type','sunday').gte('checked_in_at',b.start).lt('checked_in_at',b.end);
    if(role()==='area_leader'&&ownArea())req=req.eq('area_id',ownArea());
    const areaId=submissionArea();
    const subReq=areaId?sb().from('sunday_attendance_submissions').select('id,sunday_date,area_id,status,active_member_count,present_count,absent_count,submitted_by,submitted_at,reopened_by,reopened_at,updated_at').eq('sunday_date',d).eq('area_id',areaId).maybeSingle():Promise.resolve({data:null,error:null});
    const [attRes,subRes]=await Promise.all([req,subReq]);
    if(attRes.error)throw attRes.error;
    if(subRes.error)throw subRes.error;
    original=new Set((attRes.data||[]).map(r=>String(r.member_id)));
    draft=new Set(original);
    submission=subRes.data||null;
    loadedDay=d;
    fillAreas();
    render();
    if(isFinalized())status(`✓ Attendance submitted · Present ${submission.present_count} · Absent ${submission.absent_count}. ${canReopen()?'Reopen it to make corrections.':'Ask an Admin or Pastor to reopen it if a correction is needed.'}`,'success');
    else if(submission?.status==='reopened')status('Attendance has been reopened. Make corrections, then submit it again.','success');
    else status('Existing QR and manual attendance is already checked here. Unmarked members become absent only when attendance is submitted.','success');
  }catch(error){
    original=new Set();draft=new Set();submission=null;loadedDay='';
    if(list)list.innerHTML='<div class="vccf-checklist-empty">Unable to load checklist.</div>';
    status(error.message||'Unable to load attendance checklist.','error');
  }finally{loading=false}
}

function setVisible(value){
  if(isFinalized()){status('This attendance is already submitted and is read-only.','error');return}
  visibleMembers().forEach(m=>{
    const id=String(m.id);
    if(value)draft.add(id);
    else if(canRemove()||!original.has(id))draft.delete(id);
  });
  render();
}

async function save(){
  if(!canUse()||saving)return false;
  if(isFinalized()){status('This attendance is already submitted. An Admin or Pastor must reopen it before changes can be saved.','error');return false;}
  const d=day(),b=bounds(d);
  const members=new Map(activeMembers().map(m=>[String(m.id),m]));
  const add=[...draft].filter(id=>!original.has(id)&&members.has(id));
  const remove=[...original].filter(id=>!draft.has(id)&&members.has(id));
  if(!add.length&&!remove.length){status('No attendance changes to save.');return true}
  if(remove.length&&!canRemove()){status('Your role can add attendance but cannot remove existing attendance.','error');return false}
  if(remove.length&&!confirm(`Remove ${remove.length} existing Sunday attendance record${remove.length===1?'':'s'} for ${d}?`))return false;

  const button=document.getElementById('vccfChecklistSave');
  const old=button?.textContent;
  saving=true;
  if(button){button.disabled=true;button.textContent='Saving…'}
  status('Saving checklist…');
  try{
    let inserted=[];
    if(add.length){
      const payload=add.map(id=>{
        const m=members.get(id);
        return {member_id:m.id,area_id:m.area_id,checked_in_by:state().session?.user?.id||null,source:'manual',attendance_type:'sunday',checked_in_at:stampFor(d)};
      });
      const r=await sb().from('attendance').insert(payload).select('id,member_id,area_id,checked_in_at,checked_in_by,source,attendance_type');
      if(r.error)throw r.error;
      inserted=r.data||[];
    }
    if(remove.length){
      let req=sb().from('attendance').delete().eq('attendance_type','sunday').gte('checked_in_at',b.start).lt('checked_in_at',b.end).in('member_id',remove);
      if(role()==='area_leader')req=req.eq('area_id',ownArea());
      const r=await req.select('id');
      if(r.error)throw r.error;
    }
    if(Array.isArray(state().attendance)){
      const removed=new Set(remove);
      state().attendance=state().attendance.filter(a=>!(a.attendance_type==='sunday'&&removed.has(String(a.member_id))&&a.checked_in_at>=b.start&&a.checked_in_at<b.end));
      inserted.forEach(r=>state().attendance.unshift(r));
    }
    window.dispatchEvent(new CustomEvent('vccf-attendance-checklist-updated',{detail:{date:d,added:add.length,removed:remove.length}}));
    document.getElementById('refreshRichAttendance')?.click();
    await load(true);
    status(`✓ Checklist saved. ${add.length} added${remove.length?`, ${remove.length} removed`:''}.`,'success');
    return true;
  }catch(error){
    status(error.message||'Unable to save attendance checklist.','error');
    return false;
  }finally{
    saving=false;
    if(button){button.disabled=false;button.textContent=old||'Save Checklist'}
  }
}

async function submitAttendance(){
  if(!canUse()||submitting)return;
  const areaId=submissionArea(),d=day();
  if(!areaId){status('Choose one area before submitting attendance.','error');return}
  if(isFinalized()){status('Attendance is already submitted.','error');return}
  if(changedCount()){
    const saved=await save();
    if(!saved)return;
  }
  const members=scopedMembers(),present=members.filter(m=>draft.has(String(m.id))).length,absent=Math.max(0,members.length-present);
  if(!confirm(`Submit ${areaOf(areaId)} attendance for ${d}?\n\n${present} will be Present.\n${absent} unmarked member${absent===1?'':'s'} will be counted Absent.\n\nAttendance will become read-only after submission.`))return;
  const button=document.getElementById('vccfChecklistSubmit'),old=button?.textContent,uid=state().session?.user?.id||null,now=new Date().toISOString();
  submitting=true;if(button){button.disabled=true;button.textContent='Submitting…'}status('Finalizing attendance…');
  try{
    const b=bounds(d);
    const fresh=await sb().from('attendance').select('member_id').eq('attendance_type','sunday').eq('area_id',areaId).gte('checked_in_at',b.start).lt('checked_in_at',b.end);
    if(fresh.error)throw fresh.error;
    const presentIds=new Set((fresh.data||[]).map(r=>String(r.member_id))),areaMembers=activeMembers().filter(m=>m.area_id===areaId),freshPresent=areaMembers.filter(m=>presentIds.has(String(m.id))).length,freshAbsent=Math.max(0,areaMembers.length-freshPresent);
    const payload={sunday_date:d,area_id:areaId,status:'submitted',active_member_count:areaMembers.length,present_count:freshPresent,absent_count:freshAbsent,submitted_by:uid,submitted_at:now,updated_by:uid,updated_at:now};
    const r=await sb().from('sunday_attendance_submissions').upsert(payload,{onConflict:'sunday_date,area_id'}).select('id').single();
    if(r.error)throw r.error;
    await load(true);
    status(`✓ ${areaOf(areaId)} attendance submitted. ${freshPresent} Present · ${freshAbsent} Absent.`,'success');
    window.dispatchEvent(new CustomEvent('vccf-sunday-attendance-submitted',{detail:{date:d,areaId,present:freshPresent,absent:freshAbsent}}));
  }catch(error){status(error.message||'Unable to submit attendance.','error')}
  finally{submitting=false;if(button){button.disabled=false;button.textContent=old||'Submit Attendance'}summary()}
}

async function reopenAttendance(){
  if(!canReopen()||submitting||!isFinalized())return;
  const areaId=submissionArea(),d=day();
  if(!areaId)return;
  if(!confirm(`Reopen ${areaOf(areaId)} attendance for ${d}? Area Leaders will be able to edit and resubmit it.`))return;
  const button=document.getElementById('vccfChecklistReopen'),old=button?.textContent,uid=state().session?.user?.id||null,now=new Date().toISOString();
  submitting=true;if(button){button.disabled=true;button.textContent='Reopening…'}status('Reopening attendance…');
  try{
    const r=await sb().from('sunday_attendance_submissions').update({status:'reopened',reopened_by:uid,reopened_at:now,updated_by:uid,updated_at:now}).eq('sunday_date',d).eq('area_id',areaId).select('id').single();
    if(r.error)throw r.error;
    await load(true);
    status(`Attendance for ${areaOf(areaId)} has been reopened.`,'success');
  }catch(error){status(error.message||'Unable to reopen attendance.','error')}
  finally{submitting=false;if(button){button.disabled=false;button.textContent=old||'Reopen Attendance'}summary()}
}

function install(){
  if(!canUse())return;
  const panel=document.getElementById('sundayAttendancePanel');
  if(!panel||document.getElementById('vccfAttendanceChecklist'))return;
  styles();
  const card=document.createElement('section');
  card.id='vccfAttendanceChecklist';
  card.className='vccf-checklist card';
  card.innerHTML=`
    <div class="vccf-checklist-head"><div><h2>Checklist Attendance</h2><p>Additional quick attendance mode. QR scanning, manual attendance, and the existing attendance records remain available.</p></div><span id="vccfChecklistBadge" class="vccf-checklist-badge">Saved</span></div>
    <div class="vccf-checklist-filters">
      <label>Search member<input id="vccfChecklistSearch" autocomplete="off" placeholder="Search name or member number…"></label>
      <label>Area<select id="vccfChecklistArea"><option value="">All areas</option></select></label>
      <label>Date<input id="vccfChecklistDate" type="date" value="${esc(document.getElementById('richAttendanceDate')?.value||phDay(new Date()))}"></label>
    </div>
    <div class="vccf-checklist-tools"><div><button id="vccfChecklistAll" class="btn secondary" type="button">Check all shown</button><button id="vccfChecklistClear" class="btn secondary" type="button">Clear shown</button></div><div><span id="vccfChecklistCount" class="vccf-checklist-count">Present 0 · Unmarked 0 · Total 0</span><button id="vccfChecklistReload" class="btn secondary" type="button">Reload</button><button id="vccfChecklistSave" class="btn secondary save-checklist" type="button">Save Checklist</button><button id="vccfChecklistSubmit" class="btn vccf-checklist-submit" type="button">Submit Attendance</button><button id="vccfChecklistReopen" class="btn secondary vccf-checklist-reopen" type="button" hidden>Reopen Attendance</button></div></div>
    <div class="vccf-checklist-note ${canRemove()?'':'warn'}">${canRemove()?'Check everyone who is present. Before submission, unchecked members stay “Not marked.” When you submit, they are counted as Absent and the area becomes read-only. QR and manual check-ins use this same list.':'Checked means present. Existing attendance is locked for Pastor accounts because current permissions allow Pastors to add, but not delete, attendance.'}</div>
    <div id="vccfChecklistList" class="vccf-checklist-list"><div class="vccf-checklist-empty">Loading attendance…</div></div>
    <div id="vccfChecklistStatus" class="vccf-checklist-status" role="status"></div>`;
  const records=panel.querySelector('.attendance-records');
  if(records)panel.insertBefore(card,records);else panel.appendChild(card);

  fillAreas();
  document.getElementById('vccfChecklistSearch').addEventListener('input',render);
  document.getElementById('vccfChecklistArea').addEventListener('change',()=>load(true));
  document.getElementById('vccfChecklistDate').addEventListener('change',e=>{
    const rich=document.getElementById('richAttendanceDate');
    if(rich)rich.value=e.currentTarget.value;
    load(true);
  });
  document.getElementById('vccfChecklistAll').onclick=()=>setVisible(true);
  document.getElementById('vccfChecklistClear').onclick=()=>setVisible(false);
  document.getElementById('vccfChecklistReload').onclick=()=>{
    if(changedCount()&&!confirm('Discard unsaved checklist changes and reload attendance?'))return;
    load(true);
  };
  document.getElementById('vccfChecklistSave').onclick=save;
  document.getElementById('vccfChecklistSubmit').onclick=submitAttendance;
  document.getElementById('vccfChecklistReopen').onclick=reopenAttendance;

  const rich=document.getElementById('richAttendanceDate');
  if(rich&&!rich.dataset.vccfChecklistSync){
    rich.dataset.vccfChecklistSync='1';
    rich.addEventListener('change',()=>{
      const input=document.getElementById('vccfChecklistDate');
      if(input){input.value=rich.value;load(true)}
    });
  }
  load(true);
}

function boot(){
  if(!canUse())return;
  install();
  if(!observer){
    observer=new MutationObserver(()=>install());
    observer.observe(document.body,{childList:true,subtree:true});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('vccf-app-ready',()=>setTimeout(boot,80));
window.addEventListener('vccf-attendance-deleted',()=>{if(document.getElementById('vccfAttendanceChecklist'))load(true)});
})();