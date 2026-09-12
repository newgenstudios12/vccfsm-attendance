(()=>{
'use strict';
if(window.__VCCF_AREA_LEADER_GIVING__)return;
window.__VCCF_AREA_LEADER_GIVING__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'').toLowerCase();
const isAreaLeader=()=>role()==='area_leader';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthKey=()=>today().slice(0,7);
const monthBounds=month=>{const [y,m]=month.split('-').map(Number),nm=m===12?1:m+1,ny=m===12?y+1:y;return {start:month+'-01',end:String(ny)+'-'+String(nm).padStart(2,'0')+'-01'}};
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const areaName=()=>state().areas?.find(a=>String(a.id)===String(state().profile?.area_id))?.name||'your assigned area';
let members=[];
let records=[];
let currentMonth=monthKey();

function ensureStyle(){
  if(document.getElementById('vccfAreaLeaderGivingCss'))return;
  const s=document.createElement('style');
  s.id='vccfAreaLeaderGivingCss';
  s.textContent=`
#areaLeaderGivingNav{display:flex;align-items:center;gap:10px}
#areaLeaderGivingNav .nav-icon svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.alg-wrap{display:grid;gap:16px}.alg-hero,.alg-form-card,.alg-ledger{padding:20px}.alg-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.alg-hero h2,.alg-ledger h3{margin:0 0 6px}.alg-hero p,.alg-ledger p{margin:0;color:var(--muted);font-size:.84rem;line-height:1.55}.alg-badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:var(--brand-soft,#fff0ed);color:var(--brand,#d71920);font-size:.7rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}.alg-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.alg-form .full{grid-column:1/-1}.alg-form label{display:block;font-size:.75rem;font-weight:800;margin-bottom:5px}.alg-form input,.alg-form select,.alg-form textarea{width:100%;min-height:44px;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--text);font:inherit}.alg-form textarea{min-height:76px;resize:vertical}.alg-actions{display:flex;align-items:center;gap:10px;justify-content:flex-end;margin-top:14px}.alg-msg{min-height:20px;font-size:.8rem;color:#b42318}.alg-toolbar{display:flex;gap:10px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.alg-toolbar label{font-size:.75rem;font-weight:800}.alg-toolbar input{display:block;margin-top:5px;min-height:42px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}.alg-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.alg-stat{padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--card-soft,var(--card))}.alg-stat span{display:block;color:var(--muted);font-size:.7rem;font-weight:800}.alg-stat strong{display:block;margin-top:4px;font-size:1.12rem}.alg-table{overflow:auto}.alg-table table{width:100%;border-collapse:collapse;min-width:660px}.alg-table th,.alg-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:.8rem}.alg-table th{font-size:.68rem;text-transform:uppercase;color:var(--muted)}.alg-note{padding:11px 13px;border-radius:12px;background:var(--card-soft,var(--card));border:1px solid var(--line);color:var(--muted);font-size:.78rem;margin-top:10px}
@media(max-width:700px){.alg-hero{display:block}.alg-form{grid-template-columns:1fr}.alg-form .full{grid-column:auto}.alg-stats{grid-template-columns:1fr}.alg-actions{position:sticky;bottom:0;padding-top:10px;background:var(--card)}.alg-actions .btn{width:100%}.alg-form select,.alg-form input{font-size:16px;min-height:48px}}
`;
  document.head.appendChild(s);
}

function ensureView(){
  let view=document.getElementById('giving');
  if(view)return view;
  const church=document.getElementById('church')||document.querySelector('.main .view:last-of-type');
  if(!church)return null;
  view=document.createElement('div');
  view.id='giving';
  view.className='view';
  church.insertAdjacentElement('afterend',view);
  return view;
}

function ensureNav(){
  if(!isAreaLeader())return;
  const nav=document.querySelector('.sidebar .nav');
  if(!nav||document.getElementById('areaLeaderGivingNav'))return;
  const button=document.createElement('button');
  button.id='areaLeaderGivingNav';
  button.className='nav-item';
  button.type='button';
  button.innerHTML='<span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M16.5 7.5c0-1.7-1.8-3-4.5-3s-4.5 1.3-4.5 3 1.4 2.7 4.5 3.5 4.5 1.8 4.5 3.5-1.8 3-4.5 3s-4.5-1.3-4.5-3"/></svg></span><span class="nav-label">Tithes & Offerings</span>';
  button.addEventListener('click',openWorkspace);
  const more=[...nav.querySelectorAll('.nav-section-label')].find(x=>String(x.textContent||'').trim().toLowerCase()==='more');
  if(more)nav.insertBefore(button,more);else nav.appendChild(button);
}

async function loadData(){
  const client=sb();
  if(!client)throw new Error('Giving service is unavailable.');
  const bounds=monthBounds(currentMonth);
  const [dir,ledger]=await Promise.all([
    client.rpc('get_giving_member_directory'),
    client.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes,recorded_by,created_at,sunday_batch_id').gte('given_on',bounds.start).lt('given_on',bounds.end).order('given_on',{ascending:false}).order('created_at',{ascending:false})
  ]);
  if(dir.error)throw dir.error;
  if(ledger.error)throw ledger.error;
  members=(dir.data||[]).filter(m=>String(m.area_id||'')===String(state().profile?.area_id||''));
  records=ledger.data||[];
}

function render(){
  const view=ensureView();
  if(!view)return;
  const memberMap=new Map(members.map(m=>[String(m.id),m]));
  const tithes=records.filter(r=>String(r.giving_type).toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0);
  const offerings=records.filter(r=>String(r.giving_type).toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0);
  const opts=members.filter(m=>m.is_active!==false&&String(m.status||'active').toLowerCase()!=='inactive').map(m=>'<option value="'+esc(m.id)+'">'+esc(memberName(m))+(m.member_code?' · '+esc(m.member_code):'')+'</option>').join('');
  view.innerHTML='<div class="alg-wrap">'+
    '<section class="card alg-hero"><div><span class="alg-badge">Area Leader Access</span><h2>Tithes & Offerings</h2><p>Encode giving only for members assigned to <b>'+esc(areaName())+'</b>. Sunday giving submission and approval remain restricted to the authorized finance team.</p></div></section>'+
    '<section class="card alg-form-card"><form id="algForm"><div class="alg-form">'+
      '<div><label>Member *</label><select name="member_id" required><option value="">Select member</option>'+opts+'</select></div>'+
      '<div><label>Date *</label><input name="given_on" type="date" value="'+esc(today())+'" max="'+esc(today())+'" required></div>'+
      '<div><label>Type *</label><select name="giving_type" required><option value="tithe">Tithe</option><option value="offering">Offering</option></select></div>'+
      '<div><label>Amount *</label><input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" required></div>'+
      '<div><label>Payment method</label><select name="payment_method"><option value="Cash">Cash</option><option value="GCash">GCash</option><option value="Bank Transfer">Bank Transfer</option><option value="Other">Other</option></select></div>'+
      '<div><label>Reference number</label><input name="reference_no" autocomplete="off" placeholder="Optional"></div>'+
      '<div class="full"><label>Notes</label><textarea name="notes" placeholder="Optional note"></textarea></div>'+
    '</div><div class="alg-actions"><span id="algMsg" class="alg-msg"></span><button class="btn" type="submit">Record Giving</button></div></form></section>'+
    '<section class="card alg-ledger"><div class="alg-toolbar"><div><h3>'+esc(currentMonth)+' Area Giving</h3><p>Area-scoped ledger. Entries already attached to a Sunday finance batch remain controlled by the finance team.</p></div><label>Month<input id="algMonth" type="month" value="'+esc(currentMonth)+'"></label></div>'+
      '<div class="alg-stats"><div class="alg-stat"><span>Tithes</span><strong>'+php(tithes)+'</strong></div><div class="alg-stat"><span>Offerings</span><strong>'+php(offerings)+'</strong></div><div class="alg-stat"><span>Total</span><strong>'+php(tithes+offerings)+'</strong></div></div>'+
      '<div class="alg-table">'+(records.length?'<table><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>'+records.map(r=>{const m=memberMap.get(String(r.member_id));return '<tr><td>'+esc(r.given_on)+'</td><td>'+esc(memberName(m))+'</td><td>'+esc(r.giving_type)+'</td><td><b>'+php(r.amount)+'</b></td><td>'+esc(r.payment_method||'—')+'</td><td>'+esc(r.reference_no||'—')+'</td></tr>'}).join('')+'</tbody></table>':'<div class="alg-note">No giving records for this month yet.</div>')+'</div></section></div>';

  const form=document.getElementById('algForm');
  form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form),memberId=String(fd.get('member_id')||''),amount=Number(fd.get('amount')),msg=document.getElementById('algMsg'),button=form.querySelector('button[type="submit"]');
    const member=members.find(m=>String(m.id)===memberId);
    if(!member||String(member.area_id)!==String(state().profile?.area_id||'')){msg.textContent='Choose a member from your assigned area.';return}
    if(!Number.isFinite(amount)||amount<=0){msg.textContent='Enter a valid amount.';return}
    button.disabled=true;button.textContent='Saving…';msg.textContent='';
    const payload={member_id:memberId,given_on:String(fd.get('given_on')||today()),giving_type:String(fd.get('giving_type')||'tithe'),amount,payment_method:String(fd.get('payment_method')||'Cash'),reference_no:String(fd.get('reference_no')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,recorded_by:state().session?.user?.id||null,sunday_batch_id:null};
    const result=await sb().from('giving_records').insert(payload).select('id').single();
    button.disabled=false;button.textContent='Record Giving';
    if(result.error){msg.textContent=result.error.message;return}
    form.reset();form.elements.given_on.value=today();form.elements.giving_type.value='tithe';form.elements.payment_method.value='Cash';msg.style.color='#167647';msg.textContent='Giving recorded successfully.';
    await loadData();render();
  };
  document.getElementById('algMonth').onchange=async e=>{currentMonth=e.currentTarget.value||monthKey();await loadData();render()};
}

