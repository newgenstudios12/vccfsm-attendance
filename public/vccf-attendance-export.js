(() => {
'use strict';
if(window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__) return;
window.__VCCF_ATTENDANCE_TEMPLATE_EXPORT__=true;

const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BRAND_RED='FFD71920', BRAND_ORANGE='FFFF8A18', BRAND_DARK='FF202632', BRAND_MUTED='FF667085';
const BRAND_LIGHT='FFFFF4F1', LINE='FFD7DCE3', GREEN='FFDDF5E8', GREEN_TEXT='FF167647', GREY='FFF2F4F7';
const roleName=v=>String(v||'').trim().toLowerCase().replace(/_/g,' ');
const manilaDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const memberName=m=>m?.display_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||m?.member_code||'Member';
const isActive=m=>m?.is_active!==false&&String(m?.status||'active').toLowerCase()!=='inactive';
const client=()=>window.VCCF?.sb||null;
const fileSlug=v=>String(v||'attendance').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const norm=v=>String(v||'').trim().toLocaleLowerCase('en-PH');

function ensureToast(){
  let el=document.getElementById('attendanceExportToast');
  if(el)return el;
  el=document.createElement('div');el.id='attendanceExportToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  Object.assign(el.style,{position:'fixed',left:'50%',bottom:'22px',transform:'translateX(-50%)',zIndex:'12000',maxWidth:'min(92vw,620px)',padding:'11px 14px',borderRadius:'12px',background:'rgba(17,24,39,.96)',color:'#fff',fontSize:'.78rem',fontWeight:'800',boxShadow:'0 12px 32px rgba(0,0,0,.24)',display:'none',textAlign:'center'});
  document.body.appendChild(el);return el;
}
function notify(message,kind='info',button=null){
  const el=ensureToast();el.textContent=message;el.style.display='block';el.style.background=kind==='error'?'rgba(180,35,24,.97)':kind==='success'?'rgba(22,118,71,.97)':'rgba(17,24,39,.96)';
  clearTimeout(window.__vccfExcelToast);window.__vccfExcelToast=setTimeout(()=>{el.style.display='none'},6500);
  if(button){let s=button.parentElement?.querySelector('.attendance-export-status');if(!s){s=document.createElement('span');s.className='attendance-export-status';s.setAttribute('aria-live','polite');Object.assign(s.style,{fontSize:'.68rem',color:'var(--muted)',maxWidth:'270px',lineHeight:'1.35'});button.insertAdjacentElement('afterend',s)}s.textContent=message;s.style.color=kind==='error'?'#b42318':kind==='success'?'#167647':'var(--muted)'}
}
function loadExternalScript(src,ready){
  return new Promise((resolve,reject)=>{
    if(ready()){resolve(ready());return}
    const existing=[...document.scripts].find(s=>s.src===src);
    if(existing){existing.addEventListener('load',()=>ready()?resolve(ready()):reject(new Error('Excel library did not initialize.')),{once:true});existing.addEventListener('error',()=>reject(new Error('Excel library failed to load.')),{once:true});return}
    const s=document.createElement('script');s.src=src;s.async=true;s.crossOrigin='anonymous';
    const timer=setTimeout(()=>{s.remove();reject(new Error('Excel library timed out while loading.'))},18000);
    s.onload=()=>{clearTimeout(timer);ready()?resolve(ready()):reject(new Error('Excel library did not initialize.'))};
    s.onerror=()=>{clearTimeout(timer);reject(new Error('Excel library failed to load.'))};document.head.appendChild(s);
  });
}
async function loadExcelJS(){
  if(window.ExcelJS)return window.ExcelJS;
  const sources=['https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js','https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'];
  let lastError=null;for(const src of sources){try{return await loadExternalScript(src,()=>window.ExcelJS)}catch(e){lastError=e}}
  throw lastError||new Error('Unable to load the Excel workbook library. Check your internet connection and try again.');
}
async function churchLogo(){
  try{
    const r=await fetch('/vccf-logo-black.png?v=20260903-2',{cache:'force-cache'});if(!r.ok)return null;const blob=await r.blob();
    return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=reject;fr.readAsDataURL(blob)});
  }catch(e){console.warn('Excel logo unavailable',e);return null}
}
function monthBounds(month){const [y,m]=month.split('-').map(Number),ny=m===12?y+1:y,nm=m===12?1:m+1;return {start:new Date(`${month}-01T00:00:00+08:00`).toISOString(),end:new Date(`${ny}-${String(nm).padStart(2,'0')}-01T00:00:00+08:00`).toISOString()}}
function sundaysForMonth(month){const [y,m]=month.split('-').map(Number),out=[],d=new Date(Date.UTC(y,m-1,1));while(d.getUTCMonth()===m-1){if(d.getUTCDay()===0)out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1)}return out}
function selectedMonth(kind){const input=kind==='sunday'?document.getElementById('richAttendanceDate'):document.getElementById('serviceAttendanceDate');const day=input?.value||manilaDay(new Date());return day.slice(0,7)}
function currentServiceType(){return document.getElementById('serviceAttendanceType')?.value||'bible_study'}
function typeLabel(type){return type==='bible_study'?'Bible Study':type==='midweek_service'?'Midweek Service':'Sunday Worship'}
function attendanceMatchesType(row,type){const v=String(row?.attendance_type||'').trim().toLowerCase();return type==='sunday'?(v===''||v==='sunday'):v===type}
function dayLabel(day){return new Date(day+'T12:00:00+08:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
function monthLabel(month){return new Date(month+'-01T12:00:00+08:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'})}
function clearReadyLink(button){button?.parentElement?.querySelector('.attendance-export-ready')?.remove()}
function saveBuffer(bytes,filename,button){
  clearReadyLink(button);
  const blob=new Blob([bytes],{type:XLSX_MIME}),url=URL.createObjectURL(blob),auto=document.createElement('a');auto.href=url;auto.download=filename;auto.rel='noopener';auto.style.display='none';document.body.appendChild(auto);
  const fallback=document.createElement('a');fallback.className='attendance-export-ready';fallback.href=url;fallback.download=filename;fallback.rel='noopener';fallback.textContent='Download Excel';Object.assign(fallback.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'10px',fontSize:'.7rem',fontWeight:'900',color:'var(--brand)',background:'var(--card)',textDecoration:'none'});button?.insertAdjacentElement('afterend',fallback);
  try{auto.click()}catch(e){console.warn('Automatic Excel download was blocked',e)}
  notify('Excel is ready. If it did not download automatically, tap “Download Excel”.','success',button);
  setTimeout(()=>{auto.remove();fallback.remove();URL.revokeObjectURL(url)},180000);
}
function safeSheetName(value,used){let base=String(value||'Report').replace(/[\\/?*\[\]:]/g,' ').replace(/\s+/g,' ').trim().slice(0,31)||'Report',name=base,i=2;while(used.has(name)){name=(base.slice(0,27)+' '+i++).slice(0,31)}used.add(name);return name}
function areaName(areas,id){return areas.find(a=>String(a.id)===String(id))?.name||'Unassigned'}
function groupKey(areaId,barangay=''){return String(areaId||'')+'|'+norm(barangay)}
function buildGroups(type,areas,members,attendance){
  if(type!=='bible_study')return areas.map(a=>({key:String(a.id),areaId:a.id,area:a.name,barangay:'',label:a.name,members:members.filter(m=>String(m.area_id||'')===String(a.id))}));
  const map=new Map();
  members.filter(isActive).forEach(m=>{const b=String(m.barangay||'').trim();if(!b)return;const key=groupKey(m.area_id,b);if(!map.has(key))map.set(key,{key,areaId:m.area_id,area:areaName(areas,m.area_id),barangay:b,label:areaName(areas,m.area_id)+' · '+b,members:[]});map.get(key).members.push(m)});
  attendance.forEach(a=>{const b=String(a.service_barangay||'').trim();if(!b)return;const aid=a.service_area_id||a.area_id||'';const key=groupKey(aid,b);if(!map.has(key))map.set(key,{key,areaId:aid,area:areaName(areas,aid),barangay:b,label:areaName(areas,aid)+' · '+b,members:members.filter(m=>String(m.area_id||'')===String(aid)&&norm(m.barangay)===norm(b))})});
  return [...map.values()].sort((a,b)=>a.area.localeCompare(b.area)||a.barangay.localeCompare(b.barangay));
}
function attendanceForGroup(type,group,attendance){
  if(type==='bible_study')return attendance.filter(a=>String(a.service_area_id||a.area_id||'')===String(group.areaId)&&norm(a.service_barangay)===norm(group.barangay));
  return attendance.filter(a=>String(a.service_area_id||a.area_id||'')===String(group.areaId));
}
function borders(){return {top:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}}}}
function styleHeader(row){row.height=27;row.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:BRAND_RED}};cell.font={bold:true,color:{argb:'FFFFFFFF'},size:10};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border=borders()})}
function styleBody(row){row.eachCell({includeEmpty:true},cell=>{cell.border=borders();cell.alignment={vertical:'middle',horizontal:'left'};cell.font={size:10,color:{argb:BRAND_DARK}}})}
function addBranding(workbook,ws,title,subtitle,logoData,lastCol){
  ws.mergeCells(1,3,1,lastCol);ws.mergeCells(2,3,2,lastCol);ws.mergeCells(3,3,3,lastCol);
  const titleCell=ws.getCell(1,3);titleCell.value=title;titleCell.font={bold:true,size:17,color:{argb:BRAND_DARK}};titleCell.alignment={vertical:'middle'};
  const sub=ws.getCell(2,3);sub.value=subtitle;sub.font={bold:true,size:10,color:{argb:BRAND_RED}};
  const meta=ws.getCell(3,3);meta.value='Generated '+new Date().toLocaleString('en-PH',{timeZone:'Asia/Manila'})+' · VCCF Connect';meta.font={size:9,color:{argb:BRAND_MUTED}};
  ws.getRow(1).height=27;ws.getRow(2).height=19;ws.getRow(3).height=18;
  if(logoData){try{const id=workbook.addImage({base64:logoData,extension:'png'});ws.addImage(id,{tl:{col:.08,row:.05},ext:{width:150,height:52}})}catch(e){console.warn('Excel logo could not be inserted',e)}}
}
function setPage(ws){ws.views=[{state:'frozen',ySplit:5}];ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.45,bottom:.45,header:.15,footer:.15}};ws.headerFooter={oddFooter:'VCCF Santa Maria · &F · Page &P of &N'};ws.properties.defaultRowHeight=19}
function addSummarySheet(workbook,{type,month,groups,attendance,logoData}){
  const ws=workbook.addWorksheet('Summary',{properties:{tabColor:{argb:BRAND_RED}}}),dates=type==='sunday'?sundaysForMonth(month):[...new Set(attendance.map(a=>manilaDay(a.checked_in_at)))].sort(),today=manilaDay(new Date());
  const fixed=type==='bible_study'?4:3,lastCol=fixed+dates.length+2;addBranding(workbook,ws,'VCCF Santa Maria — '+typeLabel(type)+' Attendance Report',monthLabel(month),logoData,lastCol);ws.getRow(4).height=8;
  const headers=type==='bible_study'?['Area','Barangay / Cellgroup','Active Members','Total Members',...dates.map(dayLabel),'Average Attendance','Attendance Rate']:['Area','Active Members','Total Members',...dates.map(dayLabel),'Average Attendance','Attendance Rate'];
  ws.getRow(5).values=headers;styleHeader(ws.getRow(5));
  let rowIndex=6,totalActive=0,totalPossible=0,totalPresent=0;
  groups.forEach(group=>{
    const gAtt=attendanceForGroup(type,group,attendance),members=group.members||[],active=members.filter(isActive),completed=dates.filter(d=>type!=='sunday'||d<=today),counts=dates.map(day=>new Set(gAtt.filter(a=>manilaDay(a.checked_in_at)===day).map(a=>a.member_id)).size),attended=completed.reduce((sum,day)=>sum+new Set(gAtt.filter(a=>manilaDay(a.checked_in_at)===day).map(a=>a.member_id)).size,0),possible=active.length*completed.length,rate=possible?attended/possible:0,avg=completed.length?attended/completed.length:0;
    totalActive+=active.length;totalPossible+=possible;totalPresent+=attended;
    const row=ws.getRow(rowIndex++);row.values=type==='bible_study'?[group.area,group.barangay,active.length,members.length,...counts,avg,rate]:[group.area,active.length,members.length,...counts,avg,rate];styleBody(row);row.getCell(lastCol).numFmt='0%';row.getCell(lastCol-1).numFmt='0.0';
  });
  const totalRow=ws.getRow(rowIndex+1);totalRow.values=type==='bible_study'?['MONTH TOTALS','',totalActive,'',...dates.map(()=>''),'',totalPossible?totalPresent/totalPossible:0]:['MONTH TOTALS',totalActive,'',...dates.map(()=>''),'',totalPossible?totalPresent/totalPossible:0];totalRow.eachCell({includeEmpty:true},c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:BRAND_LIGHT}};c.font={bold:true,color:{argb:BRAND_DARK}};c.border=borders()});totalRow.getCell(lastCol).numFmt='0%';
  ws.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,rowIndex-1),column:lastCol}};
  const widths=type==='bible_study'?[18,24,15,14]:[20,15,14];widths.forEach((w,i)=>ws.getColumn(i+1).width=w);dates.forEach((_,i)=>ws.getColumn(fixed+i+1).width=12);ws.getColumn(lastCol-1).width=18;ws.getColumn(lastCol).width=16;
  setPage(ws);return ws;
}
function addDetailSheet(workbook,{type,month,group,attendance,logoData,usedNames}){
  const gAtt=attendanceForGroup(type,group,attendance),dates=type==='sunday'?sundaysForMonth(month):[...new Set(gAtt.map(a=>manilaDay(a.checked_in_at)))].sort(),today=manilaDay(new Date()),members=(group.members||[]).slice().sort((a,b)=>memberName(a).localeCompare(memberName(b),undefined,{sensitivity:'base'}));
  const label=type==='bible_study'?group.area+' · '+group.barangay:group.area,name=safeSheetName(label,usedNames),lastCol=3+dates.length+3,ws=workbook.addWorksheet(name,{properties:{tabColor:{argb:type==='bible_study'?BRAND_ORANGE:BRAND_RED}}});
  addBranding(workbook,ws,label+' — '+typeLabel(type)+' Attendance',monthLabel(month),logoData,lastCol);ws.getRow(4).height=8;
  const headers=['Member','Member Code','Status',...dates.map(dayLabel),'Present','Completed Dates','Attendance Rate'];ws.getRow(5).values=headers;styleHeader(ws.getRow(5));
  const present=new Set(gAtt.map(a=>`${a.member_id}|${manilaDay(a.checked_in_at)}`)),completed=dates.filter(d=>type!=='sunday'||d<=today);
  members.forEach((m,index)=>{
    const marks=dates.map(day=>present.has(`${m.id}|${day}`)?'Present':''),presentCount=completed.filter(day=>present.has(`${m.id}|${day}`)).length,rate=completed.length?presentCount/completed.length:0,row=ws.getRow(6+index);row.values=[memberName(m),m.member_code||'',isActive(m)?'Active':'Inactive',...marks,presentCount,completed.length,rate];styleBody(row);row.getCell(lastCol).numFmt='0%';
    if(!isActive(m))row.eachCell({includeEmpty:true},c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:GREY}};c.font={size:10,color:{argb:BRAND_MUTED}}});
    marks.forEach((mark,i)=>{if(!mark)return;const c=row.getCell(4+i);c.fill={type:'pattern',pattern:'solid',fgColor:{argb:GREEN}};c.font={bold:true,color:{argb:GREEN_TEXT},size:9};c.alignment={horizontal:'center',vertical:'middle'};c.border=borders()});
  });
  ws.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,5+members.length),column:lastCol}};ws.getColumn(1).width=30;ws.getColumn(2).width=16;ws.getColumn(3).width=12;dates.forEach((_,i)=>ws.getColumn(4+i).width=12);ws.getColumn(lastCol-2).width=11;ws.getColumn(lastCol-1).width=16;ws.getColumn(lastCol).width=16;
  ws.getCell(3,lastCol).alignment={horizontal:'right'};setPage(ws);return ws;
}
async function buildWorkbook(ExcelJS,{type,month,areas,members,attendance,role,logoData}){
  const workbook=new ExcelJS.Workbook();workbook.creator='VCCF Connect';workbook.lastModifiedBy='VCCF Connect';workbook.created=new Date();workbook.modified=new Date();workbook.subject='Monthly attendance report based on the August 27 VCCF attendance template';workbook.title='VCCF '+typeLabel(type)+' Attendance — '+monthLabel(month);workbook.company='VCCF Santa Maria';
  const groups=buildGroups(type,areas,members,attendance);addSummarySheet(workbook,{type,month,groups,attendance,logoData});const usedNames=new Set(['Summary']);groups.forEach(group=>addDetailSheet(workbook,{type,month,group,attendance,logoData,usedNames}));
  if(!groups.length){const ws=workbook.getWorksheet('Summary');ws.getCell('A7').value='No member groups are available for this report scope.'}
  return workbook;
}

