(() => {
'use strict';
if(window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__) return;
window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__=true;

const TEMPLATE='/assets/monthly_attendance_tracker.xlsx?v=20260903-1';
const XMLNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const roleName=v=>String(v||'').trim().toLowerCase().replace(/_/g,' ');
const manilaDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const isActive=m=>m?.is_active!==false&&String(m?.status||'active').toLowerCase()!=='inactive';
const toast=message=>{const el=document.getElementById('toast');if(el){el.textContent=message;el.classList.add('show');clearTimeout(window.__vccfExcelToast);window.__vccfExcelToast=setTimeout(()=>el.classList.remove('show'),3200)}};
const client=()=>window.VCCF?.sb||null;

function loadJsZip(){
  if(window.JSZip)return Promise.resolve(window.JSZip);
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload=()=>window.JSZip?resolve(window.JSZip):reject(new Error('Excel template library did not initialize.'));
    s.onerror=()=>reject(new Error('Unable to load the Excel template library.'));
    document.head.appendChild(s);
  });
}
function monthBounds(month){
  const [y,m]=month.split('-').map(Number),ny=m===12?y+1:y,nm=m===12?1:m+1;
  return {start:new Date(`${month}-01T00:00:00+08:00`).toISOString(),end:new Date(`${ny}-${String(nm).padStart(2,'0')}-01T00:00:00+08:00`).toISOString()};
}
function sundaysForMonth(month){
  const [y,m]=month.split('-').map(Number),out=[],d=new Date(Date.UTC(y,m-1,1));
  while(d.getUTCMonth()===m-1){if(d.getUTCDay()===0)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}
  return out;
}
function excelSerial(day){
  if(!day)return null;const [y,m,d]=day.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000);
}
function typeLabel(type){return type==='bible_study'?'Bible Study':type==='midweek_service'?'Midweek Service':'Sunday'}
function typeHeader(type,index){return type==='bible_study'?`BS ${index}`:type==='midweek_service'?`MW ${index}`:`Sun ${index}`}
function fileSlug(v){return String(v||'attendance').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}

function parseXml(text){return new DOMParser().parseFromString(text,'application/xml')}
function serializeXml(doc){return '<?xml version="1.0" encoding="utf-8"?>'+new XMLSerializer().serializeToString(doc.documentElement)}
function getCell(doc,address){
  const cells=Array.from(doc.getElementsByTagNameNS(XMLNS,'c'));return cells.find(c=>c.getAttribute('r')===address)||null;
}
function clearChildren(cell){while(cell.firstChild)cell.removeChild(cell.firstChild)}
function setBlank(doc,address){
  const cell=getCell(doc,address);if(!cell)return;clearChildren(cell);cell.removeAttribute('t');
}
function setString(doc,address,value){
  const cell=getCell(doc,address);if(!cell)return;clearChildren(cell);cell.setAttribute('t','inlineStr');
  const is=doc.createElementNS(XMLNS,'is'),t=doc.createElementNS(XMLNS,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value??'');is.appendChild(t);cell.appendChild(is);
}
function setNumber(doc,address,value){
  const cell=getCell(doc,address);if(!cell)return;clearChildren(cell);cell.setAttribute('t','n');
  const v=doc.createElementNS(XMLNS,'v');v.textContent=String(Number(value)||0);cell.appendChild(v);
}
function setDateOrBlank(doc,address,day){if(day)setNumber(doc,address,excelSerial(day));else setBlank(doc,address)}

async function loadTemplate(){
  const JSZip=await loadJsZip(),response=await fetch(TEMPLATE,{cache:'no-store'});
  if(!response.ok)throw new Error('The August 27 attendance Excel template could not be loaded.');
  return JSZip.loadAsync(await response.arrayBuffer());
}
async function readSheet(zip,path){const file=zip.file(path);if(!file)throw new Error('Attendance template sheet is missing: '+path);return parseXml(await file.async('string'))}
async function writeSheet(zip,path,doc){zip.file(path,serializeXml(doc))}

function selectedMonth(kind){
  const input=kind==='sunday'?document.getElementById('richAttendanceDate'):document.getElementById('serviceAttendanceDate');
  const day=input?.value||manilaDay(new Date());return day.slice(0,7);
}
function currentServiceType(){return document.getElementById('serviceAttendanceType')?.value||'bible_study'}

