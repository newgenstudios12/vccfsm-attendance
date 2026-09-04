(()=>{
'use strict';
if(window.__VCCF_BAND_FUND__)return;
window.__VCCF_BAND_FUND__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
const phDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmtDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'—';
const fmtStamp=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)):'—';
let allowed=false,checking=false,lastCheck=0,lastUid='',rendering=false,historyRows=[];

function styles(){
  if(document.getElementById('vccfBandFundStyles'))return;
  const s=document.createElement('style');s.id='vccfBandFundStyles';s.textContent=`
.band-fund-shell{display:grid;gap:16px}.band-fund-hero{padding:22px;display:flex;justify-content:space-between;align-items:flex-end;gap:18px;overflow:hidden;position:relative}.band-fund-hero h2{margin:6px 0 5px;font-size:1.35rem}.band-fund-hero p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.5}.band-fund-kicker{display:block;color:var(--brand);font-size:.64rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.band-fund-access{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card-soft);color:var(--muted);font-size:.65rem;font-weight:850;white-space:nowrap}.band-fund-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.band-fund-stat{padding:17px}.band-fund-stat span,.band-fund-stat strong,.band-fund-stat small{display:block}.band-fund-stat span{color:var(--muted);font-size:.68rem;font-weight:850;text-transform:uppercase;letter-spacing:.04em}.band-fund-stat strong{margin-top:7px;font-size:1.4rem;line-height:1.1}.band-fund-stat small{margin-top:5px;color:var(--muted);font-size:.65rem}.band-fund-grid{display:grid;grid-template-columns:minmax(300px,.72fr) minmax(0,1.28fr);gap:16px}.band-fund-entry,.band-fund-history{padding:20px;min-width:0}.band-fund-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:13px;margin-bottom:16px;border-bottom:1px solid var(--line)}.band-fund-head h3{margin:0;font-size:1rem}.band-fund-head p{margin:4px 0 0;color:var(--muted);font-size:.72rem;line-height:1.45}.band-fund-refresh{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:10px;padding:8px 10px;font-weight:850;cursor:pointer}.band-fund-type{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:5px;border:1px solid var(--line);border-radius:12px;background:var(--card-soft);margin-bottom:15px}.band-fund-type button{border:0;border-radius:9px;padding:10px;background:transparent;color:var(--muted);font-weight:900;cursor:pointer}.band-fund-type button.active{background:var(--card);color:var(--brand);box-shadow:0 2px 8px rgba(15,23,42,.08)}.band-fund-type button[data-fund-type="withdraw"].active{color:#b42318}.band-fund-form{display:grid;gap:12px}.band-fund-form label{display:grid;gap:6px;font-size:.72rem;font-weight:850}.band-fund-form input,.band-fund-form textarea{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:var(--input,var(--card));color:var(--text)}.band-fund-form textarea{resize:vertical;min-height:82px}.band-fund-form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.band-fund-submit{width:100%;margin-top:2px}.band-fund-note{padding:10px 11px;border-radius:10px;background:var(--card-soft);color:var(--muted);font-size:.68rem;line-height:1.45}.band-fund-message{min-height:18px;font-size:.72rem;color:var(--muted)}.band-fund-message.good{color:#167647}.band-fund-message.error{color:#b42318}.band-fund-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.band-fund-tools input,.band-fund-tools select{padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:var(--input,var(--card));color:var(--text);font-size:.72rem}.band-fund-tools input{min-width:190px;flex:1}.band-fund-table{min-width:760px}.band-fund-table td{vertical-align:top}.band-fund-kind{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:.65rem;font-weight:900}.band-fund-kind.deposit{background:#e8f7ee;color:#167647}.band-fund-kind.withdraw{background:#fff0f0;color:#b42318}.band-fund-amount{font-weight:900;white-space:nowrap}.band-fund-amount.deposit{color:#167647}.band-fund-amount.withdraw{color:#b42318}.band-fund-desc b,.band-fund-desc span{display:block}.band-fund-desc b{font-size:.76rem}.band-fund-desc span{margin-top:3px;color:var(--muted);font-size:.65rem;line-height:1.4}.band-fund-empty{padding:28px;text-align:center;color:var(--muted);font-size:.75rem}.band-fund-loading{padding:24px;color:var(--muted);font-size:.75rem}
@media(max-width:980px){.band-fund-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.band-fund-grid{grid-template-columns:1fr}}
@media(max-width:680px){.band-fund-hero{align-items:flex-start;flex-direction:column;padding:18px}.band-fund-stats{grid-template-columns:1fr 1fr}.band-fund-entry,.band-fund-history{padding:16px}.band-fund-form-row{grid-template-columns:1fr}.band-fund-head{align-items:flex-start;flex-direction:column}.band-fund-tools{width:100%;display:grid;grid-template-columns:1fr 115px}.band-fund-tools input{min-width:0;width:100%}.band-fund-refresh{width:100%}}
@media(max-width:430px){.band-fund-stats{grid-template-columns:1fr}.band-fund-type{grid-template-columns:1fr 1fr}}
`;
  document.head.appendChild(s);
}

