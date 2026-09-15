(()=>{
'use strict';
if(window.__VCCF_GIVING_TABS__)return;
window.__VCCF_GIVING_TABS__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'').toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=v=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(v)||0);
const monthKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit'}).format(new Date());
const monthBounds=month=>{const [y,m]=String(month||monthKey()).split('-').map(Number),nm=m===12?1:m+1,ny=m===12?y+1:y;return {start:String(y)+'-'+String(m).padStart(2,'0')+'-01',end:String(ny)+'-'+String(nm).padStart(2,'0')+'-01'}};
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const areaName=id=>(state().areas||[]).find(a=>String(a.id)===String(id))?.name||'Unassigned';
const isSunday=day=>day&&new Date(day+'T12:00:00+08:00').getDay()===0;

let activeTab='sunday';
try{activeTab=sessionStorage.getItem('vccf-giving-subtab')==='bible'?'bible':'sunday'}catch(_){ }
let timer=0;
let standardRequest=0;
let areaRequest=0;
let standardRows=[];
let directory=[];
let standardMonth='';

function ensureStyles(){
  if(document.getElementById('vccfGivingTabsStyle'))return;
  const style=document.createElement('style');
  style.id='vccfGivingTabsStyle';
  style.textContent=`
.vccf-giving-tabs{display:flex;gap:8px;align-items:center;margin:14px 0 16px;padding:5px;border:1px solid var(--line);border-radius:14px;background:var(--card-soft,var(--card));overflow-x:auto;-webkit-overflow-scrolling:touch}
.vccf-giving-tab{border:0;background:transparent;color:var(--muted);padding:10px 14px;border-radius:10px;font:inherit;font-size:.78rem;font-weight:900;white-space:nowrap;cursor:pointer;min-height:42px}
.vccf-giving-tab.active{background:var(--card);color:var(--brand);box-shadow:0 1px 4px rgba(15,23,42,.08)}
.vccf-giving-tab:focus-visible{outline:3px solid rgba(215,25,32,.16);outline-offset:1px}
.vccf-giving-tab-placeholder{padding:20px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);font-size:.8rem;text-align:center;background:var(--card-soft,var(--card));margin:0 0 16px}
.vccf-area-sunday-ledger{padding:20px}.vccf-area-sunday-ledger h3{margin:0 0 5px}.vccf-area-sunday-ledger p{margin:0;color:var(--muted);font-size:.78rem;line-height:1.5}
.vccf-area-ledger-head{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:12px}.vccf-area-ledger-head label{font-size:.72rem;font-weight:800}.vccf-area-ledger-head input{display:block;margin-top:5px;min-height:42px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text)}
.vccf-area-ledger-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.vccf-area-ledger-stat{padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--card-soft,var(--card))}.vccf-area-ledger-stat span{display:block;color:var(--muted);font-size:.68rem;font-weight:900}.vccf-area-ledger-stat strong{display:block;margin-top:4px;font-size:1.08rem}.vccf-area-ledger-table{overflow:auto}.vccf-area-ledger-table table{width:100%;border-collapse:collapse;min-width:650px}.vccf-area-ledger-table th,.vccf-area-ledger-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:.78rem}.vccf-area-ledger-table th{font-size:.66rem;text-transform:uppercase;color:var(--muted)}
@media(max-width:700px){.vccf-giving-tabs{display:grid;grid-template-columns:1fr 1fr}.vccf-giving-tab{white-space:normal;line-height:1.25;padding:10px 8px}.vccf-area-ledger-stats{grid-template-columns:1fr}.vccf-area-ledger-head{align-items:stretch}.vccf-area-ledger-head label,.vccf-area-ledger-head input{width:100%}}
`;
  document.head.appendChild(style);
}

function rememberTab(tab){
  activeTab=tab==='bible'?'bible':'sunday';
  try{sessionStorage.setItem('vccf-giving-subtab',activeTab)}catch(_){ }
}

