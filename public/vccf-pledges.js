(() => {
'use strict';
if (window.__VCCF_PLEDGES__) return;
window.__VCCF_PLEDGES__ = true;

let root=null;
let campaigns=[];
let progress=[];
let commitments=[];
let payments=[];
let directory=[];
let selectedCampaignId='';
let loading=false;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const finance=()=>window.VCCFFinanceAccess?.()===true||['admin','pastor','treasurer'].includes(role());
const currentUserId=()=>state().session?.user?.id||null;
const currentMemberId=()=>state().profile?.member_id||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const number=v=>Number(v)||0;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const dateLabel=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'—';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const memberById=id=>directory.find(m=>m.id===id)||(state().members||[]).find(m=>m.id===id)||null;
const campaignById=id=>campaigns.find(c=>c.id===id)||null;
const selectedCampaign=()=>campaignById(selectedCampaignId)||campaigns[0]||null;
const progressFor=id=>progress.find(p=>p.campaign_id===id)||{total_pledged:0,total_received:0};
const pledgesFor=id=>commitments.filter(p=>p.campaign_id===id);
const paymentsForCampaign=id=>payments.filter(p=>p.campaign_id===id);
const paidForPledge=id=>payments.filter(p=>p.pledge_id===id&&p.status==='posted').reduce((sum,p)=>sum+number(p.amount),0);
const pct=(value,total)=>total>0?Math.round(value/total*100):0;
const currentMember=()=>memberById(currentMemberId())||(state().members||[]).find(m=>m.id===currentMemberId())||null;

async function audit(action,entityType,entityId,metadata={}){
  try{
    const uid=currentUserId();if(!uid)return;
    await sb().from('audit_log').insert({actor_user_id:uid,action,entity_type:entityType,entity_id:entityId||null,metadata});
  }catch(error){console.warn('Pledge audit',error)}
}

function ensureView(){
  let view=document.getElementById('pledges');
  if(view){root=view;return view;}
  const giving=document.getElementById('giving'),settings=document.getElementById('settings'),church=document.getElementById('church');
  if(!giving&&!settings&&!church)return null;
  view=document.createElement('div');view.id='pledges';view.className='view';
  if(giving?.parentNode)giving.insertAdjacentElement('afterend',view);
  else if(settings?.parentNode)settings.parentNode.insertBefore(view,settings);
  else church?.parentNode?.appendChild(view);
  root=view;return view;
}

function pledgeIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>'}
function installNavigation(){
  if(!finance())return true;
  ensureView();
  if(document.querySelector('[data-route="pledges"]'))return true;
  const giving=document.querySelector('[data-route="giving"]');
  if(!giving)return false;
  const button=document.createElement('button');
  button.type='button';button.className='nav-item';button.dataset.route='pledges';
  button.innerHTML='<span class="nav-icon">'+pledgeIcon()+'</span><span class="nav-label">Pledges</span>';
  giving.insertAdjacentElement('afterend',button);
  button.onclick=open;
  return true;
}
function scheduleInstall(attempt=0){
  if(installNavigation())return;
  if(attempt<20)setTimeout(()=>scheduleInstall(attempt+1),120);
}

async function loadDirectory(){
  if(finance()){
    const result=await sb().rpc('get_giving_member_directory');
    if(result.error)throw result.error;
    directory=result.data||[];
  }else directory=(state().members||[]).slice();
}

async function loadAll(){
  const client=sb();if(!client)throw new Error('Pledge service is unavailable.');
  await loadDirectory();
  const [c,p,cm,pm]=await Promise.all([
    client.from('pledge_campaigns').select('id,name,description,goal_amount,square_value,start_date,end_date,status,created_by,created_at,updated_at').order('created_at',{ascending:false}),
    client.from('pledge_campaign_progress').select('campaign_id,total_pledged,total_received,updated_at'),
    client.from('pledge_commitments').select('id,campaign_id,member_id,member_name,pledged_amount,target_date,notes,status,created_by,created_at,updated_at').order('created_at',{ascending:false}),
    client.from('pledge_payments').select('id,pledge_id,campaign_id,member_id,member_name,amount,paid_on,payment_method,reference_no,notes,status,recorded_by,voided_at,voided_by,void_reason,created_at,updated_at').order('paid_on',{ascending:false}).order('created_at',{ascending:false})
  ]);
  for(const r of [c,p,cm,pm])if(r.error)throw r.error;
  campaigns=c.data||[];progress=p.data||[];commitments=cm.data||[];payments=pm.data||[];
  if(!selectedCampaignId||!campaignById(selectedCampaignId))selectedCampaignId=campaigns.find(x=>x.status==='active')?.id||campaigns[0]?.id||'';
}

function activateShell(){
  ensureView();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  root?.classList.add('active');
  document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route==='pledges'));
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('mobileShade')?.classList.remove('open');
  document.body.classList.remove('nav-open');
  const title=document.getElementById('title');if(title)title.textContent='Pledges';
  const hint=document.querySelector('.top .hint');if(hint)hint.textContent='Campaign progress, commitments and fulfillment';
  window.VCCFGiving?.unmount?.();
}

