(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_CHECKLIST__)return;
window.__VCCF_ATTENDANCE_CHECKLIST__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const ownAreaId=()=>state().profile?.area_id||'';
const canUse=()=>['admin','pastor','area_leader'].includes(role());
const canRemove=()=>['admin','area_leader'].includes(role());
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member';
const areaName=id=>(state().areas||[]).find(a=>a.id===id)?.name||'Unassigned';
const bounds=day=>({start:new Date(day+'T00:00:00+08:00').toISOString(),end:new Date(new Date(day+'T00:00:00+08:00').getTime()+86400000).toISOString()});
const activeMembers=()=>{
  const area=role()==='area_leader'?ownAreaId():'';
  return (state().members||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive'&&(!area||m.area_id===area));
};

let original=new Set(),draft=new Set(),rowsByMember=new Map(),loadedDay='',loading=false,saving=false,observer=null;

function ensureStyles(){
  if(document.getElementById('vccfAttendanceChecklistStyles'))return;
  const style=document.createElement('style');
  style.id='vccfAttendanceChecklistStyles';
  style.textContent=`
  .vccf-checklist-card{margin-top:16px;padding:18px}.vccf-checklist-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.vccf-checklist-head h2{margin:0 0 5px;font-size:1.05rem}.vccf-checklist-head p{margin:0;color:var(--muted);font-size:.76rem;line-height:1.45}.vccf-checklist-badge{flex:0 0 auto;padding:6px 10px;border:1px solid var(--line);border-radius:999px;font-size:.7rem;font-weight:900;color:var(--muted);background:var(--card-soft,var(--card))}.vccf-checklist-badge.dirty{color:#9a3412;background:#fff7ed;border-color:#fed7aa}
  .vccf-checklist-filters{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(150px,.8fr) minmax(150px,.8fr);gap:10px;margin-bottom:10px}.vccf-checklist-filters label{display:grid;gap:5px;font-size:.7rem;font-weight:850}.vccf-checklist-filters input,.vccf-checklist-filters select{width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--input,var(--card));color:var(--text);outline:none}.vccf-checklist-filters input:focus,.vccf-checklist-filters select:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(215,25,32,.08)}
  .vccf-checklist-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0}.vccf-checklist-tools-left,.vccf-checklist-tools-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.vccf-checklist-count{font-size:.74rem;font-weight:850;color:var(--muted)}.vccf-checklist-note{padding:9px 11px;border-radius:10px;background:rgba(22,118,71,.07);color:#167647;font-size:.7rem;line-height:1.4;margin-bottom:10px}.vccf-checklist-note.warning{background:#fff7ed;color:#9a3412}.vccf-checklist-status{min-height:18px;margin:8px 0 0;font-size:.74rem;color:var(--muted)}.vccf-checklist-status.error{color:#b42318}.vccf-checklist-status.success{color:#167647}
  .vccf-checklist-list{display:grid;gap:7px;max-height:520px;overflow:auto;padding:2px}.vccf-checklist-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card-soft,var(--card));cursor:pointer;transition:.12s ease}.vccf-checklist-row:hover{border-color:rgba(215,25,32,.35)}.vccf-checklist-row.checked{background:rgba(22,118,71,.06);border-color:rgba(22,118,71,.25)}.vccf-checklist-row.locked{cursor:default;opacity:.86}.vccf-checklist-row input{width:20px;height:20px;accent-color:#167647}.vccf-checklist-member{min-width:0}.vccf-checklist-member b,.vccf-checklist-member span{display:block}.vccf-checklist-member b{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vccf-checklist-member span{margin-top:3px;font-size:.68rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vccf-checklist-present{font-size:.68rem;font-weight:900;color:#167647}.vccf-checklist-empty{padding:28px 14px;text-align:center;color:var(--muted);font-size:.78rem}
  @media(max-width:760px){.vccf-checklist-head{flex-direction:column}.vccf-checklist-filters{grid-template-columns:1fr}.vccf-checklist-tools{align-items:stretch;flex-direction:column}.vccf-checklist-tools-left,.vccf-checklist-tools-right{display:grid;grid-template-columns:1fr 1fr;width:100%}.vccf-checklist-tools-right .btn:last-child{grid-column:1/-1}.vccf-checklist-count{grid-column:1/-1}.vccf-checklist-list{max-height:58vh}.vccf-checklist-row{grid-template-columns:auto minmax(0,1fr)}.vccf-checklist-present{grid-column:2}.vccf-checklist-card{padding:14px}}
  `;
  document.head.appendChild(style);
}

function setStatus(text='',kind=''){
  const el=document.getElementById('vccfChecklistStatus');if(!el)return;
  el.className='vccf-checklist-status '+kind;el.textContent=text;
}
function selectedDay(){return document.getElementById('vccfChecklistDate')?.value||document.getElementById('richAttendanceDate')?.value||phDay(new Date())}
function selectedArea(){return document.getElementById('vccfChecklistArea')?.value||''}
function searchText(){return String(document.getElementById('vccfChecklistSearch')?.value||'').trim().toLowerCase()}
function membersForArea(){const area=selectedArea();return activeMembers().filter(m=>!area||m.area_id===area)}
function visibleMembers(){const q=searchText();return membersForArea().filter(m=>!q||(memberName(m)+' '+(m.member_number||'')+' '+(m.member_code||'')+' '+areaName(m.area_id)).toLowerCase().includes(q))}
function dirtyCount(){let n=0;const all=new Set([...original,...draft]);all.forEach(id=>{if(original.has(id)!==draft.has(id))n++});return n}
function checkedInAt(day){return day===phDay(new Date())?new Date().toISOString():new Date(day+'T12:00:00+08:00').toISOString()}

function updateSummary(){
  const badge=document.getElementById('vccfChecklistBadge'),count=document.getElementById('vccfChecklistCount');
  const areaMembers=membersForArea(),present=areaMembers.filter(m=>draft.has(String(m.id))).length,changes=dirtyCount();
  if(count)count.textContent='Present '+present+' / '+areaMembers.length+(searchText()?' · '+visibleMembers().length+' shown':'');
  if(badge){badge.textContent=changes?changes+' unsaved change'+(changes===1?'':'s'):'Saved';badge.classList.toggle('dirty',changes>0)}
}

function renderList(){
  const list=document.getElementById('vccfChecklistList');if(!list)return;
  const members=visibleMembers();
  if(!members.length){list.innerHTML='<div class="vccf-checklist-empty">No active members match these filters.</div>';updateSummary();return}
  list.innerHTML=members.map(m=>{
    const id=String(m.id),checked=draft.has(id),locked=checked&&!canRemove();
    const code=m.member_number||m.member_code||'No member number';
    return `<label class="vccf-checklist-row ${checked?'checked':''} ${locked?'locked':''}" data-checklist-row="${esc(id)}"><input type="checkbox" data-checklist-member="${esc(id)}" ${checked?'checked':''} ${locked?'disabled':''}><div class="vccf-checklist-member"><b>${esc(memberName(m))}</b><span>${esc(code)} · ${esc(areaName(m.area_id))}</span></div><span class="vccf-checklist-present">${checked?'✓ Present':''}</span></label>`;
  }).join('');
  list.querySelectorAll('[data-checklist-member]').forEach(input=>input.onchange=()=>{
    const id=String(input.dataset.checklistMember||'');if(!id)return;
    if(input.checked)draft.add(id);else draft.delete(id);
    const row=input.closest('.vccf-checklist-row');row?.classList.toggle('checked',input.checked);
    const status=row?.querySelector('.vccf-checklist-present');if(status)status.textContent=input.checked?'✓ Present':'';
    updateSummary();
  });
  updateSummary();
}

function areaOptions(){
  const select=document.getElementById('vccfChecklistArea');if(!select)return;
  const areas=(state().areas||[]).filter(a=>a.is_active!==false&&activeMembers().some(m=>m.area_id===a.id));
  if(role()==='area_leader'){
    const id=ownAreaId();select.innerHTML=id?`<option value="${esc(id)}">${esc(areaName(id))}</option>`:'<option value="">No assigned area</option>';select.disabled=true;
  }else{
    const current=select.value;select.innerHTML='<option value="">All areas</option>'+areas.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
    if([...select.options].some(o=>o.value===current))select.value=current;
  }
}

async function loadChecklist(force=false){
  if(!canUse()||loading)return;
  const day=selectedDay();if(!day)return;
  if(!force&&loadedDay===day&&original.size)return{renderList(),undefined};
  loading=true;setStatus('Loading checklist…');
  const list=document.getElementById('vccfChecklistList');if(list)list.innerHTML='<div class="vccf-checklist-empty">Loading attendance…</div>';
  try{
    const b=bounds(day);let q=sb().from('attendance').select('id,member_id,area_id,checked_in_at,checked_in_by,source,attendance_type').eq('attendance_type','sunday').gte('checked_in_at',b.start).lt('checked_in_at',b.end);
    if(role()==='area_leader'&&ownAreaId())q=q.eq('area_id',ownAreaId());
    const {data,error}=await q;if(error)throw error;
    rowsByMember=new Map();(data||[]).forEach(row=>{const id=String(row.member_id);if(!rowsByMember.has(id))rowsByMember.set(id,[]);rowsByMember.get(id).push(row)});
    original=new Set(rowsByMember.keys());draft=new Set(original);loadedDay=day;areaOptions();renderList();setStatus('Members already recorded by QR or manual attendance are pre-checked.','success');
  }catch(error){original=new Set();draft=new Set();rowsByMember=new Map();loadedDay='';if(list)list.innerHTML='<div class="vccf-checklist-empty">Unable to load checklist.</div>';setStatus(error.message||'Unable to load attendance checklist.','error')}
  finally{loading=false}
}

function selectVisible(value){
  visibleMembers().forEach(m=>{const id=String(m.id);if(value)draft.add(id);else if(canRemove()||!original.has(id))draft.delete(id)});renderList();
}

async function saveChecklist(){
  if(!canUse()||saving)return;
  const day=selectedDay(),b=bounds(day),eligible=new Map(activeMembers().map(m=>[String(m.id),m]));
  const toAdd=[...draft].filter(id=>!original.has(id)&&eligible.has(id));
  const toRemove=[...original].filter(id=>!draft.has(id)&&eligible.has(id));
  if(!toAdd.length&&!toRemove.length){setStatus('No attendance changes to save.');return}
  if(toRemove.length&&!canRemove()){setStatus('Your role can add attendance but cannot remove an existing attendance record.','error');return}
  if(toRemove.length&&!confirm('This will remove '+toRemove.length+' existing Sunday attendance record'+(toRemove.length===1?'':'s')+' for '+day+'. Continue?'))return;
  const button=document.getElementById('vccfChecklistSave'),old=button?.textContent;saving=true;if(button){button.disabled=true;button.textContent='Saving…'}setStatus('Saving checklist…');
  try{
    let inserted=[];
    if(toAdd.length){
      const payload=toAdd.map(id=>{const m=eligible.get(id);return{member_id:m.id,area_id:m.area_id,checked_in_by:state().session?.user?.id||null,source:'manual',attendance_type:'sunday',checked_in_at:checkedInAt(day)}});
      const result=await sb().from('attendance').insert(payload).select('id,member_id,area_id,checked_in_at,checked_in_by,source,attendance_type');if(result.error)throw result.error;inserted=result.data||[];
    }
    if(toRemove.length){
      let del=sb().from('attendance').delete().eq('attendance_type','sunday').gte('checked_in_at',b.start).lt('checked_in_at',b.end).in('member_id',toRemove);
      if(role()==='area_leader')del=del.eq('area_id',ownAreaId());
      const result=await del.select('id,member_id');if(result.error)throw result.error;
    }
    if(Array.isArray(state().attendance)){
      const removeSet=new Set(toRemove);state().attendance=state().attendance.filter(a=>!(a.attendance_type==='sunday'&&removeSet.has(String(a.member_id))&&a.checked_in_at>=b.start&&a.checked_in_at<b.end));
      inserted.forEach(row=>state().attendance.unshift(row));
    }
    window.dispatchEvent(new CustomEvent('vccf-attendance-checklist-updated',{detail:{date:day,added:toAdd.length,removed:toRemove.length}}));
    document.getElementById('refreshRichAttendance')?.click();
    await loadChecklist(true);
    setStatus('✓ Attendance checklist saved. '+toAdd.length+' added'+(toRemove.length?', '+toRemove.length+' removed':'')+'.','success');
  }catch(error){setStatus(error.message||'Unable to save attendance checklist.','error')}
  finally{saving=false;if(button){button.disabled=false;button.textContent=old||'Save Checklist'}}
}

function install(){
  if(!canUse())return;
  const panel=document.getElementById('sundayAttendancePanel');if(!panel||document.getElementById('vccfAttendanceChecklist'))return;
  ensureStyles();
  const card=document.createElement('section');card.id='vccfAttendanceChecklist';card.className='vccf-checklist-card card';
  card.innerHTML=`<div class="vccf-checklist-head"><div><h2>Checklist Attendance</h2><p>Additional quick attendance mode. QR scanning, manual attendance, and the existing records remain available above and below.</p></div><span id="vccfChecklistBadge" class="vccf-checklist-badge">Saved</span></div><div class="vccf-checklist-filters"><label>Search member<input id="vccfChecklistSearch" placeholder="Search name or member number…" autocomplete="off"></label><label>Area<select id="vccfChecklistArea"><option value="">All areas</option></select></label><label>Date<input id="vccfChecklistDate" type="date" value="${esc(document.getElementById('richAttendanceDate')?.value||phDay(new Date()))}"></label></div><div class="vccf-checklist-tools"><div class="vccf-checklist-tools-left"><button id="vccfChecklistAll" class="btn secondary" type="button">Check all shown</button><button id="vccfChecklistClear" class="btn secondary" type="button">Clear shown</button></div><div class="vccf-checklist-tools-right"><span id="vccfChecklistCount" class="vccf-checklist-count">Present 0 / 0</span><button id="vccfChecklistReload" class="btn secondary" type="button">Reload</button><button id="vccfChecklistSave" class="btn" type="button">Save Checklist</button></div></div><div class="vccf-checklist-note ${canRemove()?'':'warning'}">${canRemove()?'Checking adds attendance. Unchecking a previously present member removes that Sunday attendance record after confirmation.':'Checking adds attendance. Existing attendance is locked for Pastor accounts because only Admins and Area Leaders can remove attendance records.'}</div><div id="vccfChecklistList" class="vccf-checklist-list"><div class="vccf-checklist-empty">Loading attendance…</div></div><div id="vccfChecklistStatus" class="vccf-checklist-status" role="status"></div>`;
  const records=panel.querySelector('.attendance-records');if(records)panel.insertBefore(card,records);else panel.appendChild(card);
  areaOptions();
  document.getElementById('vccfChecklistSearch').oninput=renderList;
  document.getElementById('vccfChecklistArea').onchange=renderList;
  document.getElementById('vccfChecklistDate').onchange=()=>loadChecklist(true);
  document.getElementById('vccfChecklistAll').onclick=()=>selectVisible(true);
  document.getElementById('vccfChecklistClear').onclick=()=>selectVisible(false);
  document.getElementById('vccfChecklistReload').onclick=()=>{if(dirtyCount()&&!confirm('Discard unsaved checklist changes and reload attendance?'))return;loadChecklist(true)};
  document.getElementById('vccfChecklistSave').onclick=saveChecklist;
  const richDate=document.getElementById('richAttendanceDate');if(richDate&&!richDate.dataset.checklistSync){richDate.dataset.checklistSync='1';richDate.addEventListener('change',()=>{const input=document.getElementById('vccfChecklistDate');if(input){input.value=richDate.value;loadChecklist(true)}})}
  loadChecklist(true);
}

function boot(){if(!canUse())return;install();if(!observer){observer=new MutationObserver(()=>install());observer.observe(document.body,{subtree:true,childList:true})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('vccf-app-ready',()=>setTimeout(boot,60));
window.addEventListener('vccf-attendance-deleted',()=>{if(document.getElementById('vccfAttendanceChecklist'))loadChecklist(true)});
})();