function tabBar(id){
  const bar=document.createElement('div');
  bar.id=id;
  bar.className='vccf-giving-tabs';
  bar.setAttribute('role','tablist');
  bar.setAttribute('aria-label','Tithes and Offerings sections');
  bar.innerHTML='<button type="button" class="vccf-giving-tab" data-vccf-giving-tab="sunday" role="tab">Sunday Tithes &amp; Offerings</button><button type="button" class="vccf-giving-tab" data-vccf-giving-tab="bible" role="tab">Bible Study Tithes &amp; Offerings</button>';
  bar.querySelectorAll('[data-vccf-giving-tab]').forEach(button=>button.addEventListener('click',()=>{rememberTab(button.dataset.vccfGivingTab);applyAll(true)}));
  return bar;
}

function paintTabs(bar){
  bar?.querySelectorAll('[data-vccf-giving-tab]').forEach(button=>{
    const on=button.dataset.vccfGivingTab===activeTab;
    button.classList.toggle('active',on);
    button.setAttribute('aria-selected',String(on));
    button.tabIndex=on?0:-1;
  });
}

function standardFilters(rows){
  const member=document.getElementById('givingMemberFilter')?.value||'';
  const type=document.getElementById('givingTypeFilter')?.value||'';
  const query=String(document.getElementById('givingSearch')?.value||'').trim().toLowerCase();
  const members=directory.length?directory:(state().members||[]);
  const map=new Map(members.map(m=>[String(m.id),m]));
  return rows.filter(row=>{
    if(row.bible_study_batch_id)return false;
    const m=map.get(String(row.member_id));
    const hay=(memberName(m)+' '+(m?.member_code||'')+' '+(row.reference_no||'')+' '+(row.payment_method||'')).toLowerCase();
    return (!member||String(row.member_id)===String(member))&&(!type||String(row.giving_type||'').toLowerCase()===String(type).toLowerCase())&&(!query||hay.includes(query));
  });
}

async function loadStandardRows(force=false){
  const root=document.getElementById('giving');
  if(!root||!root.querySelector('.giving-hero'))return [];
  const month=document.getElementById('givingMonth')?.value||monthKey();
  if(!force&&standardMonth===month&&standardRows.length)return standardRows;
  const client=sb();if(!client)return [];
  const request=++standardRequest,bounds=monthBounds(month);
  const [ledger,dir]=await Promise.all([
    client.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes,sunday_batch_id,bible_study_batch_id').gte('given_on',bounds.start).lt('given_on',bounds.end).order('given_on',{ascending:false}).order('created_at',{ascending:false}),
    directory.length?Promise.resolve({data:directory,error:null}):client.rpc('get_giving_member_directory')
  ]);
  if(request!==standardRequest)return standardRows;
  if(ledger.error){console.warn('Giving tab separation:',ledger.error);return standardRows}
  standardRows=ledger.data||[];standardMonth=month;
  if(!dir?.error&&dir?.data)directory=dir.data;
  return standardRows;
}

function updateStandardStats(){
  const rows=standardFilters(standardRows);
  const tithes=rows.filter(r=>String(r.giving_type||'').toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0);
  const offerings=rows.filter(r=>String(r.giving_type||'').toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0);
  const stats=document.getElementById('givingStats');
  if(!stats||stats.children.length<4)return;
  const values=[php(tithes),php(offerings),php(tithes+offerings),String(rows.length)];
  [...stats.children].slice(0,4).forEach((card,i)=>{const strong=card.querySelector('strong');if(strong)strong.textContent=values[i]});
}

