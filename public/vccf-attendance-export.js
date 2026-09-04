(() => {
'use strict';
if(window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__) return;
window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__=true;

const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const roleName=v=>String(v||'').trim().toLowerCase().replace(/_/g,' ');
const manilaDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const isActive=m=>m?.is_active!==false&&String(m?.status||'active').toLowerCase()!=='inactive';
const client=()=>window.VCCF?.sb||null;
const fileSlug=v=>String(v||'attendance').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function ensureToast(){
  let el=document.getElementById('attendanceExportToast');
  if(el)return el;
  el=document.createElement('div');el.id='attendanceExportToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  Object.assign(el.style,{position:'fixed',left:'50%',bottom:'22px',transform:'translateX(-50%)',zIndex:'12000',maxWidth:'min(92vw,620px)',padding:'11px 14px',borderRadius:'12px',background:'rgba(17,24,39,.96)',color:'#fff',fontSize:'.78rem',fontWeight:'800',boxShadow:'0 12px 32px rgba(0,0,0,.24)',display:'none',textAlign:'center'});
  document.body.appendChild(el);return el;
}
function notify(message,kind='info',button=null){
  const el=ensureToast();el.textContent=message;el.style.display='block';el.style.background=kind==='error'?'rgba(180,35,24,.97)':kind==='success'?'rgba(22,118,71,.97)':'rgba(17,24,39,.96)';
  clearTimeout(window.__vccfExcelToast);window.__vccfExcelToast=setTimeout(()=>{el.style.display='none'},6000);
  if(button){let s=button.parentElement?.querySelector('.attendance-export-status');if(!s){s=document.createElement('span');s.className='attendance-export-status';s.setAttribute('aria-live','polite');Object.assign(s.style,{fontSize:'.68rem',color:'var(--muted)',maxWidth:'260px',lineHeight:'1.35'});button.insertAdjacentElement('afterend',s)}s.textContent=message;s.style.color=kind==='error'?'#b42318':kind==='success'?'#167647':'var(--muted)'}
}
function loadExternalScript(src,ready){
  return new Promise((resolve,reject)=>{
    if(ready()){resolve(ready());return}
    const existing=[...document.scripts].find(s=>s.src===src);
    if(existing){existing.addEventListener('load',()=>ready()?resolve(ready()):reject(new Error('Excel library did not initialize.')),{once:true});existing.addEventListener('error',()=>reject(new Error('Excel library failed to load.')),{once:true});return}
    const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';
    const timer=setTimeout(()=>{s.remove();reject(new Error('Excel library timed out while loading.'))},15000);
    s.onload=()=>{clearTimeout(timer);ready()?resolve(ready()):reject(new Error('Excel library did not initialize.'))};
    s.onerror=()=>{clearTimeout(timer);reject(new Error('Excel library failed to load.'))};document.head.appendChild(s);
  });
}
async function loadXlsx(){
  if(window.XLSX)return window.XLSX;
  const sources=['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'];
  let lastError=null;for(const src of sources){try{return await loadExternalScript(src,()=>window.XLSX)}catch(e){lastError=e}}
  throw lastError||new Error('Unable to load the Excel workbook library. Check your internet connection and try again.');
}
function monthBounds(month){const [y,m]=month.split('-').map(Number),ny=m===12?y+1:y,nm=m===12?1:m+1;return {start:new Date(`${month}-01T00:00:00+08:00`).toISOString(),end:new Date(`${ny}-${String(nm).padStart(2,'0')}-01T00:00:00+08:00`).toISOString()}}
function sundaysForMonth(month){const [y,m]=month.split('-').map(Number),out=[],d=new Date(Date.UTC(y,m-1,1));while(d.getUTCMonth()===m-1){if(d.getUTCDay()===0)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out}
function selectedMonth(kind){const input=kind==='sunday'?document.getElementById('richAttendanceDate'):document.getElementById('serviceAttendanceDate');const day=input?.value||manilaDay(new Date());return day.slice(0,7)}
function currentServiceType(){return document.getElementById('serviceAttendanceType')?.value||'bible_study'}
function typeLabel(type){return type==='bible_study'?'Bible Study':type==='midweek_service'?'Midweek Service':'Sunday'}
function attendanceMatchesType(row,type){const v=String(row?.attendance_type||'').trim().toLowerCase();return type==='sunday'?(v===''||v==='sunday'):v===type}
function dayLabel(day){return new Date(day+'T12:00:00+08:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
function clearReadyLink(button){button?.parentElement?.querySelector('.attendance-export-ready')?.remove()}
function saveArrayBuffer(bytes,filename,button){
  clearReadyLink(button);
  const blob=new Blob([bytes],{type:XLSX_MIME}),url=URL.createObjectURL(blob),auto=document.createElement('a');auto.href=url;auto.download=filename;auto.rel='noopener';auto.style.display='none';document.body.appendChild(auto);
  const fallback=document.createElement('a');fallback.className='attendance-export-ready';fallback.href=url;fallback.download=filename;fallback.rel='noopener';fallback.textContent='Download Excel';Object.assign(fallback.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'10px',fontSize:'.7rem',fontWeight:'900',color:'var(--brand)',background:'var(--card)',textDecoration:'none'});button?.insertAdjacentElement('afterend',fallback);
  try{auto.click()}catch(e){console.warn('Automatic Excel download was blocked',e)}
  notify('Excel is ready. If it did not download automatically, tap “Download Excel”.','success',button);
  setTimeout(()=>{auto.remove();fallback.remove();URL.revokeObjectURL(url)},180000);
}
function setWidths(ws,widths){ws['!cols']=widths.map(w=>({wch:w}))}
function addAutofilter(ws,range){ws['!autofilter']={ref:range}}

function buildWorkbook(XLSX,{type,month,areas,members,attendance,role}){
  const wb=XLSX.utils.book_new(),label=typeLabel(type),monthName=new Date(month+'-01T12:00:00+08:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'}),today=manilaDay(new Date());
  const dates=type==='sunday'?sundaysForMonth(month):[...new Set(attendance.map(a=>manilaDay(a.checked_in_at)))].sort();
  const present=new Set(attendance.map(a=>`${a.member_id}|${manilaDay(a.checked_in_at)}`));
  const summaryRows=[
    ['VCCF '+label+' Monthly Attendance'],
    ['Month',monthName],
    ['Generated',new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'})],
    [],
    ['Area','Total Members','Active Members',...dates.map(dayLabel),'Average Attendance','Attendance Rate']
  ];
  let churchActive=0,churchAttendances=0,churchPossible=0;
  areas.forEach(area=>{
    const areaMembers=members.filter(m=>String(m.area_id||'')===String(area.id)),active=areaMembers.filter(isActive),dayCounts=dates.map(day=>active.filter(m=>present.has(`${m.id}|${day}`)).length),completedDates=dates.filter(d=>type!=='sunday'||d<=today),avg=completedDates.length?Math.round(dayCounts.slice(0,completedDates.length).reduce((s,n)=>s+n,0)/completedDates.length):0,possible=active.length*completedDates.length,attended=dayCounts.slice(0,completedDates.length).reduce((s,n)=>s+n,0),rate=possible?Math.round(attended/possible*100):0;
    churchActive+=active.length;churchAttendances+=attended;churchPossible+=possible;
    summaryRows.push([area.name,areaMembers.length,active.length,...dayCounts,avg,rate/100]);
  });
  summaryRows.push([],['Church-wide Active Members',churchActive],['Church-wide Attendance Rate',churchPossible?churchAttendances/churchPossible:0]);
  const summary=XLSX.utils.aoa_to_sheet(summaryRows);setWidths(summary,[24,15,16,...dates.map(()=>13),18,16]);
  const headerRow=5;addAutofilter(summary,`A${headerRow}:`+XLSX.utils.encode_col(4+dates.length)+`${headerRow+areas.length}`);
  const rateCol=4+dates.length;for(let r=headerRow;r<headerRow+areas.length;r++){const c=summary[XLSX.utils.encode_cell({r,c:rateCol})];if(c)c.z='0%'}const churchRate=summary[XLSX.utils.encode_cell({r:summaryRows.length-1,c:1})];if(churchRate)churchRate.z='0%';
  XLSX.utils.book_append_sheet(wb,summary,'Summary');

  areas.forEach(area=>{
    const areaMembers=members.filter(m=>String(m.area_id||'')===String(area.id)).sort((a,b)=>memberName(a).localeCompare(memberName(b),undefined,{sensitivity:'base'}));
    const rows=[
      [area.name+' — '+label+' Attendance'],
      ['Month',monthName],
      ['Present is marked with ✓. Blank means no attendance record.'],
      [],
      ['Member','Member Code','Status',...dates.map(dayLabel),'Present','Completed Dates','Attendance Rate']
    ];
    areaMembers.forEach(m=>{
      const marks=dates.map(day=>present.has(`${m.id}|${day}`)?'✓':''),completedDates=dates.filter(d=>type!=='sunday'||d<=today),presentCount=completedDates.filter(day=>present.has(`${m.id}|${day}`)).length,rate=completedDates.length?presentCount/completedDates.length:0;
      rows.push([memberName(m),m.member_code||'',isActive(m)?'Active':'Inactive',...marks,presentCount,completedDates.length,rate]);
    });
    const ws=XLSX.utils.aoa_to_sheet(rows);setWidths(ws,[30,16,12,...dates.map(()=>12),11,16,16]);addAutofilter(ws,`A5:${XLSX.utils.encode_col(5+dates.length)}${Math.max(5,rows.length)}`);
    const rateIndex=5+dates.length;for(let r=5;r<rows.length;r++){const cell=ws[XLSX.utils.encode_cell({r,c:rateIndex})];if(cell)cell.z='0%'}
    let sheetName=String(area.name||'Area').replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31)||'Area';let suffix=2,base=sheetName;while(wb.SheetNames.includes(sheetName)){sheetName=(base.slice(0,28)+' '+suffix++).slice(0,31)}XLSX.utils.book_append_sheet(wb,ws,sheetName);
  });
  wb.Props={Title:`VCCF ${label} Attendance - ${monthName}`,Subject:'Monthly attendance export',Author:'VCCF Connect',CreatedDate:new Date(),Comments:role==='area leader'?'Area-scoped export':'Church-wide export'};
  return wb;
}

async function exportMonth(type){
  const db=client(),kind=type==='sunday'?'sunday':'service',button=document.getElementById(kind==='sunday'?'exportSundayAttendanceExcel':'exportServiceAttendanceExcel');
  if(!db){notify('Database connection is unavailable.','error',button);return}
  const original=button?.textContent;clearReadyLink(button);if(button){button.disabled=true;button.textContent='Preparing Excel…'}notify('Preparing monthly Excel…','info',button);
  try{
    const profile=window.VCCF?.getState?.()?.profile||{},role=roleName(profile.role);if(!['admin','pastor','area leader'].includes(role))throw new Error('Only Admins, Pastors, and Area Leaders can export attendance records.');
    const month=selectedMonth(kind);if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Select a valid attendance date before exporting.');const bounds=monthBounds(month);
    const [XLSX,mr,ar,att]=await Promise.all([
      loadXlsx(),
      db.from('members').select('id,display_name,first_name,last_name,member_code,area_id,is_active,status').order('last_name').order('first_name'),
      db.from('areas').select('id,name,is_active').eq('is_active',true).order('name'),
      db.from('attendance').select('member_id,area_id,checked_in_at,attendance_type,service_area_id,service_barangay').gte('checked_in_at',bounds.start).lt('checked_in_at',bounds.end).order('checked_in_at')
    ]);
    if(mr.error)throw mr.error;if(ar.error)throw ar.error;if(att.error)throw att.error;
    let areas=(ar.data||[]).filter(a=>a.is_active!==false),members=mr.data||[],attendance=(att.data||[]).filter(a=>attendanceMatchesType(a,type));
    if(role==='area leader'&&profile.area_id){areas=areas.filter(a=>String(a.id)===String(profile.area_id));members=members.filter(m=>String(m.area_id)===String(profile.area_id));attendance=attendance.filter(a=>String(a.service_area_id||a.area_id||'')===String(profile.area_id))}
    if(!areas.length)throw new Error('No active Area is available in your export scope.');
    notify('Building workbook…','info',button);const wb=buildWorkbook(XLSX,{type,month,areas,members,attendance,role}),bytes=XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true});
    const label=typeLabel(type),scope=role==='area leader'?(areas[0]?.name||'area'):'all-areas',filename=`vccf-${fileSlug(label)}-attendance-${fileSlug(scope)}-${month}.xlsx`;
    saveArrayBuffer(bytes,filename,button);
  }catch(error){console.error('Attendance Excel export',error);notify('Excel export failed: '+(error?.message||error),'error',button)}finally{if(button){button.disabled=false;button.textContent=original||'Export Month Excel'}}
}
function ensureButtons(){
  const sundayControls=document.querySelector('#sundayAttendancePanel .attendance-record-controls');if(sundayControls&&!document.getElementById('exportSundayAttendanceExcel')){const b=document.createElement('button');b.id='exportSundayAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth('sunday');sundayControls.appendChild(b)}
  const serviceControls=document.querySelector('#serviceAttendancePanel .attendance-record-controls');if(serviceControls&&!document.getElementById('exportServiceAttendanceExcel')){const b=document.createElement('button');b.id='exportServiceAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth(currentServiceType());serviceControls.appendChild(b)}
}
window.VCCFAttendanceExport={exportMonth,ensureButtons};window.addEventListener('vccf-app-ready',()=>setTimeout(ensureButtons,80));window.addEventListener('vccf-service-attendance-updated',()=>setTimeout(ensureButtons,20));new MutationObserver(()=>ensureButtons()).observe(document.body,{childList:true,subtree:true});
})();