function statCard(label,value,hint=''){return '<div class="pledge-stat card"><span>'+esc(label)+'</span><strong>'+value+'</strong><small>'+esc(hint)+'</small></div>'}
function campaignStatus(c){return '<i class="'+esc(c.status)+'">'+esc(c.status.charAt(0).toUpperCase()+c.status.slice(1))+'</i>'}

function squareGrid(c,summary){
  const goal=number(c.goal_amount),unit=Math.max(1,number(c.square_value)||1000),pledged=number(summary.total_pledged),received=number(summary.total_received),covered=Math.max(pledged,received),total=Math.max(1,Math.ceil(goal/unit));
  let squares='';
  for(let i=0;i<total;i++){
    const start=i*unit,end=Math.min(goal,(i+1)*unit),capacity=Math.max(1,end-start),recv=clamp((received-start)/capacity,0,1),pledge=clamp((covered-start)/capacity,0,1),partial=(recv>0&&recv<1)||(pledge>0&&pledge<1);
    const label=php(start)+' – '+php(end)+' · '+Math.round(recv*100)+'% received'+(pledge>recv?' · '+Math.round((pledge-recv)*100)+'% pledged':'');
    squares+='<div class="pledge-square '+(partial?'partial':'')+'" style="--recv:'+(recv*100).toFixed(2)+'%;--pledge:'+(pledge*100).toFixed(2)+'%" title="'+attr(label)+'" aria-label="'+attr(label)+'"></div>';
  }
  const receivedSquares=Math.min(total,Math.floor(received/unit)),pledgedOnly=Math.max(0,Math.floor(Math.max(pledged-received,0)/unit)),remaining=Math.max(0,total-receivedSquares-pledgedOnly);
  return '<section class="pledge-visual-card card"><div class="pledge-visual-head"><div><h3>Pledge Progress</h3><p>Every square represents '+php(unit)+'. Partial amounts fill part of a square automatically.</p></div><span class="pledge-visual-badge">▦ '+total+' squares</span></div><div class="pledge-progress-layout"><div class="pledge-square-stage"><div class="pledge-square-grid">'+squares+'</div></div><div><div class="pledge-legend"><div class="pledge-legend-row"><i class="pledge-legend-swatch received"></i><b>Received</b><span>'+php(received)+'</span></div><div class="pledge-legend-row"><i class="pledge-legend-swatch pledged"></i><b>Pledged, not received</b><span>'+php(Math.max(pledged-received,0))+'</span></div><div class="pledge-legend-row"><i class="pledge-legend-swatch remaining"></i><b>Still needed</b><span>'+php(Math.max(goal-Math.max(pledged,received),0))+'</span></div></div><div class="pledge-progress-note"><b>'+Math.min(100,pct(received,goal))+'% of the campaign goal has been received.</b><span>'+receivedSquares+' full received squares · '+pledgedOnly+' pledged-only squares · '+remaining+' remaining full squares</span></div></div></div></section>';
}

