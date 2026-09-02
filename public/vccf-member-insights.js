(()=>{
'use strict';
if(window.__VCCF_MEMBER_INSIGHTS_V2__)return;
window.__VCCF_MEMBER_INSIGHTS_V2__=true;
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>'₱'+Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const datePH=v=>v?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(v+'T12:00:00+08:00')):'—';
const sb=()=>window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
const privileged=()=>['admin','pastor'].includes(String(window.profile?.role||'').toLowerCase());
const unique=(rows,key)=>new Set(rows.map(key)).size;
let loading=false,lastMember='';

function addCss(){
 if($('#vccf-member-insights-css'))return;
 const s=document.createElement('style');s.id='vccf-member-insights-css';s.textContent=`
 .mi-wrap{margin-top:16px;display:grid;gap:14px}.mi-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.mi-title{font-size:1rem;font-weight:900;margin:0}.mi-sub{color:var(--muted);font-size:.78rem}.mi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.mi-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}.mi-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:800}.mi-kpi{font-size:1.45rem;font-weight:900;letter-spacing:-.035em;margin-top:3px}.mi-muted{color:var(--muted);font-size:.76rem}.mi-meter{height:8px;border-radius:99px;background:var(--bg);overflow:hidden;margin-top:8px}.mi-meter>span{display:block;height:100%;background:var(--brand-gradient);border-radius:99px}.mi-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}.mi-row:last-child{border-bottom:0}.mi-tablewrap{overflow:auto;border:1px solid var(--line);border-radius:12px;margin-top:8px}.mi-table{width:100%;border-collapse:collapse;font-size:.76rem;min-width:540px}.mi-table th,.mi-table td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left}.mi-table th{font-size:.65rem;text-transform:uppercase;color:var(--muted);letter-spacing:.05em}.mi-btn{border:1px solid var(--line);background:var(--panel);color:var(--text);padding:7px 10px;border-radius:9px;font-weight:800;font-size:.7rem;cursor:pointer}.mi-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#9ca3af}.mi-dot.on{background:#16a34a}
 @media(max-width:900px){.mi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.mi-grid{grid-template-columns:1fr}.mi-card{padding:12px}.mi-head{align-items:flex-start;flex-direction:column}}
 `;document.head.appendChild(s);
}

async function fetchMember(id){
 const c=sb();if(!c)return null;
 const [m,a,g,s]=await Promise.all([
  c.from('members').select('id,member_code,display_name,first_name,last_name,area_id,birth_date,photo_url,status,member_type,member_category').eq('id',id).maybeSingle(),
  c.from('cms_attendance').select('id,member_id,service_date,service_type,status,checked_in_at,session_id').eq('member_id',id).order('service_date',{ascending:false}).limit(2500),
  c.from('cms_giving').select('id,member_id,given_on,giving_type,amount,payment_method,reference_no').eq('member_id',id).order('given_on',{ascending:false}).limit(1000),
  c.from('cms_sunday_event_summaries').select('id,summary_type,title,summary_date,attendance_count,member_base_count,attendance_rate,tithe_total,offering_total,notes').order('summary_date',{ascending:false}).limit(200)
 ]);
 return {m:m.data,a:a.data||[],g:g.data||[],s:s.data||[],errors:[m.error,a.error,g.error,s.error].filter(Boolean)};
}

function classify(att,rx){return att.filter(a=>rx.test(String(a.service_type||'')));}
function distinctDates(rows){return new Set(rows.map(a=>String(a.service_date||'')).filter(Boolean));}
function presentRows(rows){return [...distinctDates(rows)];}
function rate(n,d){return d?Math.min(100,Math.round(n/d*100)):0;}

function render(host,data){
 const {m,a,g,s}=data;
 const sunday=classify(a,/sunday|worship/i),weekday=classify(a,/midweek|weekday|bible|study/i),events=classify(a,/event|special/i);
 const submittedSundays=s.filter(x=>/sunday/i.test(String(x.summary_type||'')));
 const expectedSunday=new Set(submittedSundays.map(x=>String(x.summary_date||''))).size || distinctDates(sunday).size;
 const sundayPresent=distinctDates(sunday).size;
 const overallDates=distinctDates(a).size;
 const expectedOverall=new Set(s.map(x=>String(x.summary_date||''))).size || overallDates;
 const overallPct=rate(overallDates,expectedOverall);
 const sundayPct=rate(sundayPresent,expectedSunday);
 const showAmounts=privileged();
 const masked=v=>showAmounts?money(v):'₱••••••';
 const total=g.reduce((n,x)=>n+Number(x.amount||0),0),tithes=g.filter(x=>/tithe/i.test(String(x.giving_type||''))).reduce((n,x)=>n+Number(x.amount||0),0),offerings=g.filter(x=>/offer/i.test(String(x.giving_type||''))).reduce((n,x)=>n+Number(x.amount||0),0);
 const summaryByDate=new Map(s.map(x=>[String(x.summary_date),x]));
 const hostName=esc(m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' ')||'Member');
 host.innerHTML=`<div class="mi-wrap">
  <div class="mi-head"><div><h4 class="mi-title">Attendance & Giving Insights</h4><div class="mi-sub">Detailed information for ${hostName}</div></div><div class="mi-sub">${showAmounts?'Authorized financial view':'Giving amounts protected'}</div></div>
  <div class="mi-grid">
   <div class="mi-card"><div class="mi-label">Overall Attendance</div><div class="mi-kpi">${overallPct}%</div><div class="mi-muted">${overallDates} recorded service dates</div><div class="mi-meter"><span style="width:${overallPct}%"></span></div></div>
   <div class="mi-card"><div class="mi-label">Sunday</div><div class="mi-kpi">${sundayPct}%</div><div class="mi-muted">${sundayPresent} Sundays recorded</div><div class="mi-meter"><span style="width:${sundayPct}%"></span></div></div>
   <div class="mi-card"><div class="mi-label">Weekday / Bible Study</div><div class="mi-kpi">${distinctDates(weekday).size}</div><div class="mi-muted">Recorded dates</div></div>
   <div class="mi-card"><div class="mi-label">Special Events</div><div class="mi-kpi">${distinctDates(events).size}</div><div class="mi-muted">Recorded event dates</div></div>
  </div>
  <div class="mi-grid" style="grid-template-columns:1.05fr .95fr">
   <div class="mi-card"><div class="mi-label">Tithes & Offerings</div><div class="mi-kpi">${masked(total)}</div><div class="mi-row"><span>Tithes</span><b>${masked(tithes)}</b></div><div class="mi-row"><span>Offerings</span><b>${masked(offerings)}</b></div><div class="mi-row"><span>Giving records</span><b>${g.length}</b></div></div>
   <div class="mi-card"><div class="mi-label">Sunday Summaries</div><div class="mi-kpi">${submittedSundays.length}</div><div class="mi-sub">Submitted summaries related to recorded Sundays</div>${submittedSundays.slice(0,5).map(x=>`<div class="mi-row"><span><b>${esc(x.title||'Sunday Summary')}</b><small class="mi-muted" style="display:block">${datePH(x.summary_date)}</small></span><button class="mi-btn" type="button" data-mi-summary="${x.id}">View</button></div>`).join('')||'<div class="mi-muted" style="margin-top:10px">No submitted Sunday summaries yet.</div>'}</div>
  </div>
  <div class="mi-card"><div class="mi-label">Sunday Attendance History</div><div class="mi-tablewrap"><table class="mi-table"><thead><tr><th>Date</th><th>Attendance</th><th>Submitted Summary</th><th></th></tr></thead><tbody>${[...distinctDates(sunday)].sort((x,y)=>y.localeCompare(x)).slice(0,80).map(d=>{const x=summaryByDate.get(d);return `<tr><td>${datePH(d)}</td><td><span class="mi-dot on"></span> Recorded</td><td>${esc(x?.title||'Sunday Worship')}</td><td>${x?`<button class="mi-btn" type="button" data-mi-summary="${x.id}">View</button>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="4" class="mi-muted">No Sunday attendance recorded.</td></tr>'}</tbody></table></div></div>
  <div class="mi-card"><div class="mi-label">Giving History</div><div class="mi-tablewrap"><table class="mi-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Payment</th><th>Reference</th></tr></thead><tbody>${g.slice(0,100).map(x=>`<tr><td>${datePH(x.given_on)}</td><td>${esc(x.giving_type||'')}</td><td>${masked(x.amount)}</td><td>${esc(x.payment_method||'')}</td><td>${esc(x.reference_no||'')}</td></tr>`).join('')||'<tr><td colspan="5" class="mi-muted">No giving records recorded.</td></tr>'}</tbody></table></div></div>
 </div>`;
 bind(host,s);
}

function bind(host,s){
 host.querySelectorAll('[data-mi-summary]').forEach(b=>b.onclick=()=>{const x=s.find(v=>v.id===b.dataset.miSummary);if(x)openSummary(x);});
}
function openSummary(x){
 const old=$('#vccfMemberInsightsSummaryModal');if(old)old.remove();
 const modal=document.createElement('div');modal.id='vccfMemberInsightsSummaryModal';modal.style.cssText='position:fixed;inset:0;background:#0008;display:grid;place-items:center;z-index:9999;padding:18px';
 modal.innerHTML=`<div style="width:min(720px,100%);max-height:88vh;overflow:auto;background:var(--panel);color:var(--text);border-radius:20px;padding:20px;border:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:start"><div><div class="mi-label">Submitted Summary</div><h2 style="margin:4px 0">${esc(x.title||'Sunday Summary')}</h2><div class="mi-muted">${datePH(x.summary_date)} · ${esc(x.summary_type||'Sunday')}</div></div><button class="mi-btn" id="miSummaryClose" type="button">Close</button></div><div class="mi-grid" style="margin-top:14px;grid-template-columns:repeat(3,minmax(0,1fr))"><div class="mi-card"><div class="mi-label">Attendance</div><div class="mi-kpi">${Number(x.attendance_count||0)}</div></div><div class="mi-card"><div class="mi-label">Member Base</div><div class="mi-kpi">${Number(x.member_base_count||0)}</div></div><div class="mi-card"><div class="mi-label">Rate</div><div class="mi-kpi">${Number(x.attendance_rate||0)}%</div></div></div><div class="mi-card" style="margin-top:12px"><div class="mi-label">Giving</div><div class="mi-row"><span>Tithes</span><b>${privileged()?money(x.tithe_total):'₱••••••'}</b></div><div class="mi-row"><span>Offerings</span><b>${privileged()?money(x.offering_total):'₱••••••'}</b></div><div class="mi-muted" style="margin-top:8px">${privileged()?'Financial figures visible to Admin/Pastor only.':'Financial figures are protected.'}</div></div><div class="mi-card" style="margin-top:12px"><div class="mi-label">Notes</div><div>${esc(x.notes||'No notes provided.')}</div></div><div class="mi-card" id="miSummaryPhotos" style="margin-top:12px"><div class="mi-label">Submitted Photos</div><div class="mi-muted">Loading photos…</div></div></div>`;
 document.body.appendChild(modal);$('#miSummaryClose',modal).onclick=()=>modal.remove();modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
 const c=sb();if(!c)return;c.from('cms_summary_photos').select('id,image_url,caption,sort_order').eq('summary_id',x.id).order('sort_order').then(({data,error})=>{const p=$('#miSummaryPhotos',modal);if(!p)return;if(error){p.innerHTML='<div class="mi-label">Submitted Photos</div><div class="mi-muted">Unable to load photos.</div>';return;}p.innerHTML='<div class="mi-label">Submitted Photos</div>'+(data?.length?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:9px">${data.map(z=>`<figure style="margin:0"><img src="${esc(z.image_url)}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:12px;border:1px solid var(--line)"><figcaption class="mi-muted" style="padding-top:4px">${esc(z.caption||'')}</figcaption></figure>`).join('')}</div>`:'<div class="mi-muted" style="margin-top:5px">No photos were attached.</div>');});
}

async function enhance(){
 const detail=$('#memberDetail');if(!detail)return;
 const id=window.__VCCF_SELECTED_MEMBER__;
 if(!id||loading||id===lastMember)return;
 const existing=$('.mi-wrap',detail);
 if(existing){lastMember=id;return;}
 loading=true;addCss();
 try{const data=await fetchMember(id);if(data?.m){const host=document.createElement('div');host.className='vccf-member-insights-host';detail.appendChild(host);render(host,data);lastMember=id;}}catch(e){console.warn('VCCF member insights:',e)}finally{loading=false;}
}

addCss();
new MutationObserver(()=>setTimeout(enhance,80)).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-view']});
setInterval(()=>{const id=window.__VCCF_SELECTED_MEMBER__;if(id&&id!==lastMember)enhance();},600);
window.addEventListener('vccf-profile-ready',()=>setTimeout(enhance,300));
})();