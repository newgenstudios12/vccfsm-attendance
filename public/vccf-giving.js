(() => {
'use strict';
if (window.__VCCF_GIVING__) return;
window.__VCCF_GIVING__ = true;

let root=null;
let records=[];
let loadedMonth='';

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
const monthKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit'}).format(new Date());
const todayKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthBounds=month=>{
  const [year,m]=month.split('-').map(Number),nextM=m===12?1:m+1,nextY=m===12?year+1:year;
  return {start:month+'-01',end:String(nextY)+'-'+String(nextM).padStart(2,'0')+'-01'};
};
const dateLabel=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00+08:00')):'—';
const scopeCopy=()=>{
  if(role()==='admin'||role()==='pastor') return 'Church-wide financial records.';
  if(role()==='area_leader') return 'Giving records for members in your assigned area.';
  return 'Your personal tithes and offerings history.';
};
const activeMembers=()=>(state().members||[]).slice().sort((a,b)=>memberName(a).localeCompare(memberName(b)));

async function load(month){
  const client=sb();if(!client)throw new Error('Giving service is unavailable.');
  const bounds=monthBounds(month);
  const result=await client.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes,recorded_by,created_at').gte('given_on',bounds.start).lt('given_on',bounds.end).order('given_on',{ascending:false}).order('created_at',{ascending:false});
  if(result.error)throw result.error;
  records=result.data||[];
  loadedMonth=month;
}

function summaryCard(label,value,hint){
  return '<div class="giving-stat card"><span>'+esc(label)+'</span><strong>'+value+'</strong><small>'+esc(hint||'')+'</small></div>';
}

function filteredRows(){
  const member=document.getElementById('givingMemberFilter')?.value||'',type=document.getElementById('givingTypeFilter')?.value||'',query=(document.getElementById('givingSearch')?.value||'').trim().toLowerCase();
  return records.filter(row=>{
    const m=memberById(row.member_id),hay=(memberName(m)+' '+(m?.member_code||'')+' '+(row.reference_no||'')+' '+(row.payment_method||'')).toLowerCase();
    return (!member||row.member_id===member)&&(!type||String(row.giving_type||'').toLowerCase()===type)&&(!query||hay.includes(query));
  });
}

function renderBody(){
  if(!root)return;
  const rows=filteredRows(),tithes=rows.filter(r=>String(r.giving_type||'').toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0),offerings=rows.filter(r=>String(r.giving_type||'').toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0),total=rows.reduce((s,r)=>s+Number(r.amount||0),0);
  const stats=document.getElementById('givingStats');
  if(stats)stats.innerHTML=summaryCard('Tithes',php(tithes),loadedMonth)+summaryCard('Offerings',php(offerings),loadedMonth)+summaryCard('Total Giving',php(total),'Current filters')+summaryCard('Records',String(rows.length),'Current filters');
  const table=document.getElementById('givingTable');
  if(!table)return;
  table.innerHTML=rows.length?'<div class="table-wrap"><table class="table giving-table"><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th><th></th></tr></thead><tbody>'+rows.map(row=>{
    const m=memberById(row.member_id),name=m?memberName(m):'Former / deleted member',area=m?areaName(m.area_id):'Historical record';
    return '<tr><td>'+esc(dateLabel(row.given_on))+'</td><td><b>'+esc(name)+'</b><div class="giving-sub">'+esc(area)+'</div></td><td><span class="giving-type '+(String(row.giving_type||'').toLowerCase()==='tithe'?'tithe':'offering')+'">'+esc(row.giving_type)+'</span></td><td><strong>'+php(row.amount)+'</strong></td><td>'+esc(row.payment_method||'—')+'</td><td>'+esc(row.reference_no||'—')+'</td><td>'+(canManage()?'<div class="giving-row-actions"><button type="button" class="cms-small" data-giving-edit="'+row.id+'">Edit</button><button type="button" class="cms-small danger-text" data-giving-delete="'+row.id+'">Delete</button></div>':'')+'</td></tr>';
  }).join('')+'</tbody></table></div>':'<div class="giving-empty">No tithes or offerings match the selected filters.</div>';
  table.querySelectorAll('[data-giving-edit]').forEach(button=>button.onclick=()=>openForm(records.find(r=>r.id===button.dataset.givingEdit)));
  table.querySelectorAll('[data-giving-delete]').forEach(button=>button.onclick=()=>deleteRecord(button.dataset.givingDelete));
}

function render(){
  if(!root)return;
  const members=activeMembers(),memberOptions=members.map(m=>'<option value="'+attr(m.id)+'">'+esc(memberName(m))+' · '+esc(areaName(m.area_id))+'</option>').join('');
  root.innerHTML='<section class="giving-hero card"><div><span class="giving-kicker">STEWARDSHIP</span><h2>Tithes & Offerings</h2><p>'+esc(scopeCopy())+' Entries recorded here automatically update each member’s giving summary.</p></div>'+(canManage()?'<button id="addGivingRecord" class="btn" type="button">+ Record Giving</button>':'')+'</section>'+
    '<div id="givingStats" class="giving-stat-grid"></div>'+
    '<section class="giving-ledger card"><div class="giving-ledger-head"><div><h3>Giving Ledger</h3><p>Filter by month, member, type, or reference.</p></div><button id="exportGivingCsv" class="btn secondary" type="button">Export CSV</button></div>'+
    '<div class="giving-filters"><label>Month<input id="givingMonth" type="month" value="'+attr(loadedMonth||monthKey())+'"></label>'+
    (role()==='member'?'':'<label>Member<select id="givingMemberFilter"><option value="">All accessible members</option>'+memberOptions+'</select></label>')+
    '<label>Type<select id="givingTypeFilter"><option value="">All types</option><option value="tithe">Tithe</option><option value="offering">Offering</option></select></label>'+
    '<label class="giving-search">Search<input id="givingSearch" type="search" placeholder="Name, code, reference…"></label></div><div id="givingTable"></div></section>'+
    (role()==='area_leader'?'<div class="giving-privacy-note">Area Leaders can view giving records for their assigned members. Recording, editing, and deleting financial entries is limited to Admins and Pastors.</div>':role()==='member'?'<div class="giving-privacy-note">Your giving history is private and visible only to authorized church leadership and your assigned Area Leader.</div>':'');
  document.getElementById('addGivingRecord')?.addEventListener('click',()=>openForm());
  document.getElementById('givingMonth').onchange=async e=>{await refresh(e.currentTarget.value||monthKey())};
  document.getElementById('givingMemberFilter')?.addEventListener('change',renderBody);
  document.getElementById('givingTypeFilter').onchange=renderBody;
  document.getElementById('givingSearch').oninput=renderBody;
  document.getElementById('exportGivingCsv').onclick=exportCsv;
  renderBody();
}

function openForm(record=null){
  if(!canManage())return;
  document.getElementById('givingModal')?.remove();
  const members=activeMembers(),wrap=document.createElement('div');wrap.id='givingModal';wrap.className='giving-modal';
  wrap.innerHTML='<div class="giving-modal-card card"><div class="giving-modal-head"><div><span class="giving-kicker">FINANCIAL RECORD</span><h3>'+(record?'Edit Giving':'Record Tithe or Offering')+'</h3></div><button type="button" class="giving-close" aria-label="Close">×</button></div>'+
    '<form id="givingForm"><label>Member<select name="member_id" required><option value="">Select member</option>'+members.map(m=>'<option value="'+attr(m.id)+'" '+(record?.member_id===m.id?'selected':'')+'>'+esc(memberName(m))+' · '+esc(areaName(m.area_id))+'</option>').join('')+'</select></label>'+
    '<div class="giving-form-grid"><label>Date<input name="given_on" type="date" required value="'+attr(record?.given_on||todayKey())+'"></label><label>Type<select name="giving_type"><option value="Tithe" '+(String(record?.giving_type||'').toLowerCase()==='tithe'?'selected':'')+'>Tithe</option><option value="Offering" '+(String(record?.giving_type||'').toLowerCase()==='offering'?'selected':'')+'>Offering</option></select></label></div>'+
    '<div class="giving-form-grid"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required value="'+attr(record?.amount??'')+'" placeholder="0.00"></label><label>Payment method<select name="payment_method">'+['Cash','GCash','Bank Transfer','Check','Other'].map(x=>'<option '+(record?.payment_method===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
    '<label>Reference number<input name="reference_no" value="'+attr(record?.reference_no||'')+'" placeholder="Optional receipt / transaction reference"></label><label>Notes<textarea name="notes" rows="3" placeholder="Optional internal note">'+esc(record?.notes||'')+'</textarea></label>'+
    '<div class="giving-modal-actions"><button type="button" class="btn secondary giving-cancel">Cancel</button><button type="submit" class="btn">'+(record?'Save Changes':'Record Giving')+'</button></div><div id="givingFormMsg" class="giving-form-msg"></div></form></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.giving-close').onclick=close;wrap.querySelector('.giving-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),msg=document.getElementById('givingFormMsg'),fd=new FormData(form),amount=Number(fd.get('amount'));
    if(!fd.get('member_id')||!Number.isFinite(amount)||amount<=0){msg.textContent='Choose a member and enter a valid amount.';return}
    button.disabled=true;button.textContent='Saving…';msg.textContent='';
    const payload={member_id:fd.get('member_id'),given_on:fd.get('given_on'),giving_type:fd.get('giving_type'),amount,payment_method:fd.get('payment_method'),reference_no:String(fd.get('reference_no')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,recorded_by:record?.recorded_by||currentUserId()};
    const result=record?await sb().from('giving_records').update(payload).eq('id',record.id).select().single():await sb().from('giving_records').insert(payload).select().single();
    button.disabled=false;button.textContent=record?'Save Changes':'Record Giving';
    if(result.error){msg.textContent=result.error.message;return}
    close();window.dispatchEvent(new CustomEvent('vccf-giving-updated',{detail:{memberId:payload.member_id}}));await refresh(loadedMonth||monthKey());
  };
}

async function deleteRecord(id){
  if(!canManage())return;const row=records.find(r=>r.id===id);if(!row||!confirm('Delete this '+String(row.giving_type||'giving').toLowerCase()+' record of '+php(row.amount)+'?'))return;
  const result=await sb().from('giving_records').delete().eq('id',id);if(result.error){alert(result.error.message);return}
  window.dispatchEvent(new CustomEvent('vccf-giving-updated',{detail:{memberId:row.member_id}}));await refresh(loadedMonth||monthKey());
}

function exportCsv(){
  const rows=filteredRows(),values=[['Date','Member','Member Code','Area','Type','Amount','Payment Method','Reference','Notes']];
  rows.forEach(row=>{const m=memberById(row.member_id);values.push([row.given_on,m?memberName(m):'Former / deleted member',m?.member_code||'',m?areaName(m.area_id):'',row.giving_type,Number(row.amount||0).toFixed(2),row.payment_method||'',row.reference_no||'',row.notes||''])});
  const csv=values.map(cols=>cols.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n'),link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='vccf-tithes-offerings-'+(loadedMonth||monthKey())+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

async function refresh(month=loadedMonth||monthKey()){
  if(!root)return;root.innerHTML='<div class="giving-loading card">Loading tithes & offerings…</div>';
  try{await load(month);render()}catch(error){console.error('VCCF Giving',error);root.innerHTML='<div class="notice">Tithes & Offerings could not be loaded. '+esc(error.message||'Please try again.')+'</div>'}
}

function mount(container=document.getElementById('giving')){root=container;if(root)refresh(monthKey())}
function unmount(){root=null}
window.VCCFGiving={mount,unmount,refresh};
})();