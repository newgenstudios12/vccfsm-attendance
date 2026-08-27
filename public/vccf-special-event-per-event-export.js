(()=>{
'use strict';
if(window.__VCCF_SPECIAL_EVENT_PER_EVENT_EXPORT_V1__)return;
window.__VCCF_SPECIAL_EVENT_PER_EVENT_EXPORT_V1__=true;
const URL=window.VCCF_SUPABASE_URL,KEY=window.VCCF_SUPABASE_PUBLISHABLE_KEY;
if(!URL||!KEY||!window.supabase)return;
const client=window.supabase.createClient(URL,KEY);
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');clearTimeout(window.__vccfPerEventToast);window.__vccfPerEventToast=setTimeout(()=>x.classList.remove('show'),2800)}};
function loadSheetJs(){if(window.XLSX)return Promise.resolve(window.XLSX);return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Excel library did not initialize.'));s.onerror=()=>reject(new Error('Unable to load the Excel download library.'));document.head.appendChild(s)})}
const BORDER={top:{style:'thin',color:{rgb:'E6E7EB'}},bottom:{style:'thin',color:{rgb:'E6E7EB'}},left:{style:'thin',color:{rgb:'E6E7EB'}},right:{style:'thin',color:{rgb:'E6E7EB'}}};
const RED='D71920',GREEN='DCFCE7',ORANGE='FFF1E6',DARK='111318',MUTED='6D7280';
const titleStyle={font:{bold:true,color:{rgb:'FFFFFF'},sz:16},fill:{fgColor:{rgb:RED}},alignment:{horizontal:'center',vertical:'center'}};
const headerStyle={font:{bold:true,color:{rgb:'FFFFFF'},sz:10},fill:{fgColor:{rgb:RED}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:BORDER};
const bodyStyle={border:BORDER,alignment:{vertical:'center'}};
const activeStyle={fill:{fgColor:{rgb:ORANGE}},font:{bold:true,color:{rgb:DARK}},border:BORDER};
const presentStyle={fill:{fgColor:{rgb:GREEN}},font:{bold:true,color:{rgb:'166534'}},alignment:{horizontal:'center'},border:BORDER};
const percentStyle={numFmt:'0.0%',border:BORDER,alignment:{horizontal:'center'}};
function styleRange(ws,ref,style){const rg=XLSX.utils.decode_range(ref);for(let r=rg.s.r;r<=rg.e.r;r++)for(let c=rg.s.c;c<=rg.e.c;c++){const a=XLSX.utils.encode_cell({r,c});ws[a]=ws[a]||{};ws[a].s={...(ws[a].s||{}),...style}}}
async function downloadEvent(eventId){try{toast('Preparing event Excel report...');const XLSX=await loadSheetJs();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Please sign in again.');const {data:profile,error:pe}=await client.from('profiles').select('role').eq('user_id',user.id).maybeSingle();if(pe)throw pe;if(String(profile?.role||'').toLowerCase()!=='admin')throw new Error('Only administrators can download special event reports.');
const [er,mr,ar,atr]=await Promise.all([
client.from('special_events').select('id,title,event_date,event_time,location,description').eq('id',eventId).maybeSingle(),
client.from('members').select('id,display_name,first_name,last_name,member_code,area_id,status,is_active').order('display_name'),
client.from('areas').select('id,name,is_active').order('name'),
client.from('special_event_attendance').select('event_id,member_id,area_id,checked_in_at,source').eq('event_id',eventId).order('checked_in_at')
]);
if(er.error)throw er.error;if(mr.error)throw mr.error;if(ar.error)throw ar.error;if(atr.error)throw atr.error;if(!er.data)throw new Error('Special event not found.');
const ev=er.data,areas=(ar.data||[]).filter(a=>a.is_active!==false),members=(mr.data||[]).filter(m=>m.is_active!==false&&String(m.status||'active').toLowerCase()!=='inactive'),attendance=atr.data||[];const areaMap=new Map(areas.map(a=>[String(a.id),a.name||'Unassigned']));const recByMember=new Map(attendance.map(r=>[String(r.member_id),r]));
const rows=[[`${ev.title} — Special Event Attendance`],[`Date: ${ev.event_date}${ev.event_time?'   Time: '+String(ev.event_time).slice(0,5):''}${ev.location?'   Location: '+ev.location:''}`],[ev.description||''],[],['Area','Name','Member Code','Status','Attendance','Check-in Time']];
for(const area of areas){for(const m of members.filter(x=>String(x.area_id)===String(area.id))){const rec=recByMember.get(String(m.id));rows.push([area.name,m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' ')||'Unnamed member',m.member_code||'', 'Active',rec?'Present':'Absent',rec?.checked_in_at?new Date(rec.checked_in_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):''])}}
const areaSummary=[['Area','Eligible Active Members','Checked In','Not Checked In','Attendance Rate']];for(const area of areas){const em=members.filter(m=>String(m.area_id)===String(area.id));const p=em.filter(m=>recByMember.has(String(m.id))).length;areaSummary.push([area.name,em.length,p,Math.max(0,em.length-p),em.length?p/em.length:0])}
const totalEligible=members.length,totalPresent=attendance.filter(r=>members.some(m=>String(m.id)===String(r.member_id))).length;const summary=[['Event Summary'],['Event',ev.title],['Date',ev.event_date],['Location',ev.location||''],['Eligible Active Members',totalEligible],['Checked In',totalPresent],['Not Checked In',Math.max(0,totalEligible-totalPresent)],['Attendance Rate',totalEligible?totalPresent/totalEligible:0],[],...areaSummary];
const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(rows),ss=XLSX.utils.aoa_to_sheet(summary);ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:5}},{s:{r:1,c:0},e:{r:1,c:5}},{s:{r:2,c:0},e:{r:2,c:5}}];ss['!merges']=[{s:{r:0,c:0},e:{r:0,c:4}}];ws['!cols']=[{wch:22},{wch:32},{wch:16},{wch:14},{wch:14},{wch:28}];ss['!cols']=[{wch:26},{wch:34},{wch:22},{wch:18},{wch:18}];styleRange(ws,'A1:F1',titleStyle);styleRange(ws,'A2:F3',{font:{italic:true,color:{rgb:MUTED},sz:9},alignment:{wrapText:true,vertical:'center'}});styleRange(ws,'A5:F5',headerStyle);styleRange(ws,`A6:F${rows.length}`,bodyStyle);for(let r=6;r<=rows.length;r++){if(ws[`D${r}`])ws[`D${r}`].s={...(ws[`D${r}`].s||{}),...activeStyle};if(ws[`E${r}`]?.v==='Present')ws[`E${r}`].s={...(ws[`E${r}`].s||{}),...presentStyle}}
styleRange(ss,'A1:E1',titleStyle);styleRange(ss,'A2:B8',bodyStyle);ss['B8']?.s={...(ss['B8'].s||{}),...percentStyle};styleRange(ss,'A10:E10',headerStyle);styleRange(ss,`A11:E${summary.length}`,bodyStyle);for(let r=11;r<=summary.length;r++)if(typeof ss[`E${r}`]?.v==='number')ss[`E${r}`].s={...(ss[`E${r}`].s||{}),...percentStyle};
XLSX.utils.book_append_sheet(wb,ss,'Summary');XLSX.utils.book_append_sheet(wb,ws,'Attendance');const safe=String(ev.title||'special-event').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'special-event';XLSX.writeFile(wb,`vccf-${safe}-${ev.event_date}.xlsx`);toast('Event Excel report downloaded.')}catch(e){console.error('VCCF per-event export:',e);toast(`Export failed: ${e?.message||e}`)}}
function addButtons(){const host=document.getElementById('vccfSpecialEvents');if(!host)return;host.querySelectorAll('[data-se-open]').forEach(open=>{const id=open.dataset.seOpen;const actions=open.parentElement;if(!actions||actions.querySelector(`[data-se-download="${id}"]`))return;const b=document.createElement('button');b.className='btn secondary';b.type='button';b.textContent='Download Excel';b.dataset.seDownload=id;b.onclick=()=>downloadEvent(id);actions.appendChild(b)})}
const obs=new MutationObserver(addButtons);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{subtree:true,childList:true}));else obs.observe(document.body,{subtree:true,childList:true});setTimeout(addButtons,700);window.vccfDownloadSpecialEvent=downloadEvent;
})();