async function openWorkspace(){
  if(!isAreaLeader())return;
  document.querySelectorAll('.main .view').forEach(v=>v.classList.remove('active'));
  const view=ensureView();view?.classList.add('active');
  document.querySelectorAll('.sidebar .nav-item,.sidebar [data-route]').forEach(x=>x.classList.remove('active'));
  document.getElementById('areaLeaderGivingNav')?.classList.add('active');
  const title=document.getElementById('title'),hint=document.querySelector('.top .hint');
  if(title)title.textContent='Tithes & Offerings';
  if(hint)hint.textContent='Encode giving for members in '+areaName()+'.';
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('mobileShade')?.classList.remove('open');
  const viewRoot=ensureView();if(viewRoot)viewRoot.innerHTML='<div class="card" style="padding:20px">Loading area giving…</div>';
  try{await loadData();render()}catch(error){if(viewRoot)viewRoot.innerHTML='<div class="card" style="padding:20px;color:#b42318"><b>Unable to load area giving.</b><div style="margin-top:6px">'+esc(error?.message||error)+'</div></div>'}
}

function boot(){
  if(!isAreaLeader())return;
  ensureStyle();ensureView();ensureNav();
}

window.addEventListener('vccf-app-ready',()=>setTimeout(boot,120));
window.addEventListener('vccf-profile-updated',()=>setTimeout(boot,80));
new MutationObserver(()=>{if(isAreaLeader())ensureNav()}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(boot,900);
})();
