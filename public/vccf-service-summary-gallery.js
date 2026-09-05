(()=>{
'use strict';
if(window.__VCCF_SERVICE_SUMMARY_GALLERY_V2__)return;
window.__VCCF_SERVICE_SUMMARY_GALLERY_V2__=true;

const state=()=>window.VCCF?.getState?.()||{};
const sb=()=>window.VCCF?.sb;
const role=()=>String(state().profile?.role||'member').toLowerCase();
const ownAreaId=()=>role()==='area_leader'?(state().profile?.area_id||''):'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const areaName=id=>(state().areas||[]).find(a=>String(a.id)===String(id))?.name||'Church-wide';
const fmtDate=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(v+'T12:00:00+08:00')):'—';
const fmtStamp=v=>v?new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v)):'—';
const statusLabel=v=>({draft:'Draft',submitted:'Submitted',approved:'Approved'})[String(v||'draft').toLowerCase()]||'Draft';
const statusClass=v=>String(v||'draft').toLowerCase();
let scheduled=0,renderToken=0,rowsCache=[],escHandler=null;

function currentType(){return String(document.getElementById('serviceAttendanceType')?.value||'').trim().toLowerCase().replace(/[\s-]+/g,'_')}
function host(){return document.getElementById('serviceSummaryHost')}
function rateFor(row){const a=Number(row.attendance_count||0),b=Number(row.member_count||0);return b?Math.round(a/b*100):0}

