(() => {
'use strict';
if(window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__) return;
window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__=true;

const TEMPLATE='/assets/monthly_attendance_tracker.xlsx?v=20260903-1';
const XMLNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const EXCEL_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const roleName=v=>String(v||'').trim().toLowerCase().replace(/_/g,' ');
const manilaDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const isActive=m=>m?.is_active!==false&&String(m?.status||'active').toLowerCase()!=='inactive';
const client=()=>window.VCCF?.sb||null;

function ensureToast(){
  let el=document.getElementById('attendanceExportToast');
  if(el)return el;
  el=document.createElement('div');el.id='attendanceExportToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  Object.assign(el.style,{position:'fixed',left:'50%',bottom:'22px',transform:'translateX(-50%)',zIndex:'12000',maxWidth:'min(92vw,560px)',padding:'11px 14px',borderRadius:'12px',background:'rgba(17,24,39,.96)',color:'#fff',fontSize:'.78rem',fontWeight:'800',boxShadow:'0 12px 32px rgba(0,0,0,.24)',display:'none',textAlign:'center'});
  document.body.appendChild(el);return el;
}
function notify(message,kind='info',button=null){
  const el=ensureToast();el.textContent=message;el.style.display='block';el.style.background=kind==='error'?'rgba(180,35,24,.97)':kind==='success'?'rgba(22,118,71,.97)':'rgba(17,24,39,.96)';
  clearTimeout(window.__vccfExcelToast);window.__vccfExcelToast=setTimeout(()=>{el.style.display='none'},5200);
  if(button){let s=button.parentElement?.querySelector('.attendance-export-status');if(!s){s=document.createElement('span');s.className='attendance-export-status';s.setAttribute('aria-live','polite');Object.assign(s.style,{fontSize:'.68rem',color:'var(--muted)',maxWidth:'230px',lineHeight:'1.35'});button.insertAdjacentElement('afterend',s)}s.textContent=message;s.style.color=kind==='error'?'#b42318':kind==='success'?'#167647':'var(--muted)'}
}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src===src);
    if(existing){if(window.JSZip){resolve(window.JSZip);return}existing.addEventListener('load',()=>window.JSZip?resolve(window.JSZip):reject(new Error('Excel library did not initialize.')),{once:true});existing.addEventListener('error',()=>reject(new Error('Excel library failed to load.')),{once:true});return}
    const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';
    const timer=setTimeout(()=>{s.remove();reject(new Error('Excel library timed out while loading.'))},12000);
    s.onload=()=>{clearTimeout(timer);window.JSZip?resolve(window.JSZip):reject(new Error('Excel library did not initialize.'))};
    s.onerror=()=>{clearTimeout(timer);reject(new Error('Excel library failed to load.'))};document.head.appendChild(s);
  });
}
async function loadJsZip(){
  if(window.JSZip)return window.JSZip;
  const sources=['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://unpkg.com/jszip@3.10.1/dist/jszip.min.js'];
  let lastError=null;for(const src of sources){try{return await loadScript(src)}catch(e){lastError=e}}
  throw lastError||new Error('Unable to load the Excel workbook library. Check your internet connection and try again.');
}
function monthBounds(month){const [y,m]=month.split('-').map(Number),ny=m===12?y+1:y,nm=m===12?1:m+1;return {start:new Date(`${month}-01T00:00:00+08:00`).toISOString(),end:new Date(`${ny}-${String(nm).padStart(2,'0')}-01T00:00:00+08:00`).toISOString()}}
function sundaysForMonth(month){const [y,m]=month.split('-').map(Number),out=[],d=new Date(Date.UTC(y,m-1,1));while(d.getUTCMonth()===m-1){if(d.getUTCDay()===0)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out}
function excelSerial(day){if(!day)return null;const [y,m,d]=day.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000)}
function typeLabel(type){return type==='bible_study'?'Bible Study':type==='midweek_service'?'Midweek Service':'Sunday'}
function typeHeader(type,index){return type==='bible_study'?`BS ${index}`:type==='midweek_service'?`MW ${index}`:`Sun ${index}`}
function fileSlug(v){return String(v||'attendance').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function parseXml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('The Excel template contains invalid XML.');return doc}
function serializeXml(doc){return '<?xml version="1.0" encoding="utf-8"?>'+new XMLSerializer().serializeToString(doc.documentElement)}
function getCell(doc,address){return Array.from(doc.getElementsByTagNameNS(XMLNS,'c')).find(c=>c.getAttribute('r')===address)||null}
function clearChildren(cell){while(cell.firstChild)cell.removeChild(cell.firstChild)}
function setBlank(doc,address){const cell=getCell(doc,address);if(!cell)return;clearChildren(cell);cell.removeAttribute('t')}
function setString(doc,address,value){const cell=getCell(doc,address);if(!cell)return;clearChildren(cell);cell.setAttribute('t','inlineStr');const is=doc.createElementNS(XMLNS,'is'),t=doc.createElementNS(XMLNS,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value??'');is.appendChild(t);cell.appendChild(is)}
function setNumber(doc,address,value){const cell=getCell(doc,address);if(!cell)return;clearChildren(cell);cell.setAttribute('t','n');const v=doc.createElementNS(XMLNS,'v');v.textContent=String(Number(value)||0);cell.appendChild(v)}
function setDateOrBlank(doc,address,day){if(day)setNumber(doc,address,excelSerial(day));else setBlank(doc,address)}
async function loadTemplate(){const JSZip=await loadJsZip(),response=await fetch(TEMPLATE,{cache:'no-store'});if(!response.ok)throw new Error('The attendance Excel template could not be loaded.');const bytes=await response.arrayBuffer();if(!bytes.byteLength)throw new Error('The attendance Excel template is empty.');return JSZip.loadAsync(bytes)}
async function readSheet(zip,path){const file=zip.file(path);if(!file)throw new Error('Attendance template sheet is missing: '+path);return parseXml(await file.async('string'))}
async function writeSheet(zip,path,doc){zip.file(path,serializeXml(doc))}
function selectedMonth(kind){const input=kind==='sunday'?document.getElementById('richAttendanceDate'):document.getElementById('serviceAttendanceDate');const day=input?.value||manilaDay(new Date());return day.slice(0,7)}
function currentServiceType(){return document.getElementById('serviceAttendanceType')?.value||'bible_study'}
function attendanceMatchesType(row,type){const v=String(row?.attendance_type||'').trim().toLowerCase();return type==='sunday'?(v===''||v==='sunday'):v===type}
function clearOldReadyLink(button){button?.parentElement?.querySelector('.attendance-export-ready')?.remove()}
function downloadWorkbook(blob,filename,button){
  clearOldReadyLink(button);
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';document.body.appendChild(a);
  const fallback=document.createElement('a');fallback.className='attendance-export-ready';fallback.href=url;fallback.download=filename;fallback.rel='noopener';fallback.textContent='Download Excel';Object.assign(fallback.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'10px',fontSize:'.7rem',fontWeight:'900',color:'var(--brand)',background:'var(--card)',textDecoration:'none'});button?.insertAdjacentElement('afterend',fallback);
  try{a.click()}catch(e){console.warn('Automatic Excel download was blocked',e)}
  notify('Excel is ready. If the download did not start automatically, tap “Download Excel”.','success',button);
  setTimeout(()=>{a.remove();fallback.remove();URL.revokeObjectURL(url)},120000);
}
async function exportMonth(type){
  const db=client(),kind=type==='sunday'?'sunday':'service',button=document.getElementById(kind==='sunday'?'exportSundayAttendanceExcel':'exportServiceAttendanceExcel');
  if(!db){notify('Database connection is unavailable.','error',button);return}
  const original=button?.textContent;clearOldReadyLink(button);if(button){button.disabled=true;button.textContent='Preparing Excel…'}notify('Preparing monthly Excel…','info',button);
  try{
    const profile=window.VCCF?.getState?.()?.profile||{},role=roleName(profile.role);if(!['admin','pastor','area leader'].includes(role))throw new Error('Only Admins, Pastors, and Area Leaders can export attendance records.');
    const month=selectedMonth(kind),bounds=monthBounds(month);if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Select a valid attendance date before exporting.');
    const [mr,ar,att]=await Promise.all([
      db.from('members').select('id,display_name,first_name,last_name,member_code,area_id,is_active,status').order('last_name').order('first_name'),
      db.from('areas').select('id,name,is_active').eq('is_active',true).order('name'),
      db.from('attendance').select('member_id,area_id,checked_in_at,attendance_type').gte('checked_in_at',bounds.start).lt('checked_in_at',bounds.end).order('checked_in_at')
    ]);
    if(mr.error)throw mr.error;if(ar.error)throw ar.error;if(att.error)throw att.error;
    let areas=(ar.data||[]).filter(a=>a.is_active!==false),members=mr.data||[],attendance=(att.data||[]).filter(a=>attendanceMatchesType(a,type));
    if(role==='area leader'&&profile.area_id){areas=areas.filter(a=>String(a.id)===String(profile.area_id));members=members.filter(m=>String(m.area_id)===String(profile.area_id));attendance=attendance.filter(a=>String(a.area_id||'')===String(profile.area_id))}
    if(!areas.length)throw new Error('No active Area is available in your export scope.');if(areas.length>3)throw new Error('The approved attendance template supports up to three Areas.');
    let dates=type==='sunday'?sundaysForMonth(month):[...new Set(attendance.map(a=>manilaDay(a.checked_in_at)))].sort();if(dates.length>5)throw new Error(typeLabel(type)+' has more than five attendance dates in this month; the approved template has five date columns.');
    const present=new Set(attendance.map(a=>`${a.member_id}|${manilaDay(a.checked_in_at)}`));notify('Building workbook…','info',button);
    const zip=await loadTemplate(),summary=await readSheet(zip,'xl/worksheets/sheet1.xml'),sheetDocs=[await readSheet(zip,'xl/worksheets/sheet2.xml'),await readSheet(zip,'xl/worksheets/sheet3.xml'),await readSheet(zip,'xl/worksheets/sheet4.xml')];
    const label=typeLabel(type),monthName=new Date(month+'-01T12:00:00+08:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'});
    setString(summary,'A1',type==='sunday'?'Monthly Attendance Summary':label+' Monthly Attendance Summary');setNumber(summary,'B2',excelSerial(month+'-01'));setString(summary,'D2',`Generated from VCCF ${label} attendance records for ${monthName}. This workbook uses the approved August 27 attendance template.`);
    for(let i=0;i<5;i++){const col=String.fromCharCode(67+i),day=dates[i]||'';setDateOrBlank(summary,col+'3',day);setString(summary,col+'4',typeHeader(type,i+1))}
    const areaSlots=[null,null,null];areas.forEach((area,i)=>areaSlots[i]=area);
    for(let i=0;i<3;i++){
      const doc=sheetDocs[i],area=areaSlots[i],sheetName='Area '+(i+1);setString(summary,'A'+(5+i),area?.name||sheetName);setString(doc,'A1',(area?.name||sheetName)+' — '+(type==='sunday'?'Monthly Attendance':label+' Attendance'));setString(doc,'A2','One row per member. Active/Inactive is shown in column B. Present cells are highlighted; blank cells mean no attendance record.');
      for(let d=0;d<5;d++){const col=String.fromCharCode(67+d);setString(doc,col+'3',typeHeader(type,d+1));setDateOrBlank(doc,col+'4',dates[d]||'')}
      for(let r=5;r<=153;r++){setBlank(doc,'A'+r);setBlank(doc,'B'+r);for(const col of ['C','D','E','F','G'])setBlank(doc,col+r)}
      if(area){const rows=members.filter(m=>String(m.area_id)===String(area.id)).sort((a,b)=>memberName(a).localeCompare(memberName(b),undefined,{sensitivity:'base'}));if(rows.length>149)throw new Error((area.name||sheetName)+' has more members than the attendance template can hold (149 rows).');rows.forEach((m,index)=>{const r=5+index;setString(doc,'A'+r,memberName(m));setString(doc,'B'+r,isActive(m)?'Active':'Inactive');dates.forEach((day,d)=>{if(present.has(`${m.id}|${day}`))setString(doc,String.fromCharCode(67+d)+r,'Present')})})}
      await writeSheet(zip,'xl/worksheets/sheet'+(i+2)+'.xml',doc);
    }
    await writeSheet(zip,'xl/worksheets/sheet1.xml',summary);
    const wbFile=zip.file('xl/workbook.xml');if(wbFile){let wbXml=await wbFile.async('string');if(/<calcPr\b[^>]*\/?>(?:<\/calcPr>)?/.test(wbXml))wbXml=wbXml.replace(/<calcPr\b[^>]*\/?>(?:<\/calcPr>)?/,'<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');else wbXml=wbXml.replace(/<\/workbook>\s*$/,'<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');zip.file('xl/workbook.xml',wbXml)}
    notify('Finalizing Excel file…','info',button);const blob=await zip.generateAsync({type:'blob',mimeType:EXCEL_MIME,compression:'DEFLATE'}),scope=role==='area leader'?(areas[0]?.name||'area'):'all-areas',filename=`vccf-${fileSlug(label)}-attendance-${fileSlug(scope)}-${month}.xlsx`;downloadWorkbook(blob,filename,button);
  }catch(error){console.error('Attendance Excel export',error);notify('Excel export failed: '+(error?.message||error),'error',button)}finally{if(button){button.disabled=false;button.textContent=original||'Export Month Excel'}}
}
function ensureButtons(){
  const sundayControls=document.querySelector('#sundayAttendancePanel .attendance-record-controls');if(sundayControls&&!document.getElementById('exportSundayAttendanceExcel')){const b=document.createElement('button');b.id='exportSundayAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth('sunday');sundayControls.appendChild(b)}
  const serviceControls=document.querySelector('#serviceAttendancePanel .attendance-record-controls');if(serviceControls&&!document.getElementById('exportServiceAttendanceExcel')){const b=document.createElement('button');b.id='exportServiceAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth(currentServiceType());serviceControls.appendChild(b)}
}
window.VCCFAttendanceExport={exportMonth,ensureButtons};window.addEventListener('vccf-app-ready',()=>setTimeout(ensureButtons,80));window.addEventListener('vccf-service-attendance-updated',()=>setTimeout(ensureButtons,20));new MutationObserver(()=>ensureButtons()).observe(document.body,{childList:true,subtree:true});
})();
