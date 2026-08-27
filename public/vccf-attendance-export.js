(() => {
  if (window.__VCCF_ATTENDANCE_EXPORT_V3__) return;
  window.__VCCF_ATTENDANCE_EXPORT_V3__ = true;

  const roleName = v => String(v || '').trim().toLowerCase().replace(/_/g, ' ');
  const manilaDate = v => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(v));
  const toast = message => { const el=document.getElementById('toast'); if(el){el.textContent=message;el.classList.add('show');clearTimeout(window.__vccfExportToast);window.__vccfExportToast=setTimeout(()=>el.classList.remove('show'),2800)} };

  function getClient(){
    if(window.__VCCF_EXPORT_CLIENT__) return window.__VCCF_EXPORT_CLIENT__;
    if(!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    window.__VCCF_EXPORT_CLIENT__ = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return window.__VCCF_EXPORT_CLIENT__;
  }

  function currentMonth(){
    const input = document.querySelector('#attendance input[type="month"], #attendanceMonth, #attendance input[data-attendance-month]');
    if(input?.value && /^\\d{4}-\\d{2}$/.test(input.value)) return input.value;
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit'}).format(new Date());
  }

  function sundaysForMonth(month){
    const [y,m]=month.split('-').map(Number);
    const out=[];
    const d=new Date(Date.UTC(y,m-1,1));
    while(d.getUTCMonth()===m-1){ if(d.getUTCDay()===0) out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
    return out;
  }

  function loadSheetJs(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Excel library did not initialize.'));
      s.onerror=()=>reject(new Error('Unable to load the Excel download library.'));
      document.head.appendChild(s);
    });
  }

  function findAttendanceView(){ return document.getElementById('attendance') || document.getElementById('attendanceRows')?.closest('.view') || null; }

  function addExportButton(){
    if(document.getElementById('vccfExportAttendance')) return true;
    const view=findAttendanceView();
    if(!view || !view.classList.contains('active')) return false;
    const rows=document.getElementById('attendanceRows');
    if(!rows) return false;
    const button=document.createElement('button');
    button.id='vccfExportAttendance';button.type='button';button.className='btn secondary';
    button.textContent='Download Sunday Attendance';button.style.cssText='white-space:nowrap;';
    button.addEventListener('click', exportAttendance);
    const panel=rows.closest('.panel');
    if(panel){
      const actions=document.createElement('div');actions.className='vccf-export-actions';
      actions.style.cssText='display:flex;justify-content:flex-end;align-items:center;margin-top:16px;padding-top:4px;';
      actions.appendChild(button);panel.appendChild(actions);
    } else view.appendChild(button);
    return true;
  }

  const FILL_RED='D71920', FILL_LIGHT='FFF4F1', FILL_GREEN='DCFCE7', FILL_ORANGE='FFF1E6', FONT_DARK='111318', FONT_MUTED='6D7280';
  const thin={style:'thin',color:{rgb:'E6E7EB'}};
  const border={top:thin,bottom:thin,left:thin,right:thin};
  const titleStyle={font:{bold:true,color:{rgb:'FFFFFF'},sz:16},fill:{fgColor:{rgb:FILL_RED}},alignment:{horizontal:'center',vertical:'center'}};
  const headerStyle={font:{bold:true,color:{rgb:'FFFFFF'},sz:10},fill:{fgColor:{rgb:FILL_RED}},alignment:{horizontal:'center',vertical:'center',wrapText:true},border};
  const subStyle={font:{italic:true,color:{rgb:FONT_MUTED},sz:9},alignment:{wrapText:true,vertical:'center'}};
  const activeStyle={fill:{fgColor:{rgb:FILL_ORANGE}},font:{bold:true,color:{rgb:FONT_DARK}},border};
  const presentStyle={fill:{fgColor:{rgb:FILL_GREEN}},font:{bold:true,color:{rgb:'166534'}},alignment:{horizontal:'center'},border};
  const bodyStyle={border,alignment:{vertical:'center'}};
  const percentStyle={numFmt:'0.0%',border,alignment:{horizontal:'center'}};

  function styleRange(ws, ref, style){
    const rg=XLSX.utils.decode_range(ref);
    for(let r=rg.s.r;r<=rg.e.r;r++) for(let c=rg.s.c;c<=rg.e.c;c++){
      const addr=XLSX.utils.encode_cell({r,c}); ws[addr]=ws[addr]||{}; ws[addr].s={...(ws[addr].s||{}),...style};
    }
  }

  function buildAreaSheet(XLSX, areaName, members, dates, presentSet, monthLabel){
    const rows=[];
    rows.push([`${areaName} — Monthly Attendance`]);
    rows.push(['One row per member. Active members are counted in the summary. Present cells are highlighted; blank cells represent no attendance record.']);
    rows.push(['Name','Active / Inactive',...dates.map((_,i)=>`Sun ${i+1}`),'Total Present','Attendance %']);
    rows.push(['Dates','',...dates.map(d=>new Date(`${d}T12:00:00+08:00`)),'','']);
    const activeCount=m=>m.is_active!==false && roleName(m.status||'active')!=='inactive';
    members.sort((a,b)=>String(a.display_name||'').localeCompare(String(b.display_name||''),undefined,{sensitivity:'base'}));
    members.forEach(m=>{
      const isActive=activeCount(m);
      const pres=dates.map(d=>presentSet.has(`${m.id}|${d}`));
      rows.push([m.display_name||[m.first_name,m.last_name].filter(Boolean).join(' ')||'Unnamed member',isActive?'Active':'Inactive',...pres.map(x=>x?'Present':''),pres.filter(Boolean).length,dates.length?pres.filter(Boolean).length/dates.length:0]);
    });
    const totalPresent=members.reduce((n,m)=>n+dates.filter(d=>presentSet.has(`${m.id}|${d}`)).length,0);
    rows.push(['Area Total','',...dates.map(d=>members.filter(m=>presentSet.has(`${m.id}|${d}`)).length),totalPresent,'']);
    const ws=XLSX.utils.aoa_to_sheet(rows);
    const lastCol=2+dates.length+2;
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:lastCol}}];
    ws['!merges'].push({s:{r:1,c:0},e:{r:1,c:lastCol}});
    ws['!cols']=[{wch:30},{wch:18},...dates.map(()=>({wch:12})),{wch:15},{wch:15}];
    ws['!rows']=[{hpt:25},{hpt:36},{hpt:24},{hpt:22}];
    styleRange(ws,`A1:${XLSX.utils.encode_col(lastCol)}1`,titleStyle);
    styleRange(ws,`A2:${XLSX.utils.encode_col(lastCol)}2`,subStyle);
    styleRange(ws,`A3:${XLSX.utils.encode_col(lastCol)}4`,headerStyle);
    for(let r=4;r<rows.length;r++){
      styleRange(ws,`A${r+1}:${XLSX.utils.encode_col(lastCol)}${r+1}`,bodyStyle);
      if(r<rows.length-1) ws[`B${r+1}`].s={...(ws[`B${r+1}`].s||{}),...(rows[r][1]==='Active'?activeStyle:bodyStyle)};
      for(let c=2;c<2+dates.length;c++) if(rows[r][c]==='Present') ws[XLSX.utils.encode_cell({r,c})].s=presentStyle;
      ws[`I${r+1}`] = ws[`I${r+1}`];
    }
    const startData=5, endData=4+members.length;
    for(let r=startData;r<=endData;r++) ws[XLSX.utils.encode_cell({r:r-1,c:lastCol})].s=percentStyle;
    return {ws,totalPresent};
  }

  async function exportAttendance(){
    const button=document.getElementById('vccfExportAttendance');
    const client=getClient();
    if(!client){toast('Database connection is unavailable.');return;}
    if(button){button.disabled=true;button.textContent='Preparing Excel...';}
    try{
      const {data:auth,error:authError}=await client.auth.getUser();
      if(authError||!auth?.user) throw new Error('Please sign in first.');
      const {data:profile,error:profileError}=await client.from('profiles').select('role,area_id').eq('user_id',auth.user.id).maybeSingle();
      if(profileError) throw profileError;if(!profile) throw new Error('Your VCCF profile was not found.');
      const role=roleName(profile.role);if(!['admin','area leader'].includes(role)) throw new Error('Only administrators and area leaders can download attendance data.');

      const [mr,ar,att]=await Promise.all([
        client.from('members').select('id,display_name,first_name,last_name,area_id,is_active,status').order('display_name'),
        client.from('areas').select('id,name,is_active').order('name'),
        client.from('attendance').select('member_id,area_id,checked_in_at').order('checked_in_at')
      ]);
      if(mr.error) throw mr.error;if(ar.error) throw ar.error;if(att.error) throw att.error;
      const areas=(ar.data||[]).filter(a=>a.is_active!==false);
      const allMembers=mr.data||[], allAttendance=att.data||[];
      const visibleMembers=role==='area leader'?allMembers.filter(m=>String(m.area_id)===String(profile.area_id)):allMembers;
      const visibleIds=new Set(visibleMembers.map(m=>String(m.id)));
      const visibleAttendance=allAttendance.filter(a=>visibleIds.has(String(a.member_id)));
      const month=currentMonth(), dates=sundaysForMonth(month), monthLabel=new Date(`${month}-01T12:00:00+08:00`).toLocaleDateString('en-PH',{month:'long',year:'numeric'});
      const presentSet=new Set(visibleAttendance.map(a=>`${a.member_id}|${manilaDate(a.checked_in_at)}`));
      const visibleAreas=role==='area leader'?areas.filter(a=>String(a.id)===String(profile.area_id)):areas;
      const XLSX=await loadSheetJs();
      const wb=XLSX.utils.book_new();

      const summaryRows=[];
      summaryRows.push(['Monthly Attendance Summary']);
      summaryRows.push(['Attendance Month',new Date(`${month}-01T12:00:00+08:00`),`Generated from VCCF attendance records for ${monthLabel}.`]);
      summaryRows.push(['','',...dates.map(d=>new Date(`${d}T12:00:00+08:00`))]);
      summaryRows.push(['Area','Active Members',...dates.map((_,i)=>`Sun ${i+1}`),'Total Present','Attendance %']);

      let totalActive=0,totalPresent=0;
      for(const area of visibleAreas){
        const members=visibleMembers.filter(m=>String(m.area_id)===String(area.id));
        const active=members.filter(m=>m.is_active!==false&&roleName(m.status||'active')!=='inactive').length;
        const dayCounts=dates.map(d=>members.filter(m=>presentSet.has(`${m.id}|${d}`)).length);
        const areaPresent=dayCounts.reduce((a,b)=>a+b,0);
        const denom=active*dates.length;
        summaryRows.push([area.name||'Unassigned',active,...dayCounts,areaPresent,denom?areaPresent/denom:0]);
        totalActive+=active;totalPresent+=areaPresent;
      }
      const allDayCounts=dates.map(d=>visibleMembers.filter(m=>visibleAreas.some(a=>String(a.id)===String(m.area_id))&&presentSet.has(`${m.id}|${d}`)).length);
      summaryRows.push(['All Areas',totalActive,...allDayCounts,totalPresent,(totalActive*dates.length)?totalPresent/(totalActive*dates.length):0]);
      const sumWs=XLSX.utils.aoa_to_sheet(summaryRows);
      const sumLast=summaryRows[3].length-1;
      sumWs['!merges']=[{s:{r:0,c:0},e:{r:0,c:sumLast}}];
      sumWs['!cols']=[{wch:20},{wch:16},...dates.map(()=>({wch:12})),{wch:15},{wch:15}];
      sumWs['!rows']=[{hpt:25},{hpt:38},{hpt:22},{hpt:24}];
      styleRange(sumWs,`A1:${XLSX.utils.encode_col(sumLast)}1`,titleStyle);
      styleRange(sumWs,`A2:${XLSX.utils.encode_col(sumLast)}3`,subStyle);
      styleRange(sumWs,`A4:${XLSX.utils.encode_col(sumLast)}4`,headerStyle);
      styleRange(sumWs,`A5:${XLSX.utils.encode_col(sumLast)}${summaryRows.length}`,bodyStyle);
      for(let r=5;r<=summaryRows.length;r++) sumWs[XLSX.utils.encode_cell({r:r-1,c:sumLast})].s=percentStyle;
      XLSX.utils.book_append_sheet(wb,sumWs,'Summary');

      for(const area of visibleAreas){
        const members=visibleMembers.filter(m=>String(m.area_id)===String(area.id));
        const {ws}=buildAreaSheet(XLSX,area.name||'Unassigned',members,dates,presentSet,monthLabel);
        let safe=(area.name||'Unassigned').replace(/[\\/?*\[\]:]/g,' ').trim().slice(0,31)||'Area';
        let n=2;while(wb.SheetNames.includes(safe)) safe=`${safe.slice(0,28)} ${n++}`;
        XLSX.utils.book_append_sheet(wb,ws,safe);
      }

      const scope=role==='admin'?'all-areas':(visibleAreas[0]?.name||'my-area').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
      XLSX.writeFile(wb,`vccf-sunday-attendance-${scope}-${month}.xlsx`);
      toast(`Sunday attendance Excel downloaded for ${monthLabel}.`);
    }catch(error){console.error('VCCF Sunday Excel export:',error);toast(`Export failed: ${error?.message||error}`)}
    finally{if(button){button.disabled=false;button.textContent='Download Sunday Attendance';}}
  }

  window.vccfExportAttendance=exportAttendance;
  window.vccfEnsureAttendanceExport=addExportButton;
  function start(){let attempts=0;const timer=setInterval(()=>{attempts++;if(addExportButton()||attempts>=60)clearInterval(timer);},500);addExportButton();}
  window.addEventListener('DOMContentLoaded',start);window.addEventListener('vccf-app-ready',start);
  new MutationObserver(()=>addExportButton()).observe(document.body,{subtree:true,childList:true});
})();