function personalPanel(c){
  const mine=commitments.find(p=>p.campaign_id===c.id&&p.member_id===currentMemberId()&&p.status!=='cancelled');
  if(finance())return '';
  if(!mine)return '<section class="pledge-panel card"><div class="pledge-panel-head"><div><h3>My Pledge</h3><p>Your pledge amount is private to you and the finance team.</p></div>'+(c.status==='active'?'<button id="makeMyPledge" class="btn" type="button">Make a Pledge</button>':'')+'</div><div class="pledge-empty"><strong>No pledge yet</strong>You have not made a pledge for this campaign.</div></section>';
  const paid=paidForPledge(mine.id),remaining=Math.max(number(mine.pledged_amount)-paid,0),done=pct(paid,number(mine.pledged_amount));
  return '<section class="pledge-panel card"><div class="pledge-panel-head"><div><h3>My Pledge</h3><p>Only you and authorized finance roles can see these amounts.</p></div>'+(c.status==='active'?'<button id="editMyPledge" class="btn secondary" type="button">Update Pledge</button>':'')+'</div><div class="pledge-personal-card"><h4>'+esc(c.name)+'</h4><div class="pledge-personal-values"><div><span>Pledged</span><b>'+php(mine.pledged_amount)+'</b></div><div><span>Received</span><b>'+php(paid)+'</b></div><div><span>Remaining</span><b>'+php(remaining)+'</b></div></div><div class="pledge-mini-bar"><i style="width:'+Math.min(100,done)+'%"></i></div><div class="hint" style="margin-top:8px">'+Math.min(100,done)+'% fulfilled'+(mine.target_date?' · Target '+esc(dateLabel(mine.target_date)):'')+'</div></div></section>';
}

function pledgeStatus(p){
  if(p.status==='cancelled')return ['Cancelled','cancelled'];
  const paid=paidForPledge(p.id),amount=number(p.pledged_amount);
  if(paid>=amount)return ['Fulfilled','fulfilled'];
  if(paid>0)return ['In Progress','progress'];
  return ['Pending','pending'];
}

function financeLedger(c){
  if(!finance())return '';
  const rows=pledgesFor(c.id).slice().sort((a,b)=>String(a.member_name).localeCompare(String(b.member_name)));
  const body=rows.map(p=>{const paid=paidForPledge(p.id),remaining=Math.max(number(p.pledged_amount)-paid,0),status=pledgeStatus(p);return '<tr><td><b>'+esc(p.member_name)+'</b></td><td class="pledge-money">'+php(p.pledged_amount)+'</td><td class="pledge-money">'+php(paid)+'</td><td class="pledge-money">'+php(remaining)+'</td><td><span class="pledge-status '+status[1]+'">'+status[0]+'</span></td><td>'+esc(p.target_date?dateLabel(p.target_date):'—')+'</td><td><div class="pledge-row-actions"><button class="cms-small" type="button" data-pledge-edit="'+p.id+'">Edit</button>'+(p.status!=='cancelled'?'<button class="cms-small" type="button" data-pledge-pay="'+p.id+'">Record Payment</button>':'')+'</div></td></tr>'}).join('');
  return '<section class="pledge-panel card"><div class="pledge-panel-head"><div><h3>Campaign Pledges</h3><p>Individual amounts are restricted to authorized finance roles.</p></div><div class="pledge-actions"><button id="addPledge" class="btn secondary" type="button">+ Add Pledge</button><button id="recordPledgePayment" class="btn" type="button">+ Record Payment</button></div></div><div class="table-wrap"><table class="table pledge-table"><thead><tr><th>Member</th><th>Pledged</th><th>Received</th><th>Balance</th><th>Status</th><th>Target</th><th></th></tr></thead><tbody>'+(body||'<tr><td colspan="7"><div class="pledge-empty"><strong>No pledges yet</strong>Add a member pledge to begin tracking fulfillment.</div></td></tr>')+'</tbody></table></div></section>';
}