async function exportMonth(type){
  const db=client();if(!db){toast('Database connection is unavailable.');return}
  const kind=type==='sunday'?'sunday':'service',button=document.getElementById(kind==='sunday'?'exportSundayAttendanceExcel':'exportServiceAttendanceExcel');
  const original=button?.textContent;if(button){button.disabled=true;button.textContent='Preparing Excel…'}
  try{
    const profile=window.VCCF?.getState?.()?.profile||{},role=roleName(profile.role);
    if(!['admin','pastor','area leader'].includes(role))throw new Error('Only Admins, Pastors, and Area Leaders can export attendance records.');
    const month=selectedMonth(kind),bounds=monthBounds(month);
    const [mr,ar,att]=await Promise.all([
      db.from('members').select('id,display_name,first_name,last_name,member_code,area_id,is_active,status').order('last_name').order('first_name'),
      db.from('areas').select('id,name,is_active').eq('is_active',true).order('name'),
      db.from('attendance').select('member_id,area_id,checked_in_at,attendance_type').eq('attendance_type',type).gte('checked_in_at',bounds.start).lt('checked_in_at',bounds.end).order('checked_in_at')
    ]);
    if(mr.error)throw mr.error;if(ar.error)throw ar.error;if(att.error)throw att.error;

    let areas=(ar.data||[]).filter(a=>a.is_active!==false),members=mr.data||[],attendance=att.data||[];
    if(role==='area leader'&&profile.area_id){areas=areas.filter(a=>String(a.id)===String(profile.area_id));members=members.filter(m=>String(m.area_id)===String(profile.area_id))}
    if(areas.length>3)throw new Error('The approved August 27 template supports up to three Areas. Please keep the export scope to three Areas or fewer.');

    let dates=type==='sunday'?sundaysForMonth(month):[...new Set(attendance.map(a=>manilaDay(a.checked_in_at)))].sort();
    if(dates.length>5)throw new Error(typeLabel(type)+' has more than five attendance dates in this month; the approved template has five date columns.');
    const present=new Set(attendance.map(a=>`${a.member_id}|${manilaDay(a.checked_in_at)}`));
    const zip=await loadTemplate();
    const summary=await readSheet(zip,'xl/worksheets/sheet1.xml');
    const sheetDocs=[
      await readSheet(zip,'xl/worksheets/sheet2.xml'),
      await readSheet(zip,'xl/worksheets/sheet3.xml'),
      await readSheet(zip,'xl/worksheets/sheet4.xml')
    ];

    const label=typeLabel(type),monthName=new Date(month+'-01T12:00:00+08:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'});
    setString(summary,'A1',type==='sunday'?'Monthly Attendance Summary':label+' Monthly Attendance Summary');
    setNumber(summary,'B2',excelSerial(month+'-01'));
    setString(summary,'D2',`Generated from VCCF ${label} attendance records for ${monthName}. This workbook uses the approved August 27 attendance template.`);
    for(let i=0;i<5;i++){
      const col=String.fromCharCode(67+i),day=dates[i]||'';
      setDateOrBlank(summary,col+'3',day);setString(summary,col+'4',typeHeader(type,i+1));
    }

    const areaSlots=[null,null,null];
    areas.forEach((area,i)=>areaSlots[i]=area);
    for(let i=0;i<3;i++){
      const doc=sheetDocs[i],area=areaSlots[i],sheetName='Area '+(i+1);
      setString(summary,'A'+(5+i),area?.name||sheetName);
      setString(doc,'A1',(area?.name||sheetName)+' — '+(type==='sunday'?'Monthly Attendance':label+' Attendance'));
      setString(doc,'A2','One row per member. Active/Inactive is shown in column B. Present cells are highlighted; blank cells mean no attendance record.');
      for(let d=0;d<5;d++){
        const col=String.fromCharCode(67+d);setString(doc,col+'3',typeHeader(type,d+1));setDateOrBlank(doc,col+'4',dates[d]||'');
      }
      for(let r=5;r<=153;r++){setBlank(doc,'A'+r);setBlank(doc,'B'+r);for(const col of ['C','D','E','F','G'])setBlank(doc,col+r)}
      if(area){
        const rows=members.filter(m=>String(m.area_id)===String(area.id)).sort((a,b)=>memberName(a).localeCompare(memberName(b),undefined,{sensitivity:'base'}));
        if(rows.length>149)throw new Error((area.name||sheetName)+' has more members than the approved template can hold (149 rows).');
        rows.forEach((m,index)=>{
          const r=5+index;setString(doc,'A'+r,memberName(m));setString(doc,'B'+r,isActive(m)?'Active':'Inactive');
          dates.forEach((day,d)=>{if(present.has(`${m.id}|${day}`))setString(doc,String.fromCharCode(67+d)+r,'Present')});
        });
      }
      await writeSheet(zip,'xl/worksheets/sheet'+(i+2)+'.xml',doc);
    }
    await writeSheet(zip,'xl/worksheets/sheet1.xml',summary);

    const wbFile=zip.file('xl/workbook.xml');
    if(wbFile){
      let wbXml=await wbFile.async('string');
      if(/<x:calcPr\b/.test(wbXml))wbXml=wbXml.replace(/<x:calcPr\b[^>]*\/?>(?:<\/x:calcPr>)?/,'<x:calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1" />');
      else wbXml=wbXml.replace('</x:workbook>','<x:calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1" /></x:workbook>');
      zip.file('xl/workbook.xml',wbXml);
    }

    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob),a=document.createElement('a'),scope=role==='area leader'?(areas[0]?.name||'area'):'all-areas';
    a.href=url;a.download=`vccf-${fileSlug(label)}-attendance-${fileSlug(scope)}-${month}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast(label+' attendance exported using the August 27 Excel template.');
  }catch(error){console.error('Attendance Excel export',error);toast('Excel export failed: '+(error?.message||error))}
  finally{if(button){button.disabled=false;button.textContent=original||'Export Excel'}}
}

function ensureButtons(){
  const sundayControls=document.querySelector('#sundayAttendancePanel .attendance-record-controls');
  if(sundayControls&&!document.getElementById('exportSundayAttendanceExcel')){
    const b=document.createElement('button');b.id='exportSundayAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth('sunday');sundayControls.appendChild(b);
  }
  const serviceControls=document.querySelector('#serviceAttendancePanel .attendance-record-controls');
  if(serviceControls&&!document.getElementById('exportServiceAttendanceExcel')){
    const b=document.createElement('button');b.id='exportServiceAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth(currentServiceType());serviceControls.appendChild(b);
  }
}
window.VCCFAttendanceExport={exportMonth,ensureButtons};
window.addEventListener('vccf-app-ready',()=>setTimeout(ensureButtons,80));
window.addEventListener('vccf-service-attendance-updated',()=>setTimeout(ensureButtons,20));
new MutationObserver(()=>ensureButtons()).observe(document.body,{childList:true,subtree:true});
})();