function installStyles(){
 if(document.getElementById('vccfServiceSummaryGalleryStylesV2'))return;
 const s=document.createElement('style');s.id='vccfServiceSummaryGalleryStylesV2';
 s.textContent=`
.service-summary-gallery-shell{margin-top:16px;padding:18px;display:grid;gap:14px}.service-summary-gallery-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px}.service-summary-gallery-head h3{margin:0 0 5px;font-size:1rem}.service-summary-gallery-head p{margin:0;color:var(--muted);font-size:.75rem;line-height:1.45}.service-summary-gallery-tools{display:flex;gap:8px;min-width:min(100%,390px)}.service-summary-gallery-tools input,.service-summary-gallery-tools select{min-width:0;width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--input,var(--card));color:var(--text)}.service-summary-gallery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.service-summary-gallery-card{border:1px solid var(--line);border-radius:15px;background:var(--card-soft,var(--card));overflow:hidden;display:grid;grid-template-rows:auto 1fr;min-width:0}.service-summary-gallery-card-top{padding:13px 13px 10px;background:linear-gradient(135deg,rgba(215,25,32,.07),rgba(255,138,24,.07));border-bottom:1px solid var(--line)}.service-summary-gallery-card-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.service-summary-gallery-card-title h4{margin:0;font-size:.88rem;line-height:1.3}.service-summary-gallery-card-title p{margin:4px 0 0;color:var(--muted);font-size:.68rem;line-height:1.4}.service-summary-gallery-status{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;border:1px solid var(--line);font-size:.6rem;font-weight:900;white-space:nowrap;background:var(--card)}.service-summary-gallery-status.approved{background:#e8f7ee;color:#167647;border-color:#bfe7cf}.service-summary-gallery-status.submitted{background:#fff7ed;color:#9a3412;border-color:#fed7aa}.service-summary-gallery-body{padding:12px 13px 13px;display:grid;gap:10px}.service-summary-gallery-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.service-summary-gallery-metrics>div{padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--card)}.service-summary-gallery-metrics b,.service-summary-gallery-metrics span{display:block}.service-summary-gallery-metrics b{font-size:.9rem}.service-summary-gallery-metrics span{margin-top:2px;color:var(--muted);font-size:.57rem;font-weight:800;text-transform:uppercase;letter-spacing:.035em}.service-summary-gallery-note{margin:0;color:var(--muted);font-size:.7rem;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.05em}.service-summary-gallery-open{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);font:inherit;font-size:.7rem;font-weight:900;cursor:pointer}.service-summary-gallery-open:hover{border-color:var(--brand);color:var(--brand)}.service-summary-gallery-empty{padding:22px;border:1px dashed var(--line);border-radius:13px;text-align:center;color:var(--muted);font-size:.76rem}.service-summary-preview-overlay{position:fixed;inset:0;z-index:10040;background:rgba(15,23,42,.56);backdrop-filter:blur(4px);display:grid;place-items:center;padding:18px}.service-summary-preview-card{width:min(720px,100%);max-height:min(86vh,820px);overflow:auto;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 70px rgba(15,23,42,.28)}.service-summary-preview-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:18px 18px 14px;border-bottom:1px solid var(--line)}.service-summary-preview-head h3{margin:3px 0 4px;font-size:1.08rem}.service-summary-preview-head p{margin:0;color:var(--muted);font-size:.74rem}.service-summary-preview-kicker{color:var(--brand);font-size:.62rem;font-weight:900;letter-spacing:.09em}.service-summary-preview-x{width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:1.15rem;cursor:pointer}.service-summary-preview-body{padding:18px;display:grid;gap:14px}.service-summary-preview-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.service-summary-preview-stats>div{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card-soft,var(--card))}.service-summary-preview-stats span,.service-summary-preview-stats strong{display:block}.service-summary-preview-stats span{font-size:.62rem;color:var(--muted);font-weight:900;text-transform:uppercase}.service-summary-preview-stats strong{margin-top:4px;font-size:1.05rem}.service-summary-preview-notes{padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--card-soft,var(--card))}.service-summary-preview-notes span{display:block;margin-bottom:6px;color:var(--muted);font-size:.62rem;font-weight:900;text-transform:uppercase}.service-summary-preview-notes p{margin:0;white-space:pre-wrap;line-height:1.55;font-size:.79rem}.service-summary-preview-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px}.service-summary-preview-meta>div{padding:10px 11px;border:1px solid var(--line);border-radius:11px}.service-summary-preview-meta span,.service-summary-preview-meta b{display:block}.service-summary-preview-meta span{font-size:.6rem;color:var(--muted);text-transform:uppercase;font-weight:900}.service-summary-preview-meta b{margin-top:4px;font-size:.72rem}.service-summary-preview-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding:0 18px 18px}.service-summary-preview-actions .btn{min-width:130px}@media(max-width:980px){.service-summary-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.service-summary-gallery-shell{padding:14px}.service-summary-gallery-head{align-items:stretch;flex-direction:column}.service-summary-gallery-tools{min-width:0;width:100%;display:grid;grid-template-columns:1fr 120px}.service-summary-gallery-grid{grid-template-columns:1fr}.service-summary-preview-overlay{padding:10px}.service-summary-preview-stats{grid-template-columns:1fr 1fr 1fr}.service-summary-preview-meta{grid-template-columns:1fr}.service-summary-preview-actions{display:grid;grid-template-columns:1fr}.service-summary-preview-actions .btn{width:100%}}`;
 document.head.appendChild(s);
}