function hideBibleRowsFromSundayLedger(){
  const map=new Map(standardRows.map(r=>[String(r.id),r]));
  document.querySelectorAll('#givingTable tbody tr').forEach(row=>{
    const button=row.querySelector('[data-giving-edit],[data-giving-delete]');
    const id=row.dataset.vccfGivingRecordId||button?.dataset.givingEdit||button?.dataset.givingDelete||'';
    if(id)row.dataset.vccfGivingRecordId=id;
    const record=id?map.get(String(id)):null;
    const workflow=String(row.children?.[4]?.textContent||'').toLowerCase();
    const bible=Boolean(record?.bible_study_batch_id)||workflow.includes('bible study');
    row.dataset.vccfBibleStudyGiving=bible?'1':'0';
    row.hidden=bible;
  });
  const ledger=document.querySelector('#giving .giving-ledger');
  const title=ledger?.querySelector('.giving-ledger-head h3');
  const copy=ledger?.querySelector('.giving-ledger-head p');
  if(title)title.textContent='Sunday Giving Ledger';
  if(copy)copy.textContent='Sunday and general giving only. Bible Study records are kept in the Bible Study tab.';
}

function ensureStandardTabs(root){
  const hero=root.querySelector('.giving-hero');if(!hero)return;
  let bar=document.getElementById('vccfGivingSectionTabs');
  if(!bar){bar=tabBar('vccfGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}
  paintTabs(bar);
  root.dataset.vccfGivingTab=activeTab;
  const sundayNodes=[root.querySelector('.sunday-giving'),root.querySelector('#givingStats'),root.querySelector('.giving-ledger'),root.querySelector('.giving-privacy-note')].filter(Boolean);
  sundayNodes.forEach(node=>node.hidden=activeTab!=='sunday');
  const add=root.querySelector('#addGivingRecord');if(add)add.hidden=activeTab!=='sunday';
  const bible=root.querySelector('#bibleStudyGivingFinance');if(bible)bible.hidden=activeTab!=='bible';
  let pending=document.getElementById('vccfBibleGivingPending');
  if(activeTab==='bible'&&!bible){
    if(!pending){pending=document.createElement('div');pending.id='vccfBibleGivingPending';pending.className='vccf-giving-tab-placeholder';pending.textContent='Loading Bible Study Tithes & Offerings…';bar.insertAdjacentElement('afterend',pending)}
  }else pending?.remove();
  if(activeTab==='sunday')hideBibleRowsFromSundayLedger();
}

async function refreshStandard(force=false){
  const root=document.getElementById('giving');if(!root?.querySelector('.giving-hero'))return;
  ensureStandardTabs(root);
  await loadStandardRows(force);
  if(!root.isConnected)return;
  ensureStandardTabs(root);
  updateStandardStats();
}

async function exportSundayCsv(){
  await loadStandardRows(true);
  const rows=standardFilters(standardRows),members=directory.length?directory:(state().members||[]),map=new Map(members.map(m=>[String(m.id),m]));
  const values=[['Date','Member','Member Code','Area','Type','Amount','Sunday Workflow','Payment Method','Reference','Notes']];
  rows.forEach(r=>{const m=map.get(String(r.member_id));values.push([r.given_on,memberName(m),m?.member_code||'',m?areaName(m.area_id):'',r.giving_type,Number(r.amount||0).toFixed(2),r.sunday_batch_id?'Sunday batch':'',r.payment_method||'',r.reference_no||'',r.notes||''])});
  const csv=values.map(cols=>cols.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='vccf-sunday-tithes-offerings-'+(document.getElementById('givingMonth')?.value||monthKey())+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

async function safeStartSunday(button){
  const day=document.getElementById('sundayGivingDate')?.value||'';
  if(!isSunday(day)){alert('Choose a Sunday date.');return}
  const client=sb();if(!client)return;
  button.disabled=true;const old=button.textContent;button.textContent='Starting…';
  try{
    const create=await client.from('sunday_giving_batches').insert({sunday_date:day,recorded_by:state().session?.user?.id||null,workflow_status:'draft'}).select('*').single();
    if(create.error)throw create.error;
    const attach=await client.from('giving_records').update({sunday_batch_id:create.data.id}).eq('given_on',day).is('sunday_batch_id',null).is('bible_study_batch_id',null);
    if(attach.error)alert('Sunday batch was created, but existing Sunday records could not be attached: '+attach.error.message);
    window.dispatchEvent(new CustomEvent('vccf-sunday-giving-updated',{detail:{date:day,status:'draft'}}));
    standardMonth='';standardRows=[];
    await window.VCCFGiving?.refresh?.();
  }catch(error){alert(error?.message||'Unable to start Sunday giving.');button.disabled=false;button.textContent=old}
}

async function loadAreaSundayRows(month){
  const client=sb();if(!client)return {rows:[],members:[]};
  const request=++areaRequest,bounds=monthBounds(month);
  const [ledger,dir]=await Promise.all([
    client.from('giving_records').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,bible_study_batch_id').gte('given_on',bounds.start).lt('given_on',bounds.end).order('given_on',{ascending:false}).order('created_at',{ascending:false}),
    client.rpc('get_giving_member_directory')
  ]);
  if(request!==areaRequest)return null;
  if(ledger.error)throw ledger.error;if(dir.error)throw dir.error;
  const areaId=state().profile?.area_id;
  const members=(dir.data||[]).filter(m=>String(m.area_id||'')===String(areaId||''));
  return {rows:(ledger.data||[]).filter(r=>!r.bible_study_batch_id),members};
}

async function renderAreaSundayLedger(root,monthValue){
  const wrap=root.querySelector('.alg-wrap');if(!wrap)return;
  const month=monthValue||document.getElementById('vccfAreaSundayMonth')?.value||document.getElementById('algMonth')?.value||monthKey();
  let card=document.getElementById('vccfAreaSundayLedger');
  if(!card){card=document.createElement('section');card.id='vccfAreaSundayLedger';card.className='card vccf-area-sunday-ledger';const legacy=root.querySelector('.alg-ledger');legacy?.insertAdjacentElement('afterend',card)}
  card.innerHTML='<div class="vccf-giving-tab-placeholder">Loading Sunday giving for '+esc(month)+'…</div>';
  try{
    const data=await loadAreaSundayRows(month);if(!data||!card.isConnected)return;
    const map=new Map(data.members.map(m=>[String(m.id),m]));
    const tithes=data.rows.filter(r=>String(r.giving_type||'').toLowerCase()==='tithe').reduce((s,r)=>s+Number(r.amount||0),0),offerings=data.rows.filter(r=>String(r.giving_type||'').toLowerCase()==='offering').reduce((s,r)=>s+Number(r.amount||0),0);
    card.innerHTML='<div class="vccf-area-ledger-head"><div><h3>Sunday Giving Ledger</h3><p>Only Sunday/general giving for '+esc(areaName(state().profile?.area_id))+'. Bible Study entries are kept in the Bible Study tab.</p></div><label>Month<input id="vccfAreaSundayMonth" type="month" value="'+esc(month)+'"></label></div>'+
      '<div class="vccf-area-ledger-stats"><div class="vccf-area-ledger-stat"><span>Tithes</span><strong>'+php(tithes)+'</strong></div><div class="vccf-area-ledger-stat"><span>Offerings</span><strong>'+php(offerings)+'</strong></div><div class="vccf-area-ledger-stat"><span>Total</span><strong>'+php(tithes+offerings)+'</strong></div></div>'+
      '<div class="vccf-area-ledger-table">'+(data.rows.length?'<table><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>'+data.rows.map(r=>{const m=map.get(String(r.member_id));return '<tr><td>'+esc(r.given_on)+'</td><td>'+esc(memberName(m))+'</td><td>'+esc(r.giving_type)+'</td><td><b>'+php(r.amount)+'</b></td><td>'+esc(r.payment_method||'—')+'</td><td>'+esc(r.reference_no||'—')+'</td></tr>'}).join('')+'</tbody></table>':'<div class="vccf-giving-tab-placeholder">No Sunday/general giving records for this month yet.</div>')+'</div>';
    document.getElementById('vccfAreaSundayMonth')?.addEventListener('change',e=>renderAreaSundayLedger(root,e.currentTarget.value||monthKey()));
    card.hidden=activeTab!=='sunday';
  }catch(error){if(card.isConnected)card.innerHTML='<div class="vccf-giving-tab-placeholder">Unable to load Sunday giving. '+esc(error?.message||error)+'</div>'}
}

function ensureAreaTabs(root){
  const wrap=root.querySelector('.alg-wrap'),hero=wrap?.querySelector('.alg-hero');if(!wrap||!hero)return;
  let bar=document.getElementById('vccfAreaGivingSectionTabs');
  if(!bar){bar=tabBar('vccfAreaGivingSectionTabs');hero.insertAdjacentElement('afterend',bar)}
  paintTabs(bar);
  const form=wrap.querySelector('.alg-form-card'),legacy=wrap.querySelector('.alg-ledger'),clean=document.getElementById('vccfAreaSundayLedger'),bible=document.getElementById('areaLeaderBibleStudyGiving');
  if(form)form.hidden=activeTab!=='sunday';
  if(legacy)legacy.hidden=true;
  if(clean)clean.hidden=activeTab!=='sunday';
  if(bible)bible.hidden=activeTab!=='bible';
  let pending=document.getElementById('vccfAreaBibleGivingPending');
  if(activeTab==='bible'&&!bible){if(!pending){pending=document.createElement('div');pending.id='vccfAreaBibleGivingPending';pending.className='vccf-giving-tab-placeholder';pending.textContent='Loading Bible Study Tithes & Offerings for your area…';bar.insertAdjacentElement('afterend',pending)}}else pending?.remove();
}

async function refreshArea(force=false){
  if(role()!=='area_leader')return;
  const root=document.getElementById('giving');if(!root?.querySelector('.alg-wrap'))return;
  ensureAreaTabs(root);
  if(activeTab==='sunday'&&(force||!document.getElementById('vccfAreaSundayLedger')))await renderAreaSundayLedger(root);
  ensureAreaTabs(root);
}

async function applyAll(force=false){
  ensureStyles();
  const root=document.getElementById('giving');if(!root)return;
  if(root.querySelector('.alg-wrap'))await refreshArea(force);else if(root.querySelector('.giving-hero'))await refreshStandard(force);
}

function queue(force=false){clearTimeout(timer);timer=setTimeout(()=>applyAll(force),70)}

new MutationObserver(records=>{
  if(records.some(r=>r.addedNodes?.length||r.removedNodes?.length))queue(false);
}).observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('click',event=>{
  const exportButton=event.target.closest?.('#exportGivingCsv');
  if(exportButton&&activeTab==='sunday'){
    event.preventDefault();event.stopImmediatePropagation();exportSundayCsv();return;
  }
  const start=event.target.closest?.('#startSundayGiving');
  if(start){event.preventDefault();event.stopImmediatePropagation();safeStartSunday(start);return}
},true);

document.addEventListener('change',event=>{if(['givingMonth','givingMemberFilter','givingTypeFilter','algMonth'].includes(event.target?.id)){standardMonth='';standardRows=[];queue(true)}},true);
document.addEventListener('input',event=>{if(event.target?.id==='givingSearch')queue(false)},true);
window.addEventListener('vccf-app-ready',()=>queue(true));
window.addEventListener('vccf-giving-updated',()=>{standardMonth='';standardRows=[];queue(true)});
window.addEventListener('vccf-sunday-giving-updated',()=>{standardMonth='';standardRows=[];queue(true)});
window.addEventListener('vccf-bible-study-giving-updated',()=>{standardMonth='';standardRows=[];queue(true)});
window.addEventListener('focus',()=>queue(false));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queue(true),{once:true});else queue(true);
})();