function paymentPanel(c){
  const rows=paymentsForCampaign(c.id).slice(0,12);
  return '<section class="pledge-panel card"><div class="pledge-panel-head"><div><h3>'+((finance())?'Recent Payments':'My Payments')+'</h3><p>Posted payments count toward received campaign progress.</p></div></div><div class="pledge-payment-list">'+(rows.length?rows.map(p=>'<div class="pledge-payment-row '+(p.status==='voided'?'voided':'')+'"><div><b>'+esc(finance()?p.member_name:(p.payment_method||'Payment'))+'</b><span>'+esc(dateLabel(p.paid_on))+' · '+esc(p.payment_method||'—')+(p.reference_no?' · '+esc(p.reference_no):'')+(p.status==='voided'?' · VOIDED':'')+'</span></div><div><strong>'+php(p.amount)+'</strong>'+(finance()&&p.status==='posted'?'<button class="cms-small danger-text" style="display:block;margin-top:5px" type="button" data-payment-void="'+p.id+'">Void</button>':'')+'</div></div>').join(''):'<div class="pledge-empty"><strong>No payments yet</strong>Payments recorded for this campaign will appear here.</div>')+'</div></section>';
}

function render(){
  if(!root)return;
  if(!campaigns.length){
    root.innerHTML='<section class="pledge-hero card"><div><span class="pledge-kicker">▦ PLEDGE CAMPAIGNS</span><h2>Pledges</h2><p>Track commitments separately from money received, with a square-based campaign progress view.</p></div>'+(finance()?'<div class="pledge-hero-actions"><button id="newPledgeCampaign" class="btn" type="button">+ New Campaign</button></div>':'')+'</section><div class="pledge-empty card"><strong>No pledge campaigns yet</strong>'+(finance()?'Create the first campaign to begin tracking pledges.':'There are no active pledge campaigns right now.')+'</div>';
    document.getElementById('newPledgeCampaign')?.addEventListener('click',()=>campaignForm());return;
  }
  const c=selectedCampaign(),summary=progressFor(c.id),goal=number(c.goal_amount),pledged=number(summary.total_pledged),received=number(summary.total_received),remaining=Math.max(goal-received,0),completion=Math.min(100,pct(received,goal)),coverage=Math.min(100,pct(Math.max(pledged,received),goal));
  const chips=campaigns.map(item=>{const s=progressFor(item.id);return '<button type="button" class="pledge-campaign-chip '+(item.id===c.id?'active':'')+'" data-campaign="'+item.id+'"><b>'+esc(item.name)+'</b><span>'+php(s.total_received)+' received of '+php(item.goal_amount)+'</span>'+campaignStatus(item)+'</button>'}).join('');
  root.innerHTML='<section class="pledge-hero card"><div><span class="pledge-kicker">▦ PLEDGE CAMPAIGN</span><h2>'+esc(c.name)+'</h2><p>'+esc(c.description||'Every square represents a concrete step toward the campaign goal.')+'</p></div><div class="pledge-hero-actions">'+(finance()?'<button id="editPledgeCampaign" class="btn secondary" type="button">Edit Campaign</button><button id="newPledgeCampaign" class="btn" type="button">+ New Campaign</button>':'')+'</div></section><div class="pledge-campaign-strip">'+chips+'</div><div class="pledge-stat-grid">'+statCard('Goal Amount',php(goal),Math.round(goal/number(c.square_value))+' squares')+statCard('Total Pledged',php(pledged),pct(pledged,goal)+'% pledge coverage')+statCard('Total Received',php(received),completion+'% of goal')+statCard('Remaining',php(remaining),'Still needed in actual receipts')+statCard('Completion',completion+'%','Based on received funds')+statCard('Pledge Coverage',coverage+'%','Pledged or already received')+'</div>'+squareGrid(c,summary)+'<div class="pledge-detail-grid"><div>'+financeLedger(c)+personalPanel(c)+'</div>'+paymentPanel(c)+'</div>';
  root.querySelectorAll('[data-campaign]').forEach(b=>b.onclick=()=>{selectedCampaignId=b.dataset.campaign;render()});
  document.getElementById('newPledgeCampaign')?.addEventListener('click',()=>campaignForm());
  document.getElementById('editPledgeCampaign')?.addEventListener('click',()=>campaignForm(c));
  document.getElementById('makeMyPledge')?.addEventListener('click',()=>pledgeForm());
  document.getElementById('editMyPledge')?.addEventListener('click',()=>pledgeForm(commitments.find(p=>p.campaign_id===c.id&&p.member_id===currentMemberId()&&p.status!=='cancelled')));
  document.getElementById('addPledge')?.addEventListener('click',()=>pledgeForm());
  document.getElementById('recordPledgePayment')?.addEventListener('click',()=>paymentForm());
  root.querySelectorAll('[data-pledge-edit]').forEach(b=>b.onclick=()=>pledgeForm(commitments.find(p=>p.id===b.dataset.pledgeEdit)));
  root.querySelectorAll('[data-pledge-pay]').forEach(b=>b.onclick=()=>paymentForm(commitments.find(p=>p.id===b.dataset.pledgePay)));
  root.querySelectorAll('[data-payment-void]').forEach(b=>b.onclick=()=>voidPayment(payments.find(p=>p.id===b.dataset.paymentVoid)));
}