function isLegacyRecentSection(section){
 const title=String(section.querySelector('h3')?.textContent||'').trim().toLowerCase();
 return title==='recent summaries'||title.startsWith('recent summar');
}
function removeLegacyRecent(h){
 [...h.querySelectorAll('.service-summary-card')].forEach(section=>{if(isLegacyRecentSection(section))section.remove()});
}
function card(row){
 const attendance=Number(row.attendance_count||0),base=Number(row.member_count||0),rate=rateFor(row),status=statusClass(row.workflow_status);
 const location=(row.area_id?areaName(row.area_id):'Church-wide')+(row.barangay?' · '+row.barangay:'');
 return `<article class="service-summary-gallery-card" data-summary-id="${esc(row.id)}"><div class="service-summary-gallery-card-top"><div class="service-summary-gallery-card-title"><div><h4>${esc(row.title||'Bible Study Summary')}</h4><p>${esc(fmtDate(row.summary_date))}<br>${esc(location)}</p></div><span class="service-summary-gallery-status ${esc(status)}">${esc(statusLabel(status))}</span></div></div><div class="service-summary-gallery-body"><div class="service-summary-gallery-metrics"><div><b>${attendance}</b><span>Attendance</span></div><div><b>${rate}%</b><span>Rate</span></div><div><b>${base}</b><span>Area Base</span></div></div><p class="service-summary-gallery-note">${esc(row.notes||'No summary notes yet.')}</p><button class="service-summary-gallery-open" type="button" data-preview-service-summary="${esc(row.id)}">Preview summary →</button></div></article>`;
}
function draw(shell,rows){
 const search=shell.querySelector('[data-summary-search]'),status=shell.querySelector('[data-summary-status]'),grid=shell.querySelector('.service-summary-gallery-grid');
 const render=()=>{const q=String(search?.value||'').trim().toLowerCase(),st=String(status?.value||'');const filtered=rows.filter(row=>{const hay=[row.title,fmtDate(row.summary_date),areaName(row.area_id),row.barangay,row.notes,statusLabel(row.workflow_status)].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!st||String(row.workflow_status||'draft')===st)});const key=[q,st,...filtered.map(row=>[row.id,row.updated_at,row.workflow_status,row.attendance_count,row.member_count,row.notes].join(':'))].join('|');if(grid.dataset.renderKey===key)return;grid.dataset.renderKey=key;grid.innerHTML=filtered.length?filtered.map(card).join(''):'<div class="service-summary-gallery-empty">No Bible Study summaries match these filters.</div>';window.dispatchEvent(new CustomEvent('vccf-service-summary-gallery-rendered',{detail:{ids:filtered.map(row=>String(row.id))}}))};
 if(search&&!search.dataset.bound){search.dataset.bound='1';search.addEventListener('input',render)}
 if(status&&!status.dataset.bound){status.dataset.bound='1';status.addEventListener('change',render)}
 render();
}
function ensureShell(h){
 removeLegacyRecent(h);
 let shell=h.querySelector('[data-service-summary-gallery]');
 if(!shell){shell=document.createElement('section');shell.className='service-summary-gallery-shell card';shell.dataset.serviceSummaryGallery='1';shell.innerHTML='<div class="service-summary-gallery-head"><div><h3>Bible Study Summary Gallery</h3><p>Browse saved Bible Study attendance summaries and open the complete record.</p></div><div class="service-summary-gallery-tools"><input type="search" data-summary-search placeholder="Search date, area, barangay…"><select data-summary-status><option value="">All statuses</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option></select></div></div><div class="service-summary-gallery-grid"><div class="service-summary-gallery-empty">Loading Bible Study summaries…</div></div>';h.appendChild(shell)}
 return shell;
}
async function fetchRows(){
 let q=sb().from('cms_service_summaries').select('id,summary_type,title,summary_date,area_id,barangay,attendance_count,member_count,notes,workflow_status,submitted_at,approved_at,updated_at').eq('summary_type','Bible Study').order('summary_date',{ascending:false}).order('updated_at',{ascending:false}).limit(30);
 if(role()==='area_leader'&&ownAreaId())q=q.eq('area_id',ownAreaId());
 const r=await q;if(r.error)throw r.error;return r.data||[];
}
async function reconcile(){
 installStyles();
 const h=host();
 if(!h)return;
 if(currentType()!=='bible_study'){h.querySelector('[data-service-summary-gallery]')?.remove();return}
 const token=++renderToken;
 const shell=ensureShell(h);
 try{
  const rows=await fetchRows();
  if(token!==renderToken||!shell.isConnected||currentType()!=='bible_study')return;
  rowsCache=rows;removeLegacyRecent(h);draw(shell,rows);
 }catch(error){if(shell.isConnected)shell.querySelector('.service-summary-gallery-grid').innerHTML='<div class="service-summary-gallery-empty">'+esc(error.message||'Unable to load Bible Study summaries.')+'</div>'}
}
function closePreview(){document.getElementById('serviceSummaryPreviewOverlay')?.remove();if(escHandler){document.removeEventListener('keydown',escHandler);escHandler=null}}
function openInAttendance(row){
 closePreview();
 const typeEl=document.getElementById('serviceAttendanceType'),area=document.getElementById('serviceStudyArea'),barangay=document.getElementById('serviceStudyBarangay'),date=document.getElementById('serviceAttendanceDate');
 if(!typeEl||!area||!barangay||!date)return;
 typeEl.value='bible_study';area.value=row.area_id||'';area.dispatchEvent(new Event('change',{bubbles:true}));
 setTimeout(()=>{barangay.value=row.barangay||'';date.value=row.summary_date||date.value;barangay.dispatchEvent(new Event('change',{bubbles:true}));date.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>document.querySelector('#serviceSummaryHost > .service-summary-card')?.scrollIntoView({behavior:'smooth',block:'start'}),220)},120);
}
function openPreview(row){
 closePreview();installStyles();
 const attendance=Number(row.attendance_count||0),base=Number(row.member_count||0),rate=rateFor(row),status=statusClass(row.workflow_status),location=(row.area_id?areaName(row.area_id):'Church-wide')+(row.barangay?' · '+row.barangay:'');
 const wrap=document.createElement('div');wrap.id='serviceSummaryPreviewOverlay';wrap.className='service-summary-preview-overlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label','Bible Study Summary preview');
 wrap.innerHTML=`<div class="service-summary-preview-card"><div class="service-summary-preview-head"><div><span class="service-summary-preview-kicker">BIBLE STUDY SUMMARY</span><h3>${esc(row.title||'Bible Study Summary')}</h3><p>${esc(fmtDate(row.summary_date))} · ${esc(location)}</p></div><button class="service-summary-preview-x" type="button" aria-label="Close preview">×</button></div><div class="service-summary-preview-body"><div><span class="service-summary-gallery-status ${esc(status)}">${esc(statusLabel(status))}</span></div><div class="service-summary-preview-stats"><div><span>Attendance</span><strong>${attendance}</strong></div><div><span>Attendance Rate</span><strong>${rate}%</strong></div><div><span>Active Area Members</span><strong>${base}</strong></div></div><div class="service-summary-preview-notes"><span>Summary notes</span><p>${esc(row.notes||'No summary notes were recorded.')}</p></div><div class="service-summary-preview-meta"><div><span>Submitted</span><b>${esc(fmtStamp(row.submitted_at))}</b></div><div><span>Approved</span><b>${esc(fmtStamp(row.approved_at))}</b></div></div></div><div class="service-summary-preview-actions"><button class="btn secondary" type="button" data-close-service-preview>Close</button><button class="btn" type="button" data-open-service-summary>Open in Attendance</button></div></div>`;
 document.body.appendChild(wrap);
 wrap.querySelector('.service-summary-preview-x').onclick=closePreview;wrap.querySelector('[data-close-service-preview]').onclick=closePreview;wrap.querySelector('[data-open-service-summary]').onclick=()=>openInAttendance(row);wrap.onclick=e=>{if(e.target===wrap)closePreview()};escHandler=e=>{if(e.key==='Escape')closePreview()};document.addEventListener('keydown',escHandler);
}

document.addEventListener('click',e=>{const b=e.target.closest?.('[data-preview-service-summary]');if(!b)return;const row=rowsCache.find(x=>String(x.id)===String(b.dataset.previewServiceSummary));if(row){e.preventDefault();openPreview(row)}},true);
function queue(){clearTimeout(scheduled);scheduled=setTimeout(reconcile,110)}
new MutationObserver(mutations=>{if(mutations.some(m=>{const target=m.target?.nodeType===1?m.target:m.target?.parentElement;if(!target)return false;if(target.closest?.('[data-service-summary-gallery]'))return false;return target.id==='serviceSummaryHost'||Boolean(target.closest?.('#serviceSummaryHost'))}))queue()}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('change',e=>{if(['serviceAttendanceType','serviceStudyArea','serviceStudyBarangay','serviceAttendanceDate'].includes(e.target?.id))queue()});
window.addEventListener('vccf-app-ready',queue);window.addEventListener('focus',queue);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
})();
