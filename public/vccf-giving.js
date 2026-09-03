(() => {
'use strict';
if (window.__VCCF_GIVING__) return;
window.__VCCF_GIVING__ = true;

let root=null;
let records=[];
let batches=[];
let sundayRecords=[];
let loadedMonth='';
let selectedSunday='';

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const canManage=()=>['admin','pastor'].includes(role());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const memberById=id=>(state().members||[]).find(m=>m.id===id);
const areaName=id=>(state().areas||[]).find(a=>a.id===id)?.name||'Unassigned';
const currentUserId=()=>state().session?.user?.id||null;
const profileName=()=>String(state().profile?.display_name||memberName(memberById(state().profile?.member_id))||'').trim();
const monthKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit'}).format(new Date());
const todayKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthBounds=month=>{const [year,m]=month.split('-').map(Number),nextM=m===12?1:m+1,nextY=m===12?year+1:year;return {start:month+'-01',end:String(nextY)+'-'+String(nextM).padStart(2,'0')+'-01'}};
const dateLabel=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00+08:00')):'—';
const dateTimeLabel=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)):'—';
const isSunday=day=>day&&new Date(day+'T12:00:00+08:00').getDay()===0;
const latestSunday=()=>{const now=new Date(),ph=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Manila'})),d=new Date(ph);d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
const scopeCopy=()=>role()==='admin'||role()==='pastor'?'Church-wide financial records.':role()==='area_leader'?'Giving records for members in your assigned area.':'Your personal tithes and offerings history.';
const activeMembers=()=>(state().members||[]).slice().sort((a,b)=>memberName(a).localeCompare(memberName(b)));
const batchStatusLabel=status=>({draft:'Draft',submitted:'Awaiting approval',approved:'Approved'})[status]||'Not started';
const batchStatusClass=status=>status==='approved'?'approved':status==='submitted'?'submitted':'draft';
const currentBatch=()=>batches.find(b=>b.sunday_date===selectedSunday)||null;
const batchById=id=>batches.find(b=>b.id===id)||null;

async function load(month){
  const client=sb();if(!client)throw new Error('Giving service is unavailable.');
  if(!selectedSunday)selectedSunday=latestSunday();
  const bounds=monthBounds(month);
  const tasks=[
    client.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes,recorded_by,created_at,sunday_batch_id').gte('given_on',bounds.start).lt('given_on',bounds.end).order('given_on',{ascending:false}).order('created_at',{ascending:false})
  ];
  if(canManage()){
    tasks.push(client.from('sunday_giving_batches').select('*').gte('sunday_date',bounds.start).lt('sunday_date',bounds.end).order('sunday_date',{ascending:false}));
    tasks.push(client.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes,recorded_by,created_at,sunday_batch_id').eq('given_on',selectedSunday).order('created_at',{ascending:false}));
    if(selectedSunday<bounds.start||selectedSunday>=bounds.end)tasks.push(client.from('sunday_giving_batches').select('*').eq('sunday_date',selectedSunday).maybeSingle());
  }
  const results=await Promise.all(tasks);
  if(results[0].error)throw results[0].error;
  records=results[0].data||[];
  if(canManage()){
    if(results[1].error)throw results[1].error;
    batches=results[1].data||[];
    if(results[2].error)throw results[2].error;
    sundayRecords=results[2].data||[];
    if(results[3]){
      if(results[3].error)throw results[3].error;
      if(results[3].data&&!batches.some(b=>b.id===results[3].data.id))batches.push(results[3].data);
    }
  }else{sundayRecords=[];batches=[]}
  loadedMonth=month;
}

function summaryCard(label,value,hint){return '<div class="giving-stat card"><span>'+esc(label)+'</span><strong>'+value+'</strong><small>'+esc(hint||'')+'</small></div>'}

function filteredRows(){
  const member=document.getElementById('givingMemberFilter')?.value||'',type=document.getElementById('givingTypeFilter')?.value||'',query=(document.getElementById('givingSearch')?.value||'').trim().toLowerCase();
  return records.filter(row=>{
    const m=memberById(row.member_id),hay=(memberName(m)+' '+(m?.member_code||'')+' '+(row.reference_no||'')+' '+(row.payment_method||'')).toLowerCase();
    return (!member||row.member_id===member)&&(!type||String(row.giving_type||'').toLowerCase()===type)&&(!query||hay.includes(query));
  });
}

function batchTotals(batch){
  const rows=batch?sundayRecords.filter(r=>r.sunday_batch_id===batch.id):[];
  return {
    rows,
    tithe:rows.filter(r=>String(r.giving_type||'').toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0),
    offering:rows.filter(r=>String(r.giving_type||'').toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0)
  };
}

function sundayWorkflowHtml(){
  if(!canManage())return '';
  const batch=currentBatch(),totals=batchTotals(batch),unassigned=sundayRecords.filter(r=>!r.sunday_batch_id),status=batch?.workflow_status||'not_started',locked=status==='submitted'||status==='approved';
  const statusText=batch?batchStatusLabel(status):'Not started';
  const recorder=batch?.recorded_signature_name?'<div class="sunday-giving-signature"><span>Recorder e-signature</span><b>'+esc(batch.recorded_signature_name)+'</b><small>'+esc(dateTimeLabel(batch.recorded_signed_at))+'</small></div>':'<div class="sunday-giving-signature pending"><span>Recorder e-signature</span><b>Not signed yet</b><small>Required before submission</small></div>';
  const approver=batch?.approved_signature_name?'<div class="sunday-giving-signature"><span>Admin/Pastor approval</span><b>'+esc(batch.approved_signature_name)+'</b><small>'+esc(dateTimeLabel(batch.approved_at))+'</small></div>':'<div class="sunday-giving-signature pending"><span>Admin/Pastor approval</span><b>'+(status==='submitted'?'Waiting for approval':'Not approved yet')+'</b><small>Only approved totals flow to Sunday Summary</small></div>';
  let actions='';
  if(!batch)actions='<button id="startSundayGiving" class="btn" type="button">Start Sunday Giving</button>';
  else if(status==='draft')actions='<button id="recordSundayGiving" class="btn secondary" type="button">+ Record Tithe / Offering</button><button id="submitSundayGiving" class="btn" type="button">Sign & Submit</button>';
  else if(status==='submitted')actions='<button id="approveSundayGiving" class="btn" type="button">Approve Sunday Giving</button>';
  else actions='<span class="sunday-giving-approved-note">✓ Approved totals are synced to the Sunday Summary.</span>';

  return '<section class="sunday-giving card"><div class="sunday-giving-head"><div><span class="giving-kicker">SUNDAY GIVING APPROVAL</span><h3>Tithes & Offerings for Sunday</h3><p>Record member giving, sign the Sunday batch, then obtain Admin/Pastor approval before totals appear in the Sunday Summary.</p></div><div class="sunday-giving-date"><label>Sunday<input id="sundayGivingDate" type="date" value="'+attr(selectedSunday)+'" max="'+attr(todayKey())+'"></label><button id="openSundayGiving" class="btn secondary" type="button">Open Sunday</button></div></div>'+
    '<div class="sunday-giving-status-line"><span class="sunday-giving-status '+batchStatusClass(status)+'">'+esc(statusText)+'</span>'+(batch?'<span>'+totals.rows.length+' linked record'+(totals.rows.length===1?'':'s')+'</span>':'<span>No Sunday batch yet</span>')+(unassigned.length?'<span>'+unassigned.length+' existing Sunday record'+(unassigned.length===1?'':'s')+' will be attached when the batch starts</span>':'')+'</div>'+
    '<div class="sunday-giving-metrics">'+summaryCard('Tithes',php(totals.tithe),batch?'Sunday batch total':'Not started')+summaryCard('Offerings',php(totals.offering),batch?'Sunday batch total':'Not started')+summaryCard('Combined',php(totals.tithe+totals.offering),status==='approved'?'Approved for Sunday Summary':locked?'Awaiting approval':'Draft total')+'</div>'+
    '<div class="sunday-giving-signatures">'+recorder+approver+'</div>'+
    '<div class="sunday-giving-actions">'+actions+'</div>'+
    (batch&&totals.rows.length?'<div class="sunday-giving-mini-list">'+totals.rows.slice(0,6).map(r=>'<div><span>'+esc(memberName(memberById(r.member_id)))+' · '+esc(r.giving_type)+'</span><b>'+php(r.amount)+'</b></div>').join('')+(totals.rows.length>6?'<small>+'+(totals.rows.length-6)+' more record(s)</small>':'')+'</div>':'')+
  '</section>';
}

function renderBody(){
  if(!root)return;
  const rows=filteredRows(),tithes=rows.filter(r=>String(r.giving_type||'').toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0),offerings=rows.filter(r=>String(r.giving_type||'').toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0),total=rows.reduce((s,r)=>s+Number(r.amount||0),0);
  const stats=document.getElementById('givingStats');
  if(stats)stats.innerHTML=summaryCard('Tithes',php(tithes),loadedMonth)+summaryCard('Offerings',php(offerings),loadedMonth)+summaryCard('Total Giving',php(total),'Current filters')+summaryCard('Records',String(rows.length),'Current filters');
  const table=document.getElementById('givingTable');
  if(!table)return;
  table.innerHTML=rows.length?'<div class="table-wrap"><table class="table giving-table"><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Sunday workflow</th><th>Method</th><th>Reference</th><th></th></tr></thead><tbody>'+rows.map(row=>{
    const m=memberById(row.member_id),name=m?memberName(m):'Former / deleted member',area=m?areaName(m.area_id):'Historical record',batch=batchById(row.sunday_batch_id),batchStatus=batch?batch.workflow_status:null,editable=canManage()&&(!row.sunday_batch_id||batchStatus==='draft');
    return '<tr><td>'+esc(dateLabel(row.given_on))+'</td><td><b>'+esc(name)+'</b><div class="giving-sub">'+esc(area)+'</div></td><td><span class="giving-type '+(String(row.giving_type||'').toLowerCase()==='tithe'?'tithe':'offering')+'">'+esc(row.giving_type)+'</span></td><td><strong>'+php(row.amount)+'</strong></td><td>'+(row.sunday_batch_id?'<span class="sunday-giving-status '+batchStatusClass(batchStatus)+'">'+esc(batchStatusLabel(batchStatus))+'</span>':'<span class="giving-sub">Not in Sunday batch</span>')+'</td><td>'+esc(row.payment_method||'—')+'</td><td>'+esc(row.reference_no||'—')+'</td><td>'+(editable?'<div class="giving-row-actions"><button type="button" class="cms-small" data-giving-edit="'+row.id+'">Edit</button><button type="button" class="cms-small danger-text" data-giving-delete="'+row.id+'">Delete</button></div>':row.sunday_batch_id?'<span class="giving-sub">Locked</span>':'')+'</td></tr>';
  }).join('')+'</tbody></table></div>':'<div class="giving-empty">No tithes or offerings match the selected filters.</div>';
  table.querySelectorAll('[data-giving-edit]').forEach(button=>button.onclick=()=>{const record=records.find(r=>r.id===button.dataset.givingEdit);openForm(record,batchById(record?.sunday_batch_id))});
  table.querySelectorAll('[data-giving-delete]').forEach(button=>button.onclick=()=>deleteRecord(button.dataset.givingDelete));
}

function render(){
  if(!root)return;
  const members=activeMembers(),memberOptions=members.map(m=>'<option value="'+attr(m.id)+'">'+esc(memberName(m))+' · '+esc(areaName(m.area_id))+'</option>').join('');
  root.innerHTML='<section class="giving-hero card"><div><span class="giving-kicker">STEWARDSHIP</span><h2>Tithes & Offerings</h2><p>'+esc(scopeCopy())+' Individual entries continue to reflect on each member profile; Sunday Summary totals require an approved Sunday giving batch.</p></div>'+(canManage()?'<button id="addGivingRecord" class="btn secondary" type="button">+ General Giving Record</button>':'')+'</section>'+
    sundayWorkflowHtml()+
    '<div id="givingStats" class="giving-stat-grid"></div>'+
    '<section class="giving-ledger card"><div class="giving-ledger-head"><div><h3>Giving Ledger</h3><p>Filter by month, member, type, or reference.</p></div><button id="exportGivingCsv" class="btn secondary" type="button">Export CSV</button></div>'+
    '<div class="giving-filters"><label>Month<input id="givingMonth" type="month" value="'+attr(loadedMonth||monthKey())+'"></label>'+
    (role()==='member'?'':'<label>Member<select id="givingMemberFilter"><option value="">All accessible members</option>'+memberOptions+'</select></label>')+
    '<label>Type<select id="givingTypeFilter"><option value="">All types</option><option value="tithe">Tithe</option><option value="offering">Offering</option></select></label>'+
    '<label class="giving-search">Search<input id="givingSearch" type="search" placeholder="Name, code, reference…"></label></div><div id="givingTable"></div></section>'+
    (role()==='area_leader'?'<div class="giving-privacy-note">Area Leaders can view giving records for their assigned members. Sunday finance recording and approval are restricted to Admins and Pastors.</div>':role()==='member'?'<div class="giving-privacy-note">Your giving history is private and visible only to authorized church leadership and your assigned Area Leader.</div>':'');

  document.getElementById('addGivingRecord')?.addEventListener('click',()=>openForm());
  document.getElementById('givingMonth').onchange=async e=>{await refresh(e.currentTarget.value||monthKey())};
  document.getElementById('givingMemberFilter')?.addEventListener('change',renderBody);
  document.getElementById('givingTypeFilter').onchange=renderBody;
  document.getElementById('givingSearch').oninput=renderBody;
  document.getElementById('exportGivingCsv').onclick=exportCsv;

  if(canManage()){
    document.getElementById('openSundayGiving')?.addEventListener('click',async()=>{const day=document.getElementById('sundayGivingDate')?.value;if(!isSunday(day)){alert('Choose a Sunday date.');return}if(day>todayKey()){alert('Sunday giving cannot be recorded for a future date.');return}selectedSunday=day;await refresh(loadedMonth||monthKey())});
    document.getElementById('startSundayGiving')?.addEventListener('click',startSundayBatch);
    document.getElementById('recordSundayGiving')?.addEventListener('click',()=>openForm(null,currentBatch()));
    document.getElementById('submitSundayGiving')?.addEventListener('click',submitSundayBatch);
    document.getElementById('approveSundayGiving')?.addEventListener('click',approveSundayBatch);
  }
  renderBody();
}

async function startSundayBatch(){
  if(!canManage())return;
  if(!isSunday(selectedSunday))return alert('Choose a valid Sunday.');
  const create=await sb().from('sunday_giving_batches').insert({sunday_date:selectedSunday,recorded_by:currentUserId(),workflow_status:'draft'}).select('*').single();
  if(create.error){alert(create.error.message);return}
  const attach=await sb().from('giving_records').update({sunday_batch_id:create.data.id}).eq('given_on',selectedSunday).is('sunday_batch_id',null);
  if(attach.error){alert('Sunday batch was created, but existing Sunday records could not be attached: '+attach.error.message)}
  window.dispatchEvent(new CustomEvent('vccf-sunday-giving-updated',{detail:{date:selectedSunday,status:'draft'}}));
  await refresh(loadedMonth||monthKey());
}

function signatureModal({title,copy,buttonLabel,onConfirm}){
  document.getElementById('givingSignatureModal')?.remove();
  const wrap=document.createElement('div');wrap.id='givingSignatureModal';wrap.className='giving-modal';
  wrap.innerHTML='<div class="giving-modal-card giving-signature-modal card"><div class="giving-modal-head"><div><span class="giving-kicker">E-SIGNATURE</span><h3>'+esc(title)+'</h3><p>'+esc(copy)+'</p></div><button type="button" class="giving-close" aria-label="Close">×</button></div><label>Type your full name<input id="givingSignatureName" value="'+attr(profileName())+'" autocomplete="name"></label><label class="giving-certify"><input id="givingSignatureCertify" type="checkbox"> <span>I certify that the Sunday giving information and totals shown are accurate to the best of my knowledge.</span></label><div class="giving-modal-actions"><button type="button" class="btn secondary giving-cancel">Cancel</button><button id="confirmGivingSignature" type="button" class="btn">'+esc(buttonLabel)+'</button></div><div id="givingSignatureMsg" class="giving-form-msg"></div></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.giving-close').onclick=close;wrap.querySelector('.giving-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('#confirmGivingSignature').onclick=async e=>{
    const name=String(wrap.querySelector('#givingSignatureName').value||'').trim(),certified=wrap.querySelector('#givingSignatureCertify').checked,msg=wrap.querySelector('#givingSignatureMsg');
    if(!name||!certified){msg.textContent='Type your full name and confirm the certification.';return}
    const button=e.currentTarget,old=button.textContent;button.disabled=true;button.textContent='Saving…';msg.textContent='';
    try{await onConfirm(name);close()}catch(error){msg.textContent=error.message||'Unable to save e-signature.';button.disabled=false;button.textContent=old}
  };
}

function submitSundayBatch(){
  const batch=currentBatch();if(!batch||batch.workflow_status!=='draft')return;
  signatureModal({
    title:'Recorder e-signature',
    copy:'Sign and submit '+dateLabel(batch.sunday_date)+' Tithes & Offerings for Admin/Pastor approval. The batch will lock after submission.',
    buttonLabel:'Sign & Submit',
    onConfirm:async name=>{
      const result=await sb().from('sunday_giving_batches').update({workflow_status:'submitted',recorded_signature_name:name}).eq('id',batch.id).select('*').single();
      if(result.error)throw result.error;
      window.dispatchEvent(new CustomEvent('vccf-sunday-giving-updated',{detail:{date:selectedSunday,status:'submitted'}}));
      await refresh(loadedMonth||monthKey());
    }
  });
}

function approveSundayBatch(){
  const batch=currentBatch();if(!batch||batch.workflow_status!=='submitted')return;
  signatureModal({
    title:'Admin / Pastor approval',
    copy:'Approve '+dateLabel(batch.sunday_date)+' Tithes & Offerings. Once approved, these totals automatically become the finance totals for that Sunday Summary.',
    buttonLabel:'Approve Sunday Giving',
    onConfirm:async name=>{
      const result=await sb().from('sunday_giving_batches').update({workflow_status:'approved',approved_signature_name:name}).eq('id',batch.id).select('*').single();
      if(result.error)throw result.error;
      window.dispatchEvent(new CustomEvent('vccf-sunday-giving-approved',{detail:{date:selectedSunday,batchId:batch.id}}));
      window.VCCFSundayDashboard?.refresh?.();
      await refresh(loadedMonth||monthKey());
    }
  });
}

function openForm(record=null,batch=null){
  if(!canManage())return;
  if(batch&&batch.workflow_status!=='draft')return alert('This Sunday giving batch is locked.');
  document.getElementById('givingModal')?.remove();
  const members=activeMembers(),areas=(state().areas||[]).filter(a=>a.is_active!==false),recordMember=memberById(record?.member_id),initialArea=recordMember?.area_id||'',linkedBatch=batch||batchById(record?.sunday_batch_id),fixedDate=linkedBatch?.sunday_date||'',wrap=document.createElement('div');wrap.id='givingModal';wrap.className='giving-modal';
  wrap.innerHTML='<div class="giving-modal-card card"><div class="giving-modal-head"><div><span class="giving-kicker">FINANCIAL RECORD</span><h3>'+(record?'Edit Giving':linkedBatch?'Record Sunday Giving':'Record Tithe or Offering')+'</h3><p>'+(linkedBatch?'This entry belongs to the '+esc(dateLabel(linkedBatch.sunday_date))+' Sunday giving batch.':'Search and filter the member directory before recording the contribution.')+'</p></div><button type="button" class="giving-close" aria-label="Close">×</button></div>'+
    '<form id="givingForm"><div class="giving-member-picker"><div class="giving-member-picker-head"><b>Select member</b><span id="givingMemberResultCount"></span></div>'+
    '<div class="giving-member-filter-grid"><label>Search member<input id="givingRecordMemberSearch" type="search" placeholder="Name or member code…" autocomplete="off"></label><label>Area<select id="givingRecordAreaFilter"><option value="">All areas</option>'+areas.map(a=>'<option value="'+attr(a.id)+'" '+(initialArea===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></label></div>'+
    '<label>Member<select id="givingRecordMemberSelect" name="member_id" required><option value="">Select member</option></select></label></div>'+
    '<div class="giving-form-grid"><label>Date<input name="given_on" type="date" required value="'+attr(fixedDate||record?.given_on||todayKey())+'" '+(fixedDate?'readonly':'')+'></label><label>Type<select name="giving_type"><option value="Tithe" '+(String(record?.giving_type||'').toLowerCase()==='tithe'?'selected':'')+'>Tithe</option><option value="Offering" '+(String(record?.giving_type||'').toLowerCase()==='offering'?'selected':'')+'>Offering</option></select></label></div>'+
    '<div class="giving-form-grid"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required value="'+attr(record?.amount??'')+'" placeholder="0.00"></label><label>Payment method<select name="payment_method">'+['Cash','GCash','Bank Transfer','Check','Other'].map(x=>'<option '+(record?.payment_method===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
    '<label>Reference number<input name="reference_no" value="'+attr(record?.reference_no||'')+'" placeholder="Optional receipt / transaction reference"></label><label>Notes<textarea name="notes" rows="3" placeholder="Optional internal note">'+esc(record?.notes||'')+'</textarea></label>'+
    '<div class="giving-modal-actions"><button type="button" class="btn secondary giving-cancel">Cancel</button><button type="submit" class="btn">'+(record?'Save Changes':'Record Giving')+'</button></div><div id="givingFormMsg" class="giving-form-msg"></div></form></div>';
  document.body.appendChild(wrap);

  const search=wrap.querySelector('#givingRecordMemberSearch'),areaFilter=wrap.querySelector('#givingRecordAreaFilter'),memberSelect=wrap.querySelector('#givingRecordMemberSelect'),count=wrap.querySelector('#givingMemberResultCount');
  const renderMemberOptions=()=>{
    const q=String(search.value||'').trim().toLowerCase(),area=areaFilter.value,current=memberSelect.value||record?.member_id||'';
    const filtered=members.filter(m=>(!area||m.area_id===area)&&(!q||(memberName(m)+' '+(m.member_code||'')+' '+areaName(m.area_id)).toLowerCase().includes(q)));
    memberSelect.innerHTML='<option value="">Select member</option>'+filtered.map(m=>'<option value="'+attr(m.id)+'" '+(current===m.id?'selected':'')+'>'+esc(memberName(m))+' · '+esc(m.member_code||'No code')+' · '+esc(areaName(m.area_id))+'</option>').join('');
    if(current&&!filtered.some(m=>m.id===current))memberSelect.value='';
    count.textContent=filtered.length+' member'+(filtered.length===1?'':'s')+' found';
  };
  search.oninput=renderMemberOptions;areaFilter.onchange=renderMemberOptions;renderMemberOptions();

  const close=()=>wrap.remove();wrap.querySelector('.giving-close').onclick=close;wrap.querySelector('.giving-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),msg=document.getElementById('givingFormMsg'),fd=new FormData(form),amount=Number(fd.get('amount'));
    if(!fd.get('member_id')||!Number.isFinite(amount)||amount<=0){msg.textContent='Choose a member and enter a valid amount.';return}
    button.disabled=true;button.textContent='Saving…';msg.textContent='';
    const payload={member_id:fd.get('member_id'),given_on:fd.get('given_on'),giving_type:fd.get('giving_type'),amount,payment_method:fd.get('payment_method'),reference_no:String(fd.get('reference_no')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,recorded_by:record?.recorded_by||currentUserId(),sunday_batch_id:linkedBatch?.id||record?.sunday_batch_id||null};
    const result=record?await sb().from('giving_records').update(payload).eq('id',record.id).select().single():await sb().from('giving_records').insert(payload).select().single();
    button.disabled=false;button.textContent=record?'Save Changes':'Record Giving';
    if(result.error){msg.textContent=result.error.message;return}
    close();window.dispatchEvent(new CustomEvent('vccf-giving-updated',{detail:{memberId:payload.member_id,date:payload.given_on}}));await refresh(loadedMonth||monthKey());
  };
}

async function deleteRecord(id){
  if(!canManage())return;const row=records.find(r=>r.id===id);if(!row||!confirm('Delete this '+String(row.giving_type||'giving').toLowerCase()+' record of '+php(row.amount)+'?'))return;
  const result=await sb().from('giving_records').delete().eq('id',id);if(result.error){alert(result.error.message);return}
  window.dispatchEvent(new CustomEvent('vccf-giving-updated',{detail:{memberId:row.member_id,date:row.given_on}}));await refresh(loadedMonth||monthKey());
}

function exportCsv(){
  const rows=filteredRows(),values=[['Date','Member','Member Code','Area','Type','Amount','Sunday Workflow','Payment Method','Reference','Notes']];
  rows.forEach(row=>{const m=memberById(row.member_id),batch=batchById(row.sunday_batch_id);values.push([row.given_on,m?memberName(m):'Former / deleted member',m?.member_code||'',m?areaName(m.area_id):'',row.giving_type,Number(row.amount||0).toFixed(2),batch?batchStatusLabel(batch.workflow_status):'',row.payment_method||'',row.reference_no||'',row.notes||''])});
  const csv=values.map(cols=>cols.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n'),link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='vccf-tithes-offerings-'+(loadedMonth||monthKey())+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

async function refresh(month=loadedMonth||monthKey()){
  if(!root)return;root.innerHTML='<div class="giving-loading card">Loading tithes & offerings…</div>';
  try{await load(month);render()}catch(error){console.error('VCCF Giving',error);root.innerHTML='<div class="notice">Tithes & Offerings could not be loaded. '+esc(error.message||'Please try again.')+'</div>'}
}

function mount(container=document.getElementById('giving')){root=container;if(root){selectedSunday=selectedSunday||latestSunday();refresh(monthKey())}}
function unmount(){root=null}
window.VCCFGiving={mount,unmount,refresh};
})();