function modal(title,body,onSubmit,saveLabel='Save'){
  document.getElementById('pledgeModal')?.remove();
  const wrap=document.createElement('div');wrap.id='pledgeModal';wrap.className='pledge-modal';
  wrap.innerHTML='<div class="pledge-modal-card"><div class="pledge-modal-head"><h3>'+esc(title)+'</h3><button class="pledge-modal-close" type="button" aria-label="Close">×</button></div><form id="pledgeModalForm">'+body+'<div class="pledge-modal-actions"><button class="btn secondary pledge-cancel" type="button">Cancel</button><button class="btn" type="submit">'+esc(saveLabel)+'</button></div><div class="pledge-modal-msg" role="status"></div></form></div>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();wrap.querySelector('.pledge-modal-close').onclick=close;wrap.querySelector('.pledge-cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  wrap.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button[type="submit"]'),msg=wrap.querySelector('.pledge-modal-msg');button.disabled=true;button.textContent='Saving…';msg.textContent='';try{await onSubmit(new FormData(e.currentTarget));close()}catch(error){msg.textContent=error.message||String(error);button.disabled=false;button.textContent=saveLabel}};
}

function campaignForm(c=null){
  if(!finance())return;
  modal(c?'Edit Pledge Campaign':'New Pledge Campaign','<label>Campaign name<input name="name" required value="'+attr(c?.name||'')+'" placeholder="Building Fund Campaign"></label><div class="pledge-form-grid"><label>Goal amount<input name="goal_amount" type="number" min="1" step="1" required value="'+attr(c?.goal_amount||'100000')+'"></label><label>Value per square<input name="square_value" type="number" min="1" step="1" required value="'+attr(c?.square_value||'1000')+'"></label><label>Start date<input name="start_date" type="date" required value="'+attr(c?.start_date||today())+'"></label><label>End date<input name="end_date" type="date" value="'+attr(c?.end_date||'')+'"></label><label>Status<select name="status">'+['draft','active','completed','cancelled'].map(s=>'<option value="'+s+'" '+((c?.status||'active')===s?'selected':'')+'>'+s.charAt(0).toUpperCase()+s.slice(1)+'</option>').join('')+'</select></label></div><label>Description<textarea name="description" rows="4" placeholder="What is this campaign for?">'+esc(c?.description||'')+'</textarea></label><div class="hint">For a clean square grid, the goal must be evenly divisible by the square value. ₱1,000 per square is the default.</div>',async f=>{
    const goal=number(f.get('goal_amount')),unit=number(f.get('square_value'));if(goal<=0||unit<=0)throw new Error('Goal and square value must be greater than zero.');if(Math.abs(goal/unit-Math.round(goal/unit))>.000001)throw new Error('Choose a goal that is evenly divisible by the square value.');
    const payload={name:String(f.get('name')||'').trim(),goal_amount:goal,square_value:unit,start_date:f.get('start_date'),end_date:f.get('end_date')||null,status:f.get('status'),description:String(f.get('description')||'').trim()||null,updated_at:new Date().toISOString()};
    let result;if(c)result=await sb().from('pledge_campaigns').update(payload).eq('id',c.id).select().single();else result=await sb().from('pledge_campaigns').insert({...payload,created_by:currentUserId()}).select().single();if(result.error)throw result.error;selectedCampaignId=result.data.id;await audit(c?'update':'create','pledge_campaigns',result.data.id,{name:payload.name,goal_amount:goal,square_value:unit});await refresh(false);
  },c?'Save Changes':'Create Campaign');
}