function icon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4z"/><path d="M7 7V5h10v2M8 12h8M8 15h5"/></svg>'}
function ensureView(){
  let v=document.getElementById('bandfund');if(v)return v;
  const giving=document.getElementById('giving'),church=document.getElementById('church');
  v=document.createElement('div');v.id='bandfund';v.className='view';
  if(giving)giving.insertAdjacentElement('afterend',v);else if(church)church.parentNode?.insertBefore(v,church);else document.querySelector('.main')?.appendChild(v);
  return v;
}
function ensureNav(){
  if(!allowed)return;
  const nav=document.querySelector('.sidebar .nav');if(!nav)return;
  let b=nav.querySelector('[data-route="bandfund"]');
  if(!b){
    b=document.createElement('button');b.type='button';b.className='nav-item';b.dataset.route='bandfund';b.innerHTML='<span class="nav-icon">'+icon()+'</span><span class="nav-label">Band Fund</span>';
    const giving=nav.querySelector('[data-route="giving"]'),settings=nav.querySelector('[data-route="settings"]');
    if(giving)giving.insertAdjacentElement('afterend',b);else if(settings)settings.insertAdjacentElement('beforebegin',b);else nav.appendChild(b);
  }
  if(!b.dataset.bandFundBound){b.dataset.bandFundBound='1';b.addEventListener('click',openBandFund)}
  ensureView();
}
function removeAccessUi(){
  document.querySelectorAll('[data-route="bandfund"]').forEach(x=>x.remove());
  const v=document.getElementById('bandfund');
  if(v?.classList.contains('active'))document.querySelector('[data-route="dashboard"]')?.click();
  v?.remove();
}
function setHeading(){
  const title=document.getElementById('title');if(title)title.textContent='Band Fund';
  const hint=document.querySelector('.top .hint');if(hint)hint.textContent='Music/Band ministry fund';
}
function openBandFund(){
  if(!allowed)return;
  ensureNav();const v=ensureView();
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));v.classList.add('active');
  document.querySelectorAll('[data-route],.nav-group-toggle').forEach(x=>x.classList.toggle('active',x.dataset?.route==='bandfund'));
  document.querySelector('.sidebar')?.classList.remove('open');document.getElementById('mobileShade')?.classList.remove('open');
  setHeading();void renderBandFund();
}

async function checkAccess(force=false){
  const client=sb(),uid=state().session?.user?.id||'';if(!client||!uid){allowed=false;removeAccessUi();return false}
  if(checking)return allowed;
  if(!force&&uid===lastUid&&Date.now()-lastCheck<10000){if(allowed)ensureNav();return allowed}
  checking=true;
  try{
    const r=await client.rpc('band_fund_access');
    allowed=!r.error&&r.data===true;lastUid=uid;lastCheck=Date.now();
    if(allowed)ensureNav();else removeAccessUi();
    return allowed;
  }catch(_){allowed=false;removeAccessUi();return false}finally{checking=false}
}

