(()=>{
'use strict';
if(window.__VCCF_AREA_LEADER_BIBLE_STUDY_GIVING__)return;
window.__VCCF_AREA_LEADER_BIBLE_STUDY_GIVING__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const isAreaLeader=()=>String(state().profile?.role||'').toLowerCase()==='area_leader';
const uid=()=>state().session?.user?.id||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const fmtDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'—';
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const areaName=()=>state().areas?.find(a=>String(a.id)===String(state().profile?.area_id))?.name||'your assigned area';
const statusLabel=v=>({not_started:'Not started',draft:'Draft',submitted:'Awaiting approval',approved:'Approved'})[String(v||'not_started')]||'Not started';
let sessions=[],members=[],timer=0;

function styles(){
  if(document.getElementById('vccfAreaBibleGivingCss'))return;
  const s=document.createElement('style');s.id='vccfAreaBibleGivingCss';s.textContent=`
.albsg{padding:20px;display:grid;gap:14px}.albsg-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.albsg-head h3{margin:0 0 5px}.albsg-head p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.5}.albsg-tag{display:inline-flex;padding:5px 9px;border-radius:999px;background:var(--brand-soft,#fff0ed);color:var(--brand,#d71920);font-size:.68rem;font-weight:900;text-transform:uppercase;margin-bottom:8px}.albsg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.albsg-card{padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--card-soft,var(--card));display:grid;gap:9px}.albsg-card h4{margin:0;font-size:.86rem}.albsg-card p{margin:3px 0 0;color:var(--muted);font-size:.7rem}.albsg-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.albsg-stat{padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--card)}.albsg-stat span,.albsg-stat b{display:block}.albsg-stat span{font-size:.58rem;color:var(--muted);font-weight:900;text-transform:uppercase}.albsg-stat b{margin-top:3px;font-size:.8rem}.albsg-badge{display:inline-flex;padding:4px 7px;border:1px solid var(--line);border-radius:999px;font-size:.62rem;font-weight:900}.albsg-empty{padding:16px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:.78rem;text-align:center}.albsg-overlay{position:fixed;inset:0;z-index:10120;background:rgba(15,23,42,.6);display:grid;place-items:center;padding:15px}.albsg-modal{width:min(760px,100%);max-height:90vh;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:19px;color:var(--text);box-shadow:0 24px 70px rgba(15,23,42,.3)}.albsg-modal-head{padding:17px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px}.albsg-modal-head h3{margin:0 0 4px}.albsg-modal-head p{margin:0;color:var(--muted);font-size:.72rem}.albsg-x{width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);font-size:1.1rem}.albsg-body{padding:17px;display:grid;gap:12px}.albsg-actions{display:flex;gap:8px;flex-wrap:wrap}.albsg-ledger{border:1px solid var(--line);border-radius:12px;overflow:hidden}.albsg-row{display:grid;grid-template-columns:minmax(0,1.4fr) .7fr .8fr auto;gap:8px;align-items:center;padding:10px;border-bottom:1px solid var(--line);font-size:.72rem}.albsg-row:last-child{border-bottom:0}.albsg-row small{display:block;color:var(--muted);margin-top:2px}.albsg-row-actions{display:flex;gap:5px}.albsg-form{padding:17px;display:grid;gap:12px}.albsg-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.albsg-form label{display:grid;gap:5px;font-size:.72rem;font-weight:800}.albsg-form input,.albsg-form select{width:100%;min-height:44px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}.albsg-msg{min-height:18px;color:#b42318;font-size:.75rem}
@media(max-width:700px){.albsg-grid,.albsg-form-grid{grid-template-columns:1fr}.albsg-head{display:block}.albsg-stats{grid-template-columns:1fr}.albsg-row{grid-template-columns:1fr auto}.albsg-row>:nth-child(2),.albsg-row>:nth-child(3){grid-column:1}.albsg-actions{display:grid;grid-template-columns:1fr}.albsg-actions .btn{width:100%}.albsg-form input,.albsg-form select{font-size:16px;min-height:48px}}
`;document.head.appendChild(s);
}

async function loadSessions(){
  const r=await sb().rpc('get_bible_study_finance_sessions',{p_limit:60});
  if(r.error)throw r.error;
  sessions=r.data||[];
  return sessions;
}
async function loadMembers(){
  const r=await sb().rpc('get_giving_member_directory');
  if(r.error)throw r.error;
  members=(r.data||[]).filter(m=>m.is_active!==false&&String(m.status||'').toLowerCase()!=='inactive'&&String(m.area_id||'')===String(state().profile?.area_id||''));
  return members;
}
function totals(records){return records.reduce((a,r)=>{const k=String(r.giving_type||'').toLowerCase();if(k==='tithe')a.tithe+=Number(r.amount||0);if(k==='offering')a.offering+=Number(r.amount||0);return a},{tithe:0,offering:0})}

function card(s){
  const st=s.batch_status||s.giving_workflow_status||'not_started',total=Number(s.tithe_total||0)+Number(s.offering_total||0);
  return `<article class="albsg-card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><h4>${esc(s.title||'Bible Study')}</h4><p>${esc(fmtDate(s.summary_date))} · ${esc(s.barangay||areaName())}</p></div><span class="albsg-badge">${esc(statusLabel(st))}</span></div><div class="albsg-stats"><div class="albsg-stat"><span>Tithes</span><b>${php(s.tithe_total)}</b></div><div class="albsg-stat"><span>Offerings</span><b>${php(s.offering_total)}</b></div><div class="albsg-stat"><span>Total</span><b>${php(total)}</b></div></div><button class="btn secondary" type="button" data-albsg-open="${esc(s.summary_id)}">${st==='not_started'?'Start giving':'Manage giving'}</button></article>`;
}
async function mount(){
  if(!isAreaLeader())return;
  const wrap=document.querySelector('#giving .alg-wrap');
  if(!wrap||document.getElementById('areaLeaderBibleStudyGiving'))return;
  styles();
  const section=document.createElement('section');section.id='areaLeaderBibleStudyGiving';section.className='card albsg';section.innerHTML=`<div class="albsg-head"><div><span class="albsg-tag">${esc(areaName())}</span><h3>Bible Study Tithes & Offerings</h3><p>View and encode Bible Study giving only for your assigned area. You may submit a completed batch for Admin/Pastor approval, but you cannot approve it yourself.</p></div></div><div class="albsg-grid"><div class="albsg-empty">Loading Bible Study finance…</div></div>`;wrap.appendChild(section);
  try{await loadSessions();if(!section.isConnected)return;const grid=section.querySelector('.albsg-grid');grid.innerHTML=sessions.length?sessions.map(card).join(''):'<div class="albsg-empty">No saved Bible Study sessions are available for your area yet.</div>';grid.querySelectorAll('[data-albsg-open]').forEach(b=>b.onclick=()=>openSession(b.dataset.albsgOpen))}catch(e){if(section.isConnected)section.querySelector('.albsg-grid').innerHTML='<div class="albsg-empty">'+esc(e.message||'Unable to load Bible Study finance.')+'</div>'}
}
function close(){document.querySelector('.albsg-overlay')?.remove()}
function modal(title,copy){close();const w=document.createElement('div');w.className='albsg-overlay';w.innerHTML=`<div class="albsg-modal"><div class="albsg-modal-head"><div><h3>${esc(title)}</h3><p>${esc(copy)}</p></div><button type="button" class="albsg-x">×</button></div><div class="albsg-body"><div class="albsg-empty">Loading…</div></div></div>`;document.body.appendChild(w);w.querySelector('.albsg-x').onclick=close;w.onclick=e=>{if(e.target===w)close()};return w}
async function batchData(session){
  const b=await sb().from('bible_study_giving_batches').select('*').eq('service_summary_id',session.summary_id).maybeSingle();if(b.error)throw b.error;
  let records=[];if(b.data){const r=await sb().from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes,recorded_by,created_at,bible_study_batch_id').eq('bible_study_batch_id',b.data.id).order('created_at',{ascending:true});if(r.error)throw r.error;records=r.data||[]}
  return {batch:b.data||null,records};
}
async function openSession(id){
  const session=sessions.find(x=>String(x.summary_id)===String(id));if(!session)return;
  const w=modal(session.title||'Bible Study',fmtDate(session.summary_date)+' · '+(session.barangay||areaName()));
  try{await loadMembers();const {batch,records}=await batchData(session);renderDetail(w,session,batch,records)}catch(e){w.querySelector('.albsg-body').innerHTML='<div class="albsg-empty">'+esc(e.message||'Unable to open Bible Study giving.')+'</div>'}
}
function renderDetail(w,session,batch,records){
  const body=w.querySelector('.albsg-body'),st=batch?.workflow_status||'not_started',t=totals(records),map=new Map(members.map(m=>[String(m.id),m]));
  let actions='';if(!batch)actions='<button class="btn" type="button" data-start>Start Giving Batch</button>';else if(st==='draft')actions='<button class="btn" type="button" data-add>Add Tithe / Offering</button><button class="btn secondary" type="button" data-submit>Sign & Submit</button>';else actions='<span style="color:var(--muted);font-size:.76rem">'+(st==='submitted'?'Submitted for Admin/Pastor approval. Editing is locked.':'Approved. Financial records are locked.')+'</span>';
  const ledger=records.length?'<div class="albsg-ledger">'+records.map(r=>{const m=map.get(String(r.member_id));return `<div class="albsg-row"><div><b>${esc(r.member_id?memberName(m):'Anonymous / Collective')}</b><small>${esc(r.payment_method||'Cash')}${r.reference_no?' · '+esc(r.reference_no):''}</small></div><div>${esc(r.giving_type)}</div><div><b>${php(r.amount)}</b></div><div class="albsg-row-actions">${st==='draft'?`<button class="btn secondary" type="button" data-edit="${esc(r.id)}">Edit</button><button class="btn secondary" type="button" data-delete="${esc(r.id)}">Delete</button>`:''}</div></div>`}).join('')+'</div>':'<div class="albsg-empty">No giving records in this batch yet.</div>';
  body.innerHTML=`<div><span class="albsg-badge">${esc(statusLabel(st))}</span></div><div class="albsg-stats"><div class="albsg-stat"><span>Tithes</span><b>${php(t.tithe)}</b></div><div class="albsg-stat"><span>Offerings</span><b>${php(t.offering)}</b></div><div class="albsg-stat"><span>Total</span><b>${php(t.tithe+t.offering)}</b></div></div><div class="albsg-actions">${actions}</div>${ledger}<div class="albsg-msg" data-msg></div>`;
  body.querySelector('[data-start]')?.addEventListener('click',()=>startBatch(w,session));
  body.querySelector('[data-add]')?.addEventListener('click',()=>recordForm(session,batch,null));
  body.querySelector('[data-submit]')?.addEventListener('click',()=>submitForm(session,batch));
  body.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>recordForm(session,batch,records.find(r=>r.id===b.dataset.edit)));
  body.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteRecord(w,session,batch,b.dataset.delete));
}
async function startBatch(w,session){
  const msg=w.querySelector('[data-msg]');if(msg)msg.textContent='Starting batch…';
  const r=await sb().from('bible_study_giving_batches').insert({service_summary_id:session.summary_id,recorded_by:uid(),workflow_status:'draft'}).select('*').single();if(r.error){if(msg)msg.textContent=r.error.message;return}await refresh(session.summary_id);const d=await batchData(session);renderDetail(w,session,d.batch,d.records)
}
function recordForm(session,batch,record){
  const w=modal(record?'Edit Bible Study Giving':'Add Bible Study Giving',fmtDate(session.summary_date)+' · '+(session.barangay||areaName()));
  const opts=members.map(m=>`<option value="${esc(m.id)}" ${String(record?.member_id||'')===String(m.id)?'selected':''}>${esc(memberName(m))}</option>`).join('');
  w.querySelector('.albsg-body').outerHTML=`<form class="albsg-form"><div class="albsg-form-grid"><label>Type<select name="type"><option value="Tithe" ${record?.giving_type==='Tithe'?'selected':''}>Tithe</option><option value="Offering" ${record?.giving_type==='Offering'?'selected':''}>Offering</option></select></label><label>Member<select name="member"><option value="">Anonymous / Collective Offering</option>${opts}</select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(record?.amount||'')}" required></label><label>Payment method<select name="method"><option ${record?.payment_method==='Cash'?'selected':''}>Cash</option><option ${record?.payment_method==='GCash'?'selected':''}>GCash</option><option ${record?.payment_method==='Bank Transfer'?'selected':''}>Bank Transfer</option><option ${record?.payment_method==='Check'?'selected':''}>Check</option><option ${record?.payment_method==='Other'?'selected':''}>Other</option></select></label><label>Reference<input name="reference" value="${esc(record?.reference_no||'')}" placeholder="Optional"></label><label>Notes<input name="notes" value="${esc(record?.notes||'')}" placeholder="Optional"></label></div><div class="albsg-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn">${record?'Save Changes':'Add Record'}</button></div><div class="albsg-msg"></div></form>`;
  const form=w.querySelector('form'),type=form.elements.type,member=form.elements.member,msg=form.querySelector('.albsg-msg');const sync=()=>{const tithe=type.value==='Tithe';member.required=tithe;member.options[0].textContent=tithe?'Select member for tithe':'Anonymous / Collective Offering'};type.onchange=sync;sync();form.querySelector('[data-cancel]').onclick=()=>openSession(session.summary_id);
  form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form),givingType=String(fd.get('type')),memberId=String(fd.get('member')||'')||null,amount=Number(fd.get('amount')||0);if(givingType==='Tithe'&&!memberId){msg.textContent='Select the member who gave this tithe.';return}if(!(amount>0)){msg.textContent='Enter an amount greater than zero.';return}const payload={member_id:memberId,given_on:session.summary_date,giving_type:givingType,amount,payment_method:String(fd.get('method')||'Cash'),reference_no:String(fd.get('reference')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,recorded_by:record?.recorded_by||uid(),bible_study_batch_id:batch.id,sunday_batch_id:null};const btn=form.querySelector('[type="submit"]');btn.disabled=true;btn.textContent='Saving…';const r=record?await sb().from('giving_records').update(payload).eq('id',record.id).select('id').single():await sb().from('giving_records').insert(payload).select('id').single();if(r.error){msg.textContent=r.error.message;btn.disabled=false;btn.textContent=record?'Save Changes':'Add Record';return}await refresh(session.summary_id);close();openSession(session.summary_id)};
}
async function deleteRecord(w,session,batch,id){if(!confirm('Delete this draft Bible Study giving record?'))return;const r=await sb().from('giving_records').delete().eq('id',id);if(r.error){const m=w.querySelector('[data-msg]');if(m)m.textContent=r.error.message;return}await refresh(session.summary_id);const d=await batchData(session);renderDetail(w,session,d.batch,d.records)}
function submitForm(session,batch){
  const w=modal('Submit Bible Study Giving','Type your full name as recorder e-signature. Admin/Pastor approval is still required.');w.querySelector('.albsg-body').outerHTML=`<form class="albsg-form"><label>Full name<input name="name" autocomplete="name" required placeholder="Full name"></label><div class="albsg-actions"><button type="button" class="btn secondary" data-cancel>Cancel</button><button type="submit" class="btn">Sign & Submit</button></div><div class="albsg-msg"></div></form>`;const f=w.querySelector('form'),msg=f.querySelector('.albsg-msg');f.querySelector('[data-cancel]').onclick=()=>openSession(session.summary_id);f.onsubmit=async e=>{e.preventDefault();const name=String(new FormData(f).get('name')||'').trim();if(name.length<2){msg.textContent='Enter your full name.';return}const r=await sb().from('bible_study_giving_batches').update({workflow_status:'submitted',recorded_signature_name:name}).eq('id',batch.id).select('id').single();if(r.error){msg.textContent=r.error.message;return}await refresh(session.summary_id);close();openSession(session.summary_id)};
}
async function refresh(){sessions=[];document.getElementById('areaLeaderBibleStudyGiving')?.remove();await mount()}
function queue(delay=100){clearTimeout(timer);timer=setTimeout(mount,delay)}
function boot(){if(!isAreaLeader())return;styles();queue(300)}
window.addEventListener('vccf-app-ready',()=>queue(400));window.addEventListener('vccf-profile-updated',()=>queue(250));window.addEventListener('vccf-bible-study-giving-updated',()=>queue(150));new MutationObserver(records=>{if(!isAreaLeader())return;if(records.some(r=>r.addedNodes.length||r.removedNodes.length))queue(120)}).observe(document.documentElement,{childList:true,subtree:true});setTimeout(boot,1200);
})();