function pledgeForm(existing=null){
  const c=selectedCampaign();if(!c||c.status!=='active')return;
  const mine=currentMember();
  if(!finance()&&!mine){alert('Your account is not linked to a member profile yet.');return;}
  const members=directory.slice().sort((a,b)=>memberName(a).localeCompare(memberName(b)));
  const selected=existing?.member_id||(finance()?'':mine?.id)||'';
  const memberField=finance()?'<label>Member<select name="member_id" required><option value="">Select member</option>'+members.map(m=>'<option value="'+attr(m.id)+'" '+(m.id===selected?'selected':'')+'>'+esc(memberName(m))+(m.member_code?' · '+esc(m.member_code):'')+'</option>').join('')+'</select></label>':'<div class="pledge-personal-card" style="margin-bottom:12px"><b>'+esc(memberName(mine))+'</b><div class="hint">This pledge will be linked to your member profile.</div></div><input type="hidden" name="member_id" value="'+attr(mine.id)+'">';
  modal(existing?'Update Pledge':'Make a Pledge',memberField+'<div class="pledge-form-grid"><label>Pledge amount<input name="pledged_amount" type="number" min="1" step="1" required value="'+attr(existing?.pledged_amount||'')+'" placeholder="5000"></label><label>Target completion date<input name="target_date" type="date" value="'+attr(existing?.target_date||c.end_date||'')+'"></label></div><label>Status<select name="status"><option value="active" '+(existing?.status!=='cancelled'?'selected':'')+'>Active</option><option value="cancelled" '+(existing?.status==='cancelled'?'selected':'')+'>Cancelled</option></select></label><label>Note<textarea name="notes" rows="3" placeholder="Optional note">'+esc(existing?.notes||'')+'</textarea></label>',async f=>{
    const memberId=String(f.get('member_id')||''),m=memberById(memberId);if(!memberId||!m)throw new Error('Select a valid member.');const amount=number(f.get('pledged_amount'));if(amount<=0)throw new Error('Enter a valid pledge amount.');
    const found=existing||commitments.find(p=>p.campaign_id===c.id&&p.member_id===memberId);
    const payload={campaign_id:c.id,member_id:memberId,member_name:memberName(m),pledged_amount:amount,target_date:f.get('target_date')||null,notes:String(f.get('notes')||'').trim()||null,status:f.get('status')||'active',updated_at:new Date().toISOString()};
    let result;if(found)result=await sb().from('pledge_commitments').update(payload).eq('id',found.id).select().single();else result=await sb().from('pledge_commitments').insert({...payload,created_by:currentUserId()}).select().single();if(result.error)throw result.error;await audit(found?'update':'create','pledge_commitments',result.data.id,{campaign_id:c.id,member_id:memberId,amount});await refresh(false);
  },existing?'Save Pledge':'Save Pledge');
}

