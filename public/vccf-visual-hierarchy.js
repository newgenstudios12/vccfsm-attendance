(()=>{
'use strict';
if(window.__VCCF_VISUAL_HIERARCHY__)return;
window.__VCCF_VISUAL_HIERARCHY__=true;
const style=document.createElement('style');
style.id='vccfVisualHierarchy';
style.textContent=`
:root{
  --section-outline:#d8dde6;
  --section-surface:#ffffff;
  --section-soft:#f7f8fa;
  --section-soft-2:#f1f3f6;
  --section-shadow:0 8px 22px rgba(15,23,42,.07),0 1px 2px rgba(15,23,42,.04);
  --section-shadow-hover:0 12px 30px rgba(15,23,42,.10),0 2px 4px rgba(15,23,42,.05);
}
:root[data-theme="dark"]{
  --section-outline:#3a404a;
  --section-surface:#1a1d23;
  --section-soft:#20242b;
  --section-soft-2:#262b33;
  --section-shadow:0 10px 28px rgba(0,0,0,.25),0 1px 2px rgba(0,0,0,.22);
  --section-shadow-hover:0 14px 34px rgba(0,0,0,.32),0 2px 5px rgba(0,0,0,.24);
}
html:not([data-theme="dark"]) body,
html:not([data-theme="dark"]) .layout{background:#f2f4f7!important}
html[data-theme="dark"] body,
html[data-theme="dark"] .layout{background:#0f1115!important}

/* Major section surfaces */
.app.show .card,
.app.show .panel,
.app.show .stat,
.app.show .cms-panel,
.app.show .notify-card,
.app.show .notify-inbox,
.app.show .push-only-item,
.app.show .settings-card,
.app.show .attendance-action-card,
.app.show .attendance-records,
.app.show .member-profile-card,
.app.show .member-metric-card{
  border:1px solid var(--section-outline)!important;
}
.app.show .card,
.app.show .panel,
.app.show .cms-panel,
.app.show .settings-card,
.app.show .attendance-action-card,
.app.show .attendance-records,
.app.show .member-profile-card,
.app.show .member-metric-card,
.app.show .notify-inbox{
  box-shadow:var(--section-shadow)!important;
}

/* Brand cue only on ordinary section containers. Hero/banner cards keep their own pseudo-elements. */
.app.show .view > .card:not(.welcome-banner),
.app.show .view > .panel:not(.welcome-banner),
.app.show #church .cms-panel,
.app.show #notifications .notify-inbox,
.app.show #settings .settings-card,
.app.show .attendance-action-card,
.app.show .attendance-records,
.app.show .member-profile-card,
.app.show .member-metric-card{
  position:relative;
}
.app.show .view > .card:not(.welcome-banner)::before,
.app.show .view > .panel:not(.welcome-banner)::before,
.app.show #church .cms-panel::before,
.app.show #notifications .notify-inbox::before,
.app.show #settings .settings-card::before,
.app.show .attendance-action-card::before,
.app.show .attendance-records::before,
.app.show .member-profile-card::before,
.app.show .member-metric-card::before{
  content:"";
  position:absolute;
  top:0;
  left:18px;
  right:18px;
  height:3px;
  border-radius:0 0 999px 999px;
  background:linear-gradient(90deg,var(--brand),var(--brand2));
  opacity:.72;
  pointer-events:none;
}

/* Preserve the Dashboard hero image layer even if another card rule touched ::before. */
.app.show #dashboard .welcome-banner::before{
  content:""!important;
  position:absolute!important;
  inset:0!important;
  width:auto!important;
  height:auto!important;
  border-radius:0!important;
  background-image:var(--welcome-banner-image,url('/assets/vccf-dashboard-welcome.jpg?v=20260903-2'))!important;
  background-position:center 48%!important;
  background-size:cover!important;
  background-repeat:no-repeat!important;
  opacity:.5!important;
  z-index:-2!important;
  pointer-events:none!important;
}

/* Secondary information blocks */
.app.show .stat,
.app.show .cms-stat,
.app.show .metric,
.app.show .giving-item,
.app.show .m360-box,
.app.show .m360-summary,
.app.show .notify-card,
.app.show .push-only-item,
.app.show .service-summary-card,
.app.show .event-summary-card{
  background:var(--section-surface)!important;
  border:1px solid var(--section-outline)!important;
  box-shadow:0 2px 8px rgba(15,23,42,.045)!important;
}
.app.show .m360-box,
.app.show .m360-summary,
.app.show .giving-item,
.app.show .metric{
  background:var(--section-soft)!important;
  box-shadow:none!important;
}
html[data-theme="dark"] .app.show .stat,
html[data-theme="dark"] .app.show .cms-stat,
html[data-theme="dark"] .app.show .notify-card,
html[data-theme="dark"] .app.show .push-only-item{
  box-shadow:0 3px 10px rgba(0,0,0,.20)!important;
}

/* Stronger section rhythm */
.app.show .stats,
.app.show .grid,
.app.show .cms-grid,
.app.show .cms-content,
.app.show .cms-shell,
.app.show .cms-stats,
.app.show .m360-grid,
.app.show .m360-summary-grid,
.app.show .giving-summary,
.app.show .attendance-workflow,
.app.show .notify-grid,
.app.show .push-only-panel{
  gap:16px!important;
}
.app.show .view{padding-bottom:24px}

/* Clear headers inside cards */
.app.show .cms-panel-head,
.app.show .members-head,
.app.show .attendance-card-title,
.app.show .attendance-records-head,
.app.show .notify-card-head,
.app.show .notify-inbox-head,
.app.show .dashboard-announcement-head,
.app.show .m360-head{
  padding-bottom:13px;
  margin-bottom:16px!important;
  border-bottom:1px solid var(--section-outline);
}
.app.show .cms-panel-head h3,
.app.show .attendance-card-title h2,
.app.show .attendance-records h2,
.app.show .notify-card h3,
.app.show .notify-inbox h3,
.app.show .settings-card h2,
.app.show .settings-card h3{
  letter-spacing:-.015em;
}

/* Tables and rows sit on a quieter inner layer */
.app.show .table-wrap{
  border:1px solid var(--section-outline);
  border-radius:13px;
  overflow:auto;
  background:var(--section-surface);
}
.app.show .table th{
  background:var(--section-soft);
  border-bottom:1px solid var(--section-outline)!important;
}
.app.show .table td{border-bottom-color:var(--section-outline)!important}
.app.show .table tbody tr:last-child td{border-bottom:0}
.app.show .cms-list-row,
.app.show .m360-row,
.app.show .dashboard-announcement-row{
  border-bottom-color:var(--section-outline)!important;
}

/* Inputs should visually belong to the section without disappearing into it */
.app.show input,
.app.show select,
.app.show textarea{
  border-color:var(--section-outline)!important;
}
.app.show input:focus,
.app.show select:focus,
.app.show textarea:focus{
  border-color:var(--brand)!important;
  box-shadow:0 0 0 3px var(--brand-soft)!important;
}

/* Bible Study preview fallback button */
.vccf-bible-preview-fallback{border:1px solid var(--section-outline);background:var(--section-surface);color:var(--text);border-radius:10px;padding:9px 11px;font:inherit;font-size:.72rem;font-weight:900;cursor:pointer}
.vccf-bible-preview-fallback:hover{border-color:var(--brand);color:var(--brand)}

@media (hover:hover){
  .app.show .member-row:hover td{background:var(--section-soft)!important}
  .app.show .notify-card:hover,
  .app.show .push-only-item:hover{box-shadow:var(--section-shadow-hover)!important}
}

@media(max-width:700px){
  .app.show .stats,
  .app.show .grid,
  .app.show .cms-grid,
  .app.show .cms-content,
  .app.show .cms-shell,
  .app.show .cms-stats,
  .app.show .m360-grid,
  .app.show .m360-summary-grid,
  .app.show .giving-summary,
  .app.show .attendance-workflow,
  .app.show .notify-grid,
  .app.show .push-only-panel{gap:12px!important}
  .app.show .view > .card:not(.welcome-banner)::before,
  .app.show .view > .panel:not(.welcome-banner)::before,
  .app.show #church .cms-panel::before,
  .app.show #notifications .notify-inbox::before,
  .app.show #settings .settings-card::before,
  .app.show .attendance-action-card::before,
  .app.show .attendance-records::before,
  .app.show .member-profile-card::before,
  .app.show .member-metric-card::before{left:14px;right:14px}
  .app.show .cms-panel-head,
  .app.show .members-head,
  .app.show .attendance-card-title,
  .app.show .attendance-records-head,
  .app.show .notify-card-head,
  .app.show .notify-inbox-head,
  .app.show .dashboard-announcement-head,
  .app.show .m360-head{padding-bottom:11px;margin-bottom:13px!important}
}
`;
document.head.appendChild(style);

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const areaName=id=>(state().areas||[]).find(a=>String(a.id)===String(id))?.name||'Church-wide';
const fmtDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'—';
const fmtStamp=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)):'—';
const normalizedType=()=>String(document.getElementById('serviceAttendanceType')?.value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
let previewRepairTimer=0;

function previewRate(row){const attendance=Number(row.attendance_count||0),base=Number(row.member_count||0);return base?Math.round(attendance/base*100):0}
function closeFallbackPreview(){document.getElementById('serviceSummaryPreviewOverlay')?.remove()}
function openFallbackPreview(row){
  if(!row)return;
  closeFallbackPreview();
  const status=String(row.workflow_status||'draft').toLowerCase();
  const statusLabel=({draft:'Draft',submitted:'Submitted',approved:'Approved'})[status]||'Draft';
  const location=(row.area_id?areaName(row.area_id):'Church-wide')+(row.barangay?' · '+row.barangay:'');
  const wrap=document.createElement('div');
  wrap.id='serviceSummaryPreviewOverlay';
  wrap.className='service-summary-preview-overlay';
  wrap.setAttribute('role','dialog');
  wrap.setAttribute('aria-modal','true');
  wrap.setAttribute('aria-label','Bible Study Summary preview');
  wrap.innerHTML=`<div class="service-summary-preview-card"><div class="service-summary-preview-head"><div><span class="service-summary-preview-kicker">BIBLE STUDY SUMMARY</span><h3>${esc(row.title||'Bible Study Summary')}</h3><p>${esc(fmtDate(row.summary_date))} · ${esc(location)}</p></div><button class="service-summary-preview-x" type="button" aria-label="Close preview">×</button></div><div class="service-summary-preview-body"><div><span class="service-summary-gallery-status ${esc(status)}">${esc(statusLabel)}</span></div><div class="service-summary-preview-stats"><div><span>Attendance</span><strong>${Number(row.attendance_count||0)}</strong></div><div><span>Attendance Rate</span><strong>${previewRate(row)}%</strong></div><div><span>Active Area Members</span><strong>${Number(row.member_count||0)}</strong></div></div><div class="service-summary-preview-notes"><span>Summary notes</span><p>${esc(row.notes||'No summary notes were recorded.')}</p></div><div class="service-summary-preview-meta"><div><span>Submitted</span><b>${esc(fmtStamp(row.submitted_at))}</b></div><div><span>Approved</span><b>${esc(fmtStamp(row.approved_at))}</b></div></div></div><div class="service-summary-preview-actions"><button class="btn secondary" type="button" data-vccf-close-fallback-preview>Close</button></div></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.service-summary-preview-x')?.addEventListener('click',closeFallbackPreview);
  wrap.querySelector('[data-vccf-close-fallback-preview]')?.addEventListener('click',closeFallbackPreview);
  wrap.addEventListener('click',e=>{if(e.target===wrap)closeFallbackPreview()});
}
async function fetchSummaryById(id){
  if(!id||!sb())return null;
  const r=await sb().from('cms_service_summaries').select('id,title,summary_date,area_id,barangay,attendance_count,member_count,notes,workflow_status,submitted_at,approved_at').eq('id',id).maybeSingle();
  return r.error?null:r.data;
}
async function fetchCurrentBibleSummary(){
  if(!sb()||normalizedType()!=='bible_study')return null;
  const day=document.getElementById('serviceAttendanceDate')?.value||'';
  const area=document.getElementById('serviceStudyArea')?.value||'';
  const barangay=String(document.getElementById('serviceStudyBarangay')?.value||'').trim();
  if(!day||!area||!barangay)return null;
  let q=sb().from('cms_service_summaries').select('id,title,summary_date,area_id,barangay,attendance_count,member_count,notes,workflow_status,submitted_at,approved_at').eq('summary_type','Bible Study').eq('summary_date',day).eq('area_id',area).eq('barangay',barangay);
  const r=await q.maybeSingle();
  return r.error?null:r.data;
}
function repairBibleStudyPreviewControls(){
  if(normalizedType()!=='bible_study')return;
  const host=document.getElementById('serviceSummaryHost');
  if(!host)return;
  host.querySelectorAll('.service-summary-gallery-card[data-summary-id]').forEach(card=>{
    if(card.querySelector('[data-preview-service-summary]'))return;
    const body=card.querySelector('.service-summary-gallery-body');
    if(!body)return;
    const b=document.createElement('button');
    b.type='button';b.className='service-summary-gallery-open';b.dataset.previewServiceSummary=card.dataset.summaryId||'';b.textContent='Preview summary →';
    body.appendChild(b);
  });
  const current=host.querySelector(':scope > .service-summary-card');
  const actions=current?.querySelector('.service-summary-actions');
  if(actions&&!actions.querySelector('[data-vccf-current-bible-preview]')){
    const b=document.createElement('button');
    b.type='button';b.className='vccf-bible-preview-fallback';b.dataset.vccfCurrentBiblePreview='1';b.textContent='Preview summary';
    b.addEventListener('click',async()=>{const row=await fetchCurrentBibleSummary();if(row)openFallbackPreview(row)});
    actions.appendChild(b);
  }
}
function queuePreviewRepair(){clearTimeout(previewRepairTimer);previewRepairTimer=setTimeout(repairBibleStudyPreviewControls,140)}
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-preview-service-summary]');
  if(!b)return;
  const id=b.dataset.previewServiceSummary||'';
  setTimeout(async()=>{if(document.getElementById('serviceSummaryPreviewOverlay'))return;const row=await fetchSummaryById(id);if(row)openFallbackPreview(row)},160);
},true);
new MutationObserver(queuePreviewRepair).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('vccf-app-ready',queuePreviewRepair);
window.addEventListener('focus',queuePreviewRepair);
document.addEventListener('change',e=>{if(e.target?.id==='serviceAttendanceType'||e.target?.id==='serviceStudyArea'||e.target?.id==='serviceStudyBarangay'||e.target?.id==='serviceAttendanceDate')queuePreviewRepair()});
queuePreviewRepair();
})();