function summaryCards(s){
  return '<div class="band-fund-stats">'+
    '<div class="band-fund-stat card"><span>Current Balance</span><strong>'+php(s.balance)+'</strong><small>Available Band Fund</small></div>'+
    '<div class="band-fund-stat card"><span>Total Deposits</span><strong>'+php(s.total_deposits)+'</strong><small>All recorded deposits</small></div>'+
    '<div class="band-fund-stat card"><span>Total Withdrawals</span><strong>'+php(s.total_withdrawals)+'</strong><small>All recorded withdrawals</small></div>'+
    '<div class="band-fund-stat card"><span>Transactions</span><strong>'+Number(s.transaction_count||0)+'</strong><small>Append-only ledger entries</small></div>'+
  '</div>';
}
function entryPanel(balance){
  return '<section class="band-fund-entry card"><div class="band-fund-head"><div><h3>Record transaction</h3><p>Add money to the fund or record an approved expense.</p></div></div><div class="band-fund-type" role="group" aria-label="Transaction type"><button type="button" class="active" data-fund-type="deposit">Deposit</button><button type="button" data-fund-type="withdraw">Withdraw</button></div><form id="bandFundForm" class="band-fund-form"><input type="hidden" name="type" value="deposit"><div class="band-fund-form-row"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00"></label><label>Date<input name="date" type="date" required value="'+phDay()+'"></label></div><label>Description / purpose<textarea name="description" placeholder="e.g. Rehearsal contribution, cable replacement, instrument repair…"></textarea></label><label>Reference no. <span style="font-weight:500;color:var(--muted)">(optional)</span><input name="reference" maxlength="120" placeholder="Receipt, transfer, or voucher reference"></label><div class="band-fund-note">Available balance: <b>'+php(balance)+'</b>. Withdrawals that exceed the available balance are blocked by the database.</div><button class="btn band-fund-submit" type="submit">Record Deposit</button><div id="bandFundMessage" class="band-fund-message" role="status"></div></form></section>';
}
function filteredRows(){
  const q=String(document.getElementById('bandFundSearch')?.value||'').trim().toLowerCase(),type=String(document.getElementById('bandFundFilter')?.value||'');
  return historyRows.filter(r=>{const hay=[r.description,r.reference_no,r.created_by_name,r.transaction_date,r.transaction_type].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!type||r.transaction_type===type)});
}
function paintHistory(){
  const box=document.getElementById('bandFundHistoryTable');if(!box)return;const rows=filteredRows();
  if(!rows.length){box.innerHTML='<div class="band-fund-empty">No Band Fund transactions match this view.</div>';return}
  box.innerHTML='<div class="table-wrap"><table class="table band-fund-table"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount</th><th>Recorded by</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+esc(fmtDate(r.transaction_date))+'</b><div class="hint">'+esc(fmtStamp(r.created_at))+'</div></td><td><span class="band-fund-kind '+esc(r.transaction_type)+'">'+(r.transaction_type==='deposit'?'＋ Deposit':'− Withdraw')+'</span></td><td><div class="band-fund-desc"><b>'+esc(r.description||'No description')+'</b><span>'+(r.reference_no?'Ref: '+esc(r.reference_no):'No reference number')+'</span></div></td><td><span class="band-fund-amount '+esc(r.transaction_type)+'">'+(r.transaction_type==='deposit'?'+ ':'− ')+php(r.amount)+'</span></td><td>'+esc(r.created_by_name||'VCCF Member')+'</td></tr>').join('')+'</tbody></table></div>';
}
function historyPanel(){
  return '<section class="band-fund-history card"><div class="band-fund-head"><div><h3>Transaction history</h3><p>Deposits and withdrawals are retained as the fund audit trail.</p></div><button id="bandFundRefresh" class="band-fund-refresh" type="button">Refresh</button></div><div class="band-fund-tools"><input id="bandFundSearch" type="search" placeholder="Search description, reference, member…"><select id="bandFundFilter"><option value="">All types</option><option value="deposit">Deposits</option><option value="withdraw">Withdrawals</option></select></div><div id="bandFundHistoryTable" style="margin-top:13px"></div></section>';
}
function bindEntry(balance){
  document.querySelectorAll('[data-fund-type]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-fund-type]').forEach(x=>x.classList.toggle('active',x===b));
    const f=document.getElementById('bandFundForm');if(!f)return;f.elements.type.value=b.dataset.fundType;f.querySelector('.band-fund-submit').textContent=b.dataset.fundType==='withdraw'?'Record Withdrawal':'Record Deposit';
  });
  const form=document.getElementById('bandFundForm');if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(form),type=String(fd.get('type')||'deposit'),amount=Number(fd.get('amount')||0),date=String(fd.get('date')||''),description=String(fd.get('description')||'').trim(),reference=String(fd.get('reference')||'').trim(),btn=form.querySelector('button[type="submit"]'),msg=document.getElementById('bandFundMessage');
    msg.className='band-fund-message';msg.textContent='';
    if(!(amount>0)){msg.classList.add('error');msg.textContent='Enter an amount greater than zero.';return}
    if(type==='withdraw'&&amount>Number(balance||0)){msg.classList.add('error');msg.textContent='This withdrawal is higher than the current Band Fund balance.';return}
    btn.disabled=true;btn.textContent='Saving…';
    try{
      const r=await sb().rpc('band_fund_post_transaction',{p_type:type,p_amount:amount,p_description:description||null,p_reference_no:reference||null,p_transaction_date:date||null});
      if(r.error)throw r.error;
      form.reset();form.elements.type.value='deposit';form.elements.date.value=phDay();document.querySelectorAll('[data-fund-type]').forEach(x=>x.classList.toggle('active',x.dataset.fundType==='deposit'));
      msg.classList.add('good');msg.textContent=type==='withdraw'?'Withdrawal recorded.':'Deposit recorded.';
      await renderBandFund(true);
    }catch(error){msg.classList.add('error');msg.textContent=error.message||'Unable to record Band Fund transaction.'}finally{if(btn.isConnected){btn.disabled=false;btn.textContent='Record Deposit'}}
  };
}
function bindHistory(){
  document.getElementById('bandFundSearch')?.addEventListener('input',paintHistory);document.getElementById('bandFundFilter')?.addEventListener('change',paintHistory);document.getElementById('bandFundRefresh')?.addEventListener('click',()=>renderBandFund(true));paintHistory();
}
async function renderBandFund(){
  if(rendering||!allowed)return;const view=ensureView();if(!view.classList.contains('active'))return;rendering=true;styles();
  view.innerHTML='<div class="band-fund-loading card">Loading Band Fund…</div>';
  try{
    const [sum,rows]=await Promise.all([sb().rpc('band_fund_summary'),sb().from('band_fund_transactions').select('id,transaction_type,amount,transaction_date,description,reference_no,created_by,created_by_name,created_at').order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(500)]);
    if(sum.error)throw sum.error;if(rows.error)throw rows.error;const summary=Array.isArray(sum.data)?(sum.data[0]||{}):(sum.data||{});historyRows=rows.data||[];
    view.innerHTML='<div class="band-fund-shell"><section class="band-fund-hero card"><div><span class="band-fund-kicker">MUSIC / BAND MINISTRY</span><h2>Band Fund</h2><p>Shared ministry ledger for deposits, approved withdrawals, and a clear running balance.</p></div><span class="band-fund-access">Music/Band members · Admin · Pastor</span></section>'+summaryCards(summary)+'<div class="band-fund-grid">'+entryPanel(summary.balance)+historyPanel()+'</div></div>';
    bindEntry(summary.balance);bindHistory();
  }catch(error){view.innerHTML='<div class="notice">'+esc(error.message||'Unable to load Band Fund.')+'</div>'}finally{rendering=false}
}

let domTimer=0;function queueDom(){clearTimeout(domTimer);domTimer=setTimeout(()=>{if(allowed)ensureNav()},120)}
new MutationObserver(queueDom).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',()=>checkAccess(true));window.addEventListener('focus',()=>checkAccess(false));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAccess(false)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>checkAccess(true),300),{once:true});else setTimeout(()=>checkAccess(true),300);
})();