function paymentForm(prefill=null){
  if(!finance())return;const c=selectedCampaign();if(!c)return;
  const available=pledgesFor(c.id).filter(p=>p.status==='active');if(!available.length){alert('Add a pledge before recording a payment.');return;}
  const selected=prefill?.id||available[0].id;
  modal('Record Pledge Payment','<label>Pledge<select name="pledge_id" required>'+available.map(p=>{const balance=Math.max(number(p.pledged_amount)-paidForPledge(p.id),0);return '<option value="'+attr(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.member_name)+' · '+php(balance)+' remaining</option>'}).join('')+'</select></label><div class="pledge-form-grid"><label>Amount received<input name="amount" type="number" min="1" step="0.01" required></label><label>Date received<input name="paid_on" type="date" required value="'+today()+'"></label><label>Payment method<select name="payment_method"><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Other</option></select></label><label>Reference number<input name="reference_no" placeholder="Optional"></label></div><label>Notes<textarea name="notes" rows="3" placeholder="Optional notes"></textarea></label><div class="hint">Payments are never deleted. If a payment is encoded incorrectly, use Void so the audit history is preserved.</div>',async f=>{
    const pledge=commitments.find(p=>p.id===f.get('pledge_id'));if(!pledge)throw new Error('Select a valid pledge.');const amount=number(f.get('amount'));if(amount<=0)throw new Error('Enter a valid payment amount.');const payload={pledge_id:pledge.id,campaign_id:c.id,member_id:pledge.member_id,member_name:pledge.member_name,amount,paid_on:f.get('paid_on'),payment_method:f.get('payment_method')||'Cash',reference_no:String(f.get('reference_no')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,status:'posted',recorded_by:currentUserId(),updated_at:new Date().toISOString()};const result=await sb().from('pledge_payments').insert(payload).select().single();if(result.error)throw result.error;await audit('create','pledge_payments',result.data.id,{campaign_id:c.id,pledge_id:pledge.id,member_id:pledge.member_id,amount});await refresh(false);
  },'Record Payment');
}

async function voidPayment(payment){
  if(!finance()||!payment||payment.status!=='posted')return;const reason=prompt('Reason for voiding this payment:');if(reason===null)return;if(!String(reason).trim()){alert('A void reason is required.');return;}const result=await sb().from('pledge_payments').update({status:'voided',voided_at:new Date().toISOString(),voided_by:currentUserId(),void_reason:String(reason).trim(),updated_at:new Date().toISOString()}).eq('id',payment.id).select().single();if(result.error){alert(result.error.message);return}await audit('void','pledge_payments',payment.id,{campaign_id:payment.campaign_id,amount:payment.amount,reason:String(reason).trim()});await refresh(false);
}

async function refresh(showLoading=true){
  ensureView();if(!root||loading)return;if(!finance()){root.innerHTML='<div class="notice">Pledges is restricted to pastors, administrators, treasurers, and members of the Treasurer ministry.</div>';return}loading=true;if(showLoading)root.innerHTML='<div class="pledge-loading card">Loading pledge campaigns…</div>';
  try{await loadAll();render()}catch(error){console.error('VCCF Pledges',error);root.innerHTML='<div class="notice">Pledges could not be loaded. '+esc(error.message||'Please try again.')+'</div>'}finally{loading=false}
}

async function open(){if(!finance())return;activateShell();await refresh();}
window.VCCFPledges={open,refresh,mount:open,unmount:()=>{}};

window.addEventListener('vccf-app-ready',()=>setTimeout(()=>scheduleInstall(),80));
window.addEventListener('vccf-signed-out',()=>{campaigns=[];progress=[];commitments=[];payments=[];directory=[];selectedCampaignId='';root=null});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>scheduleInstall(),120),{once:true});else setTimeout(()=>scheduleInstall(),120);
})();