async function exportMonth(type){
  const db=client(),kind=type==='sunday'?'sunday':'service',button=document.getElementById(kind==='sunday'?'exportSundayAttendanceExcel':'exportServiceAttendanceExcel');
  if(!db){notify('Database connection is unavailable.','error',button);return}
  const original=button?.textContent;clearReadyLink(button);if(button){button.disabled=true;button.textContent='Preparing Excel…'}notify('Preparing August 27-style report…','info',button);
  try{
    const profile=window.VCCF?.getState?.()?.profile||{},role=roleName(profile.role);if(!['admin','pastor','area leader'].includes(role))throw new Error('Only Admins, Pastors, and Area Leaders can export attendance records.');
    const month=selectedMonth(kind);if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Select a valid attendance date before exporting.');const bounds=monthBounds(month);
    const [ExcelJS,logoData,mr,ar,att]=await Promise.all([
      loadExcelJS(),churchLogo(),
      db.from('members').select('id,display_name,first_name,last_name,member_code,area_id,is_active,status,barangay').order('last_name').order('first_name'),
      db.from('areas').select('id,name,is_active').eq('is_active',true).order('name'),
      db.from('attendance').select('member_id,area_id,checked_in_at,attendance_type,service_area_id,service_barangay').gte('checked_in_at',bounds.start).lt('checked_in_at',bounds.end).order('checked_in_at')
    ]);
    if(mr.error)throw mr.error;if(ar.error)throw ar.error;if(att.error)throw att.error;
    let areas=(ar.data||[]).filter(a=>a.is_active!==false),members=mr.data||[],attendance=(att.data||[]).filter(a=>attendanceMatchesType(a,type));
    if(role==='area leader'&&profile.area_id){areas=areas.filter(a=>String(a.id)===String(profile.area_id));members=members.filter(m=>String(m.area_id)===String(profile.area_id));attendance=attendance.filter(a=>String(a.service_area_id||a.area_id||'')===String(profile.area_id))}
    if(!areas.length)throw new Error('No active Area is available in your export scope.');
    notify('Building formatted workbook with church logo…','info',button);const workbook=await buildWorkbook(ExcelJS,{type,month,areas,members,attendance,role,logoData}),bytes=await workbook.xlsx.writeBuffer();
    const label=typeLabel(type),scope=role==='area leader'?(areas[0]?.name||'area'):'all-areas',filename=`vccf-${fileSlug(label)}-attendance-${fileSlug(scope)}-${month}.xlsx`;saveBuffer(bytes,filename,button);
  }catch(error){console.error('Attendance Excel export',error);notify('Excel export failed: '+(error?.message||error),'error',button)}finally{if(button){button.disabled=false;button.textContent=original||'Export Month Excel'}}
}
function ensureButtons(){
  const sundayControls=document.querySelector('#sundayAttendancePanel .attendance-record-controls');if(sundayControls&&!document.getElementById('exportSundayAttendanceExcel')){const b=document.createElement('button');b.id='exportSundayAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth('sunday');sundayControls.appendChild(b)}
  const serviceControls=document.querySelector('#serviceAttendancePanel .attendance-record-controls');if(serviceControls&&!document.getElementById('exportServiceAttendanceExcel')){const b=document.createElement('button');b.id='exportServiceAttendanceExcel';b.type='button';b.className='btn secondary';b.textContent='Export Month Excel';b.onclick=()=>exportMonth(currentServiceType());serviceControls.appendChild(b)}
}
window.VCCFAttendanceExport={exportMonth,ensureButtons};window.addEventListener('vccf-app-ready',()=>setTimeout(ensureButtons,80));window.addEventListener('vccf-service-attendance-updated',()=>setTimeout(ensureButtons,20));new MutationObserver(()=>ensureButtons()).observe(document.body,{childList:true,subtree:true});
})();
