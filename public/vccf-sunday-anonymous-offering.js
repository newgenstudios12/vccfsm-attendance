(()=>{
'use strict';
if(window.__VCCF_SUNDAY_ANONYMOUS_OFFERING__)return;
window.__VCCF_SUNDAY_ANONYMOUS_OFFERING__=true;

let editingId=null;
let relabelTimer=0;
const sb=()=>window.VCCF?.sb;
const state=()=>window.VCCF?.getState?.()||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const dateLabel=value=>value?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00+08:00')):'—';

async function getSundayContext(form){
  const client=sb(),dateInput=form?.querySelector('[name="given_on"]');
  if(!client||!dateInput?.readOnly||!dateInput.value)return null;
  const batchResult=await client.from('sunday_giving_batches').select('id,sunday_date,workflow_status').eq('sunday_date',dateInput.value).maybeSingle();
  if(batchResult.error||!batchResult.data||batchResult.data.workflow_status!=='draft')return null;
  let record=null;
  if(editingId){
    const recordResult=await client.from('giving_records').select('id,member_id,sunday_batch_id,giving_type').eq('id',editingId).maybeSingle();
    if(!recordResult.error)record=recordResult.data||null;
  }
  return {batch:batchResult.data,record};
}

async function enhanceModal(modal){
  if(!modal||modal.dataset.vccfAnonymousEnhanced==='1')return;
  const form=modal.querySelector('#givingForm');
  if(!form)return;
  const context=await getSundayContext(form);
  if(!context||!modal.isConnected)return;
  modal.dataset.vccfAnonymousEnhanced='1';

  const picker=modal.querySelector('.giving-member-picker');
  const memberSelect=modal.querySelector('#givingRecordMemberSelect');
  const memberSearch=modal.querySelector('#givingRecordMemberSearch');
  const areaFilter=modal.querySelector('#givingRecordAreaFilter');
  const typeSelect=form.querySelector('[name="giving_type"]');
  if(!picker||!memberSelect||!typeSelect)return;

  const option=document.createElement('div');
  option.className='giving-anonymous-option';
  option.style.cssText='margin:0 0 14px;padding:12px 14px;border:1px solid var(--line,#e5e7eb);border-radius:12px;background:rgba(127,127,127,.06)';
  option.innerHTML='<label style="display:flex;gap:10px;align-items:flex-start;font-weight:800;cursor:pointer"><input id="givingAnonymousOffering" type="checkbox" style="margin-top:3px"><span>Anonymous offering<small style="display:block;font-weight:500;color:var(--muted,#6b7280);margin-top:3px">For Sunday offerings that should not be linked to a member profile.</small></span></label>';
  picker.parentNode.insertBefore(option,picker);

  const checkbox=option.querySelector('#givingAnonymousOffering');
  const titheOption=[...typeSelect.options].find(o=>String(o.value).toLowerCase()==='tithe');
  const anonymousExisting=Boolean(context.record&&context.record.member_id==null&&String(context.record.giving_type||'').toLowerCase()==='offering');
  checkbox.checked=anonymousExisting;

  function syncAnonymous(){
    const on=checkbox.checked;
    memberSelect.required=!on;
    memberSelect.disabled=on;
    if(memberSearch)memberSearch.disabled=on;
    if(areaFilter)areaFilter.disabled=on;
    if(titheOption)titheOption.disabled=on;
    if(on)typeSelect.value='Offering';
    picker.style.opacity=on?'.5':'1';
    picker.style.pointerEvents=on?'none':'';
    option.style.opacity='1';
    option.style.pointerEvents='auto';
  }
  checkbox.addEventListener('change',syncAnonymous);
  typeSelect.addEventListener('change',()=>{if(checkbox.checked)typeSelect.value='Offering'});
  syncAnonymous();

  form.addEventListener('submit',async e=>{
    if(!checkbox.checked)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const client=sb(),msg=modal.querySelector('#givingFormMsg'),button=form.querySelector('button[type="submit"]'),fd=new FormData(form),amount=Number(fd.get('amount'));
    if(!client){if(msg)msg.textContent='Giving service is unavailable.';return}
    if(!Number.isFinite(amount)||amount<=0){if(msg)msg.textContent='Enter a valid amount.';return}
    const oldText=button?.textContent||'Record Giving';
    if(button){button.disabled=true;button.textContent='Saving…'}
    if(msg)msg.textContent='';
    const payload={
      member_id:null,
      given_on:String(fd.get('given_on')||context.batch.sunday_date),
      giving_type:'Offering',
      amount,
      payment_method:String(fd.get('payment_method')||'Cash'),
      reference_no:String(fd.get('reference_no')||'').trim()||null,
      notes:String(fd.get('notes')||'').trim()||null,
      recorded_by:context.record?.recorded_by||state().session?.user?.id||null,
      sunday_batch_id:context.batch.id
    };
    const result=editingId
      ? await client.from('giving_records').update(payload).eq('id',editingId).select().single()
      : await client.from('giving_records').insert(payload).select().single();
    if(button){button.disabled=false;button.textContent=oldText}
    if(result.error){if(msg)msg.textContent=result.error.message;return}
    const savedId=result.data?.id||editingId;
    editingId=null;
    modal.remove();
    window.dispatchEvent(new CustomEvent('vccf-giving-updated',{detail:{memberId:null,date:payload.given_on,anonymous:true,id:savedId}}));
    await window.VCCFGiving?.refresh?.();
    queueRelabel();
  },true);
}

async function relabelAnonymous(){
  const client=sb(),root=document.getElementById('giving');
  if(!client||!root)return;
  const monthInput=root.querySelector('#givingMonth');
  let query=client.from('giving_records').select('id,given_on,giving_type,amount,payment_method,reference_no,sunday_batch_id').is('member_id',null).not('sunday_batch_id','is',null);
  if(monthInput?.value){
    const [y,m]=monthInput.value.split('-').map(Number),nextM=m===12?1:m+1,nextY=m===12?y+1:y;
    query=query.gte('given_on',monthInput.value+'-01').lt('given_on',String(nextY)+'-'+String(nextM).padStart(2,'0')+'-01');
  }
  const {data,error}=await query;
  if(error||!data?.length)return;
  const anonymous=data.map(r=>({
    ...r,
    key:[dateLabel(r.given_on),String(r.giving_type||''),php(r.amount),String(r.payment_method||'—'),String(r.reference_no||'—')].join('|')
  }));
  root.querySelectorAll('.giving-table tbody tr').forEach(row=>{
    const cells=row.querySelectorAll('td');
    if(cells.length<7||!cells[1].textContent.includes('Former / deleted member'))return;
    const key=[cells[0].textContent.trim(),cells[2].textContent.trim(),cells[3].textContent.trim(),cells[5].textContent.trim(),cells[6].textContent.trim()].join('|');
    if(anonymous.some(r=>r.key===key))cells[1].innerHTML='<b>Anonymous</b><div class="giving-sub">Anonymous Sunday offering</div>';
  });
  root.querySelectorAll('.sunday-giving-mini-list span').forEach(span=>{
    if(span.textContent.trim()==='Member · Offering')span.textContent='Anonymous · Offering';
  });
}
function queueRelabel(){clearTimeout(relabelTimer);relabelTimer=setTimeout(relabelAnonymous,120)}

function inspectAdded(node){
  if(!(node instanceof Element))return;
  if(node.id==='givingModal')enhanceModal(node);
  node.querySelectorAll?.('#givingModal').forEach(enhanceModal);
}

document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-giving-edit]');
  if(edit)editingId=edit.dataset.givingEdit||null;
  if(e.target.closest?.('#recordSundayGiving,#addGivingRecord'))editingId=null;
},true);

new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)inspectAdded(node);
  queueRelabel();
}).observe(document.documentElement,{childList:true,subtree:true});

window.addEventListener('vccf-giving-updated',queueRelabel);
window.addEventListener('vccf-app-ready',()=>setTimeout(queueRelabel,500));
setTimeout(()=>{document.querySelectorAll('#givingModal').forEach(enhanceModal);queueRelabel()},800);
})();