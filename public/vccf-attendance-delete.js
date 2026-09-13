(()=>{
'use strict';
if(window.__VCCF_ATTENDANCE_DELETE_V1__)return;
window.__VCCF_ATTENDANCE_DELETE_V1__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const allowed=()=>['admin','area_leader'].includes(role());
const ownAreaId=()=>state().profile?.area_id||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberName=id=>{const m=(state().members||[]).find(x=>x.id===id);return m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_number||m?.member_code||'Member'};
const areaName=id=>(state().areas||[]).find(x=>x.id===id)?.name||'Unassigned';
const typeLabel=t=>t==='bible_study'?'Bible Study':t==='midweek_service'?'Midweek Service':'Sunday Attendance';
const phDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const bounds=day=>({start:new Date(day+'T00:00:00+08:00').toISOString(),end:new Date(new Date(day+'T00:00:00+08:00').getTime()+86400000).toISOString()});
let modal=null,observer=null,loading=false,inlineBusy=false,inlineTimer=0;

async function hydrateMembersForRecords(records){
  const current=state().members||[],known=new Set(current.map(m=>String(m.id)));
  const missing=[...new Set((records||[]).map(row=>String(row?.member_id||'')).filter(id=>id&&!known.has(id)))];
  if(!missing.length)return false;
  const result=await sb().from('members').select('id,member_number,member_code,first_name,last_name,display_name,area_id,is_active,status,member_type,member_category,address,province,city_municipality,barangay,province_psgc_code,city_municipality_psgc_code,barangay_psgc_code,birth_date,photo_url,created_at').in('id',missing);
  if(result.error){console.warn('Unable to refresh attendance member details:',result.error.message||result.error);return false}
  if(!result.data?.length)return false;
  const byId=new Map(current.map(m=>[String(m.id),m]));
  result.data.forEach(m=>byId.set(String(m.id),m));
  state().members=[...byId.values()];
  return true;
}

function ensureStyles(){
  if(document.getElementById('vccfAttendanceDeleteStyles'))return;
  const style=document.createElement('style');style.id='vccfAttendanceDeleteStyles';style.textContent=`
  .vccf-attendance-delete-trigger{margin-left:auto;border-color:rgba(185,28,28,.22)!important;color:#b91c1c!important}
  .vccf-inline-attendance-delete{display:inline-flex;align-items:center;justify-content:center;margin-top:7px;padding:5px 9px;border:1px solid rgba(185,28,28,.35);border-radius:8px;background:rgba(185,28,28,.08);color:#ef4444;font-size:.68rem;font-weight:850;line-height:1.1;cursor:pointer;white-space:nowrap}
  .vccf-inline-attendance-delete:hover{background:rgba(185,28,28,.14)}.vccf-inline-attendance-delete:disabled{opacity:.55;cursor:wait}
  .vccf-attendance-delete-modal{position:fixed;inset:0;z-index:1400;display:none;place-items:center;padding:18px;background:rgba(0,0,0,.58)}
  .vccf-attendance-delete-modal.open{display:grid}
  .vccf-attendance-delete-card{width:min(760px,100%);max-height:88vh;overflow:auto;background:var(--panel,#fff);color:var(--text,#111);border:1px solid var(--line,#ddd);border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
  .vccf-attendance-delete-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}.vccf-attendance-delete-head h3{margin:0 0 5px}.vccf-attendance-delete-head p{margin:0;color:var(--muted,#666);font-size:.76rem;line-height:1.45}
  .vccf-attendance-delete-close{border:0;background:transparent;color:inherit;font-size:1.6rem;line-height:1;cursor:pointer}
  .vccf-attendance-delete-filters{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;margin-bottom:14px}.vccf-attendance-delete-filters label{display:grid;gap:5px;font-size:.72rem;font-weight:800}.vccf-attendance-delete-filters input,.vccf-attendance-delete-filters select{width:100%;padding:10px 11px;border:1px solid var(--line,#ddd);border-radius:10px;background:var(--input,var(--panel,#fff));color:var(--text,#111)}
  .vccf-attendance-delete-list{display:grid;gap:8px}.vccf-attendance-delete-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid var(--line,#ddd);border-radius:13px}.vccf-attendance-delete-row b,.vccf-attendance-delete-row span{display:block}.vccf-attendance-delete-row span{margin-top:3px;color:var(--muted,#666);font-size:.7rem;line-height:1.4}.vccf-attendance-delete-row .btn{flex:0 0 auto}.vccf-attendance-delete-empty{padding:28px 14px;text-align:center;color:var(--muted,#666)}
  @media(max-width:720px){.vccf-attendance-delete-trigger{margin-left:0;width:100%}.vccf-attendance-delete-filters{grid-template-columns:1fr}.vccf-attendance-delete-row{align-items:flex-start;flex-direction:column}.vccf-attendance-delete-row .btn{width:100%}.vccf-inline-attendance-delete{padding:6px 10px;font-size:.7rem}}
  `;document.head.appendChild(style);
}

function selectedType(){
  if(document.getElementById('serviceAttendanceTab')?.classList.contains('active'))return document.getElementById('serviceAttendanceType')?.value||'bible_study';
  return 'sunday';
}
function selectedDate(){return document.getElementById('serviceAttendanceDate')?.value||document.getElementById('richAttendanceDate')?.value||phDay(new Date())}

function ensureModal(){
  if(modal)return modal;
  modal=document.createElement('div');modal.className='vccf-attendance-delete-modal';modal.id='vccfAttendanceDeleteModal';
  modal.innerHTML=`<div class="vccf-attendance-delete-card"><div class="vccf-attendance-delete-head"><div><h3>Delete Attendance</h3><p>${role()==='area_leader'?'You can delete attendance only for members in your assigned area.':'Review and delete Sunday, Bible Study, or Midweek attendance records.'}</p></div><button class="vccf-attendance-delete-close" type="button" aria-label="Close">×</button></div><div class="vccf-attendance-delete-filters"><label>Date<input id="vccfAttendanceDeleteDate" type="date"></label><label>Attendance type<select id="vccfAttendanceDeleteType"><option value="sunday">Sunday Attendance</option><option value="bible_study">Bible Study</option><option value="midweek_service">Midweek Service</option></select></label><button id="vccfAttendanceDeleteRefresh" class="btn secondary" type="button">Refresh</button></div><div id="vccfAttendanceDeleteList" class="vccf-attendance-delete-list"></div></div>`;
  document.body.appendChild(modal);
  const close=()=>modal.classList.remove('open');modal.querySelector('.vccf-attendance-delete-close').onclick=close;modal.onclick=e=>{if(e.target===modal)close()};
  modal.querySelector('#vccfAttendanceDeleteRefresh').onclick=loadRows;modal.querySelector('#vccfAttendanceDeleteDate').onchange=loadRows;modal.querySelector('#vccfAttendanceDeleteType').onchange=loadRows;
  return modal;
}

async function openManager(){
  if(!allowed())return;
  const m=ensureModal();m.querySelector('#vccfAttendanceDeleteDate').value=selectedDate();m.querySelector('#vccfAttendanceDeleteType').value=selectedType();m.classList.add('open');await loadRows();
}

async function loadRows(){
  if(!allowed()||loading)return;const list=document.getElementById('vccfAttendanceDeleteList');if(!list)return;loading=true;list.innerHTML='<div class="vccf-attendance-delete-empty">Loading attendance…</div>';
  try{
    const day=document.getElementById('vccfAttendanceDeleteDate')?.value||phDay(new Date()),type=document.getElementById('vccfAttendanceDeleteType')?.value||'sunday',b=bounds(day);
    let q=sb().from('attendance').select('id,member_id,area_id,service_area_id,service_barangay,checked_in_at,source,attendance_type').eq('attendance_type',type).gte('checked_in_at',b.start).lt('checked_in_at',b.end).order('checked_in_at',{ascending:false});
    if(role()==='area_leader'){const area=ownAreaId();if(!area){list.innerHTML='<div class="vccf-attendance-delete-empty">Your account has no assigned area.</div>';return}q=q.eq('area_id',area)}
    const {data,error}=await q;if(error)throw error;const rows=data||[];
    if(!rows.length){list.innerHTML='<div class="vccf-attendance-delete-empty">No '+esc(typeLabel(type))+' records found for this date.</div>';return}
    await hydrateMembersForRecords(rows);
    list.innerHTML=rows.map(row=>`<div class="vccf-attendance-delete-row" data-attendance-delete-row="${esc(row.id)}"><div><b>${esc(memberName(row.member_id))}</b><span>${esc(areaName(row.area_id))} · ${esc(typeLabel(row.attendance_type))} · ${esc(new Date(row.checked_in_at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}))}${row.service_barangay?' · '+esc(row.service_barangay):''}</span></div><button class="btn secondary" style="color:#b91c1c" type="button" data-delete-attendance="${esc(row.id)}">Delete</button></div>`).join('');
    list.querySelectorAll('[data-delete-attendance]').forEach(button=>button.onclick=()=>deleteRow(button.dataset.deleteAttendance));
  }catch(error){list.innerHTML='<div class="vccf-attendance-delete-empty">'+esc(error.message||'Unable to load attendance.')+'</div>'}finally{loading=false}
}

async function deleteRow(id){
  if(!allowed()||!id)return;const row=document.querySelector('[data-attendance-delete-row="'+CSS.escape(id)+'"]'),name=row?.querySelector('b')?.textContent||'this attendance record';if(!confirm('Delete attendance for '+name+'? This cannot be undone.'))return;
  let q=sb().from('attendance').delete().eq('id',id);if(role()==='area_leader')q=q.eq('area_id',ownAreaId());const {data,error}=await q.select('id');
  if(error){alert(error.message||'Unable to delete attendance.');return}if(!data?.length){alert('This attendance record could not be deleted. It may be outside your assigned area or already removed.');return}
  if(Array.isArray(state().attendance))state().attendance=state().attendance.filter(item=>item.id!==id);
  window.dispatchEvent(new CustomEvent('vccf-attendance-deleted',{detail:{attendanceId:id}}));
  const type=document.getElementById('vccfAttendanceDeleteType')?.value||'sunday',day=document.getElementById('vccfAttendanceDeleteDate')?.value||'';
  if(type==='sunday'&&document.getElementById('richAttendanceDate')?.value===day)document.getElementById('refreshRichAttendance')?.click();
  if(type!=='sunday'&&document.getElementById('serviceAttendanceDate')?.value===day)window.VCCFServiceAttendance?.refresh?.();
  await loadRows();
}

function memberFromDisplayedCode(code){
  const value=String(code||'').trim();
  return (state().members||[]).find(m=>String(m.member_number||'')===value||String(m.member_code||'')===value||String(m.id)===value)||null;
}
function queueInlineDecorate(delay=80){clearTimeout(inlineTimer);inlineTimer=setTimeout(decorateSundayRows,delay)}
async function decorateSundayRows(){
  if(!allowed()||inlineBusy)return;
  const table=document.querySelector('#richAttendanceTable table.attendance-table');
  const bodyRows=table?[...table.querySelectorAll('tbody tr')]:[];
  if(!bodyRows.length)return;
  const date=document.getElementById('richAttendanceDate')?.value||phDay(new Date()),b=bounds(date);
  inlineBusy=true;
  try{
    let q=sb().from('attendance').select('id,member_id,area_id').eq('attendance_type','sunday').gte('checked_in_at',b.start).lt('checked_in_at',b.end);
    if(role()==='area_leader'){
      const area=ownAreaId();if(!area)return;q=q.eq('area_id',area);
    }
    const {data,error}=await q;if(error)throw error;
    const records=data||[];
    if(await hydrateMembersForRecords(records)){
      document.getElementById('refreshRichAttendance')?.click();
      queueInlineDecorate(220);
      return;
    }
    const byMember=new Map(records.map(row=>[String(row.member_id),row]));
    bodyRows.forEach(row=>{
      if(row.querySelector('[data-inline-delete-attendance]'))return;
      const firstCell=row.querySelector('td:first-child'),code=firstCell?.querySelector('.hint')?.textContent?.trim()||'',member=memberFromDisplayedCode(code),record=member?byMember.get(String(member.id)):byMember.get(code);
      if(!record||!firstCell)return;
      const target=firstCell.querySelector('.member-name > div')||firstCell;
      const button=document.createElement('button');button.type='button';button.className='vccf-inline-attendance-delete';button.dataset.inlineDeleteAttendance=record.id;button.textContent='Delete';button.onclick=event=>{event.stopPropagation();deleteInlineSunday(record.id,record.member_id,button)};target.appendChild(button);
    });
  }catch(error){console.warn('Unable to add attendance delete buttons:',error?.message||error)}finally{inlineBusy=false}
}
async function deleteInlineSunday(id,memberId,button){
  if(!allowed()||!id)return;
  const name=memberName(memberId);if(!confirm('Delete Sunday attendance for '+name+'? This cannot be undone.'))return;
  const oldText=button?.textContent;if(button){button.disabled=true;button.textContent='Deleting…'}
  try{
    let q=sb().from('attendance').delete().eq('id',id).eq('attendance_type','sunday');if(role()==='area_leader')q=q.eq('area_id',ownAreaId());const {data,error}=await q.select('id');
    if(error)throw error;if(!data?.length)throw new Error('This attendance record could not be deleted. It may be outside your assigned area or already removed.');
    if(Array.isArray(state().attendance))state().attendance=state().attendance.filter(item=>item.id!==id);
    window.dispatchEvent(new CustomEvent('vccf-attendance-deleted',{detail:{attendanceId:id}}));
    document.getElementById('refreshRichAttendance')?.click();
    if(modal?.classList.contains('open'))loadRows();
  }catch(error){alert(error.message||'Unable to delete attendance.');if(button){button.disabled=false;button.textContent=oldText||'Delete'}}
}

function installButton(){
  if(!allowed())return;const attendance=document.getElementById('attendance'),tabs=attendance?.querySelector('.attendance-module-tabs');if(!tabs||document.getElementById('vccfDeleteAttendance'))return;
  const button=document.createElement('button');button.id='vccfDeleteAttendance';button.type='button';button.className='btn secondary vccf-attendance-delete-trigger';button.textContent='Delete Attendance';button.onclick=openManager;tabs.appendChild(button);
}
function boot(){
  if(!allowed())return;ensureStyles();installButton();queueInlineDecorate(120);
  if(!observer){observer=new MutationObserver(()=>{installButton();queueInlineDecorate()});observer.observe(document.body,{subtree:true,childList:true})}
}
window.addEventListener('vccf-app-ready',()=>setTimeout(boot,250));window.addEventListener('vccf-profile-updated',()=>setTimeout(boot,120));document.addEventListener('change',event=>{if(event.target?.id==='richAttendanceDate')queueInlineDecorate(160)});document.addEventListener('click',event=>{if(event.target?.id==='refreshRichAttendance'||event.target?.id==='sundayAttendanceTab')queueInlineDecorate(220)});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900),{once:true});else setTimeout(boot,900);
})();
