(()=>{
'use strict';
if(window.__VCCF_MEMBER_INSIGHTS_V1__)return;
window.__VCCF_MEMBER_INSIGHTS_V1__=true;
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>'₱'+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const datePH=v=>v?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(v+'T12:00:00+08:00')):'—';
const role=()=>String(window.__VCCF_MEMBER_INSIGHTS_ROLE__||window.profile?.role||'').toLowerCase();
const privileged=()=>['admin','pastor'].includes(role());
const client=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
let lastId=null,lastHost=null,loading=false;

function addCss(){
 if($('#vccf-member-insights-css'))return;
 const s=document.createElement('style');s.id='vccf-member-insights-css';s.textContent=`
 .mi-wrap{margin-top:14px;display:grid;gap:14px}.mi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.mi-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:13px;min-width:0}.mi-kpi{font-size:1.35rem;font-weight:900;letter-spacing:-.03em}.mi-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:800}.mi-muted{color:var(--muted);font-size:.78rem}.mi-meter{height:8px;border-radius:99px;background:var(--bg);overflow:hidden}.mi-meter>span{display:block;height:100%;background:var(--brand-gradient);border-radius:99px}.mi-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}.mi-row:last-child{border-bottom:0}.mi-tablewrap{overflow:auto;border:1px solid var(--line);border-radius:12px}.mi-table{width:100%;border-collapse:collapse;font-size:.76rem;min-width:560px}.mi-table th,.mi-table td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left}.mi-table th{font-size:.65rem;text-transform:uppercase;color:var(--muted);letter-spacing:.05em}.mi-summary{border:1px solid var(--line);border-radius:13px;padding:12px;background:linear-gradient(135deg,var(--panel),var(--bg))}.mi-view{border:1px solid var(--line);background:var(--panel);color:var(--text);padding:7px 10px;border-radius:9px;font-weight:800;font-size:.7rem;cursor:pointer}.mi-dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#9ca3af}.mi-dot.on{background:#16a34a}.mi-dot.off{background:#dc3545}
 @media(max-width:900px){.mi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.mi-grid{grid-template-columns:1fr}.mi-card{padding:12px}}
 `;document.head.appendChild(s);
}

async function getAuth(){const sb=client();if(!sb)return null;const {data:{user}}=await sb.auth.getUser();if(!user)return null;const {data:p}=await sb.from('profiles').select('user_id,role,member_id').eq('user_id',user.id).maybeSingle();window.__VCCF_MEMBER_INSIGHTS_ROLE__=p?.role||'';return {sb,p};}

async function fetchData(sb,id){
 const [att,giv,summ] = await Promise.all([
   sb.from('cms_attendance').select('id,member_id,service_date,service_type,status,checked_in_at,session_id').eq('member_id',id).order('service_date',{ascending:false}).limit(3000),
   sb.from('cms_giving').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no,notes').eq('member_id',id).order('given_on',{ascending:false}).limit(1000),
   sb.from('cms_sunday_event_summaries').select('id,summary_type,title,summary_date,attendance_count,member_base_count,attendance_rate,tithe_total,offering_total,notes').order('summary_date',{ascending:false}).limit(200)
 ]);
 return {att:att.data||[],giv:giv.data||[],summ:summ.data||[],attError:att.error,givError:giv.error,summError:summ.error};
}

function periodStats(rows){
 const total=new Set(rows.map(x=>`${x.service_date}|${x.service_type||''}`)).size;
 const present=rows.filter(x=>String(x.status||'').toLowerCase().includes('present')||String(x.status||'').toLowerCase().includes('checked')).length;
 const pct=total?Math.min(100,Math.round(present/Math.max(1,total)*100)):0;
 return {total,present,pct};
}

function memberSundayRows(att){
 const grouped=new Map();
 att.filter(a=>/sunday|worship|service/i.test(String(a.service_type||''))).forEach(a=>{
   const k=String(a.service_date||'');
   if(!k)return;
   const old=grouped.get(k); if(!old||String(a.checked_in_at||'')>String(old.checked_in_at||''))grouped.set(k,a);
 });
 return [...grouped.values()].sort((a,b)=>String(b.service_date).localeCompare(String(a.service_date)));
}

function summariesForDates(summ, dates){
 const wanted=new Set(dates); return summ.filter(s=>wanted.has(String(s.summary_date))).slice(0,80);
}

function render(host,m,att,giv,summ){
 const sunday=memberSundayRows(att);
 const sundayPct=periodStats(sunday);
 const weekday=periodStats(att.filter(a=>/midweek|weekday|bible|study/i.test(String(a.service_type||''))));
 const events=periodStats(att.filter(a=>/event|special/i.test(String(a.service_type||''))));
 const totalGive=giv.reduce((s,r)=>s+Number(r.amount||0),0);
 const tithes=giv.filter(r=>/tithe/i.test(String(r.giving_type||''))).reduce((s,r)=>s+Number(r.amount||0),0);
 const offerings=giv.filter(r=>/offer/i.test(String(r.giving_type||''))).reduce((s,r)=>s+Number(r.amount||0),0);
 const showAmounts=privileged()||String(window.profile?.member_id||'')===String(m.id);
 const masked=v=>showAmounts?money(v):'₱••••••';
 const relevantSumm=summariesForDates(summ,sunday.map(x=>x.service_date));
 host.innerHTML=`<div class="mi-wrap">
   <div class="mi-grid">
     <div class="mi-card"><div class="mi-label">Overall Attendance</div><div class="mi-kpi">${periodStats(att).pct}%</div><div class="mi-muted">${periodStats(att).present} recorded check-ins</div><div class="mi-meter" style="margin-top:7px"><span style="width:${periodStats(att).pct}%"></span></div></div>
     <div class="mi-card"><div class="mi-label">Sunday</div><div class="mi-kpi">${sundayPct.pct}%</div><div class="mi-muted">${sundayPct.present} Sundays recorded</div><div class="mi-meter" style="margin-top:7px"><span style="width:${sundayPct.pct}%"></span></div></div>
     <div class="mi-card"><div class="mi-label">Weekday / Bible Study</div><div class="mi-kpi">${weekday.pct}%</div><div class="mi-muted">${weekday.present} recorded</div><div class="mi-meter" style="margin-top:7px"><span style="width:${weekday.pct}%"></span></div></div>
     <div class="mi-card"><div class="mi-label">Special Events</div><div class="mi-kpi">${events.pct}%</div><div class="mi-muted">${events.present} recorded</div><div class="mi-meter" style="margin-top:7px"><span style="width:${events.pct}%"></span></div></div>
   </div>
   <div class="mi-grid" style="grid-template-columns:1.1fr .9fr">
     <div class="mi-card"><div class="mi-label">Tithes & Offerings</div><div class="mi-kpi">${masked(totalGive)}</div><div class="mi-row"><span>Tithes</span><b>${masked(tithes)}</b></div><div class="mi-row"><span>Offerings</span><b>${masked(offerings)}</b></div><div class="mi-row"><span>Records</span><b>${giv.length}</b></div><div class="mi-muted" style="margin-top:8px">${showAmounts?'Amounts are visible to authorized users.':'Giving amounts are protected and displayed as dots.'}</div></div>
     <div class="mi-card"><div class="mi-label">Sunday Summary</div><div class="mi-kpi">${relevantSumm.length}</div><div class="mi-muted">Submitted summaries matching this member's recorded Sundays</div>${relevantSumm.slice(0,5).map(s=>`<div class="mi-row"><span><b>${esc(s.title||'Sunday Summary')}</b><small class="mi-muted" style="display:block">${datePH(s.summary_date)}</small></span><button class="mi-view" type="button" data-mi-summary="${s.id}">View</button></div>`).join('')||'<div class="mi-muted" style="padding-top:10px">No submitted Sunday summaries yet.</div>'}</div>
   </div>
   <div class="mi-card"><div class="mi-label">Sunday Attendance History</div><div class="mi-tablewrap" style="margin-top:8px"><table class="mi-table"><thead><tr><th>Date</th><th>Status</th><th>Summary</th><th>View</th></tr></thead><tbody>${sunday.slice(0,80).map(a=>{const s=relevantSumm.find(x=>String(x.summary_date)===String(a.service_date));const on=/present|checked/i.test(String(a.status||''));return `<tr><td>${datePH(a.service_date)}</td><td><span class="mi-dot ${on?'on':'off'}"></span> ${esc(a.status||'Recorded')}</td><td>${esc(s?.title||a.service_type||'Sunday Worship')}</td><td>${s?`<button class="mi-view" type="button" data-mi-summary="${s.id}">View</button>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="4" class="mi-muted">No Sunday attendance recorded.</td></tr>'}</tbody></table></div></div>
   <div class="mi-card"><div class="mi-label">Giving History</div><div class="mi-tablewrap" style="margin-top:8px"><table class="mi-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Payment</th><th>Reference</th></tr></thead><tbody>${giv.slice(0,120).map(r=>`<tr><td>${datePH(r.given_on)}</td><td>${esc(r.giving_type||'')}</td><td>${showAmounts?money(r.amount):'₱••••••'}</td><td>${esc(r.payment_method||'')}</td><td>${esc(r.reference_no||'')}</td></tr>`).join('')||'<tr><td colspan="5" class="mi-muted">No giving records recorded.</td></tr>'}</tbody></table></div></div>
 </div>`;
 bindSummaryButtons(host,summ);
}

function bindSummaryButtons(host,summ){
 host.querySelectorAll('[data-mi-summary]').forEach(b=>b.onclick=()=>{const s=summ.find(x=>x.id===b.dataset.miSummary);if(!s)return;openSummary(s);});
}

function openSummary(s){
 const old=$('#vccfMemberSummaryModal');if(old)old.remove();
 const modal=document.createElement('div');modal.id='vccfMemberSummaryModal';modal.style.cssText='position:fixed;inset:0;background:#0008;display:grid;place-items:center;z-index:1000;padding:18px';
 modal.innerHTML=`<div style="width:min(680px,100%);max-height:88vh;overflow:auto;background:var(--panel);color:var(--text);border-radius:20px;padding:20px;border:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><div class="mi-label">Submitted Summary</div><h2 style="margin:4px 0">${esc(s.title||'Sunday Summary')}</h2><div class="mi-muted">${datePH(s.summary_date)} · ${esc(s.summary_type||'Sunday')}</div></div><button class="mi-view" type="button" id="miClose">Close</button></div><div class="mi-grid" style="margin-top:14px"><div class="mi-card"><div class="mi-label">Attendance</div><div class="mi-kpi">${Number(s.attendance_count||0)}</div></div><div class="mi-card"><div class="mi-label">Member Base</div><div class="mi-kpi">${Number(s.member_base_count||0)}</div></div><div class="mi-card"><div class="mi-label">Attendance Rate</div><div class="mi-kpi">${Number(s.attendance_rate||0)}%</div></div>${privileged()?`<div class="mi-card"><div class="mi-label">Giving</div><div class="mi-kpi">${money(Number(s.tithe_total||0)+Number(s.offering_total||0))}</div><div class="mi-muted">Tithes ${money(s.tithe_total)} · Offerings ${money(s.offering_total)}</div></div>`:'<div class="mi-card"><div class="mi-label">Giving</div><div class="mi-kpi">₱••••••</div><div class="mi-muted">Giving details are protected.</div></div>'}</div><div class="mi-summary" style="margin-top:14px"><b>Notes</b><div class="mi-muted" style="margin-top:5px">${esc(s.notes||'No notes provided.')}</div></div><div id="miPhotos" class="mi-summary" style="margin-top:12px"><b>Submitted Photos</b><div class="mi-muted" style="margin-top:5px">Loading photos…</div></div></div>`;
 document.body.appendChild(modal);$('#miClose',modal).onclick=()=>modal.remove();modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
 const sb=client(); if(sb){sb.from('cms_summary_photos').select('id,image_url,caption,sort_order').eq('summary_id',s.id).order('sort_order').then(({data,error})=>{const host=$('#miPhotos',modal);if(!host)return;if(error){host.innerHTML='<b>Submitted Photos</b><div class="mi-muted">Unable to load photos.</div>';return;}host.innerHTML='<b>Submitted Photos</b>'+(data?.length?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:9px">${data.map(p=>`<figure style="margin:0"><img src="${esc(p.image_url)}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:12px;border:1px solid var(--line)"><figcaption class="mi-muted" style="padding-top:4px">${esc(p.caption||'')}</figcaption></figure>`).join('')}</div>`:'<div class="mi-muted" style="margin-top:5px">No photos were attached to this submitted summary.</div>');});}
}

async function renderForCurrent(){
 if(loading)return; const host=$('#memberDetail');if(!host)return; const id=host.dataset?.vccfMemberId||window.__VCCF_SELECTED_MEMBER__;if(!id||id===lastId&&host===lastHost)return; const memberNameText=host.querySelector('h3')?.textContent||'';
 const sb=client();if(!sb)return;loading=true;addCss();
 try{
   const {data:members}=await sb.from('members').select('id,member_code,display_name,first_name,last_name,area_id,birth_date,photo_url,status,member_type').eq('id',id).limit(1); const m=members?.[0];if(!m){loading=false;return;}
   const d=await fetchData(sb,id);if(d.attError&&d.givError){loading=false;return;} render(host,m,d.att,d.giv,d.summ);host.dataset.vccfMemberId=id;lastId=id;lastHost=host;
 }catch(e){console.warn('Member insights:',e)} finally{loading=false;}
}

function watch(){
 const observer=new MutationObserver(()=>{const h=$('#memberDetail');if(h&&window.__VCCF_SELECTED_MEMBER__){h.dataset.vccfMemberId=window.__VCCF_SELECTED_MEMBER__;setTimeout(renderForCurrent,60);}});
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
 setInterval(()=>{const h=$('#memberDetail');if(h&&window.__VCCF_SELECTED_MEMBER__&&h.dataset.vccfMemberId!==window.__VCCF_SELECTED_MEMBER__){h.dataset.vccfMemberId=window.__VCCF_SELECTED_MEMBER__;lastId=null;renderForCurrent();}},800);
}

addCss();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
window.addEventListener('vccf-authenticated',()=>setTimeout(renderForCurrent,900));
})();