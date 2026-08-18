(() => {
  if (window.__VCCF_ATTENDANCE_EXPORT_V2__) return;
  window.__VCCF_ATTENDANCE_EXPORT_V2__ = true;

  const escCsv = value => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const roleName = value => String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  const manilaDate = value => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value));
  const toast = message => { const el=document.getElementById('toast'); if(el){el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800)} };

  function getClient(){
    if(window.__VCCF_EXPORT_CLIENT__) return window.__VCCF_EXPORT_CLIENT__;
    if(!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    window.__VCCF_EXPORT_CLIENT__ = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return window.__VCCF_EXPORT_CLIENT__;
  }

  function findAttendanceView(){ return document.getElementById('attendance') || document.getElementById('attendanceRows')?.closest('.view') || null; }

  function addExportButton(){
    if(document.getElementById('vccfExportAttendance')) return true;
    const view=findAttendanceView();
    if(!view || !view.classList.contains('active')) return false;
    const rows=document.getElementById('attendanceRows');
    if(!rows) return false;

    const button=document.createElement('button');
    button.id='vccfExportAttendance';
    button.type='button';
    button.className='btn secondary';
    button.textContent='Download Sunday Attendance';
    button.style.cssText='margin-left:10px;white-space:nowrap;';
    button.addEventListener('click', exportAttendance);

    const recordsHeading=[...view.querySelectorAll('h1,h2,h3,h4')].find(h=>/attendance records/i.test(h.textContent||''));
    if(recordsHeading){
      recordsHeading.insertAdjacentElement('afterend',button);
      return true;
    }
    const topHeading=[...view.querySelectorAll('h1,h2,h3,h4')].find(h=>/^attendance$/i.test((h.textContent||'').trim()));
    if(topHeading){topHeading.insertAdjacentElement('afterend',button);return true;}
    const panel=rows.closest('.panel');
    if(panel){panel.insertBefore(button,panel.firstChild);return true;}
    view.insertBefore(button,view.firstChild);
    return true;
  }

  async function exportAttendance(){
    const client=getClient();
    if(!client){toast('Database connection is unavailable.');return;}
    const button=document.getElementById('vccfExportAttendance');
    if(button){button.disabled=true;button.textContent='Preparing...';}
    try{
      const {data:auth,error:authError}=await client.auth.getUser();
      if(authError||!auth?.user) throw new Error('Please sign in first.');
      const {data:profile,error:profileError}=await client.from('profiles').select('role,area_id').eq('user_id',auth.user.id).maybeSingle();
      if(profileError) throw profileError;
      if(!profile) throw new Error('Your VCCF profile was not found.');
      const role=roleName(profile.role);
      if(!['admin','area leader'].includes(role)) throw new Error('Only administrators and area leaders can download attendance data.');

      const [mr,ar,att]=await Promise.all([
        client.from('members').select('id,display_name,area_id').order('display_name'),
        client.from('areas').select('id,name').order('name'),
        client.from('attendance').select('member_id,area_id,checked_in_at').order('checked_in_at')
      ]);
      if(mr.error) throw mr.error;if(ar.error) throw ar.error;if(att.error) throw att.error;
      const areas=ar.data||[], members=mr.data||[], attendance=att.data||[];
      const areaById=new Map(areas.map(a=>[String(a.id),a.name||'Unassigned']));
      let visibleMembers=role==='area leader'?members.filter(m=>String(m.area_id)===String(profile.area_id)):members;
      const ids=new Set(visibleMembers.map(m=>String(m.id)));
      const visibleAttendance=attendance.filter(a=>ids.has(String(a.member_id)));
      const sundaySet=new Set();
      visibleAttendance.forEach(a=>{const d=manilaDate(a.checked_in_at);const dt=new Date(`${d}T12:00:00+08:00`);if(dt.getDay()===0)sundaySet.add(d);});
      if(!sundaySet.size){const d=new Date(manilaDate(new Date())+'T12:00:00+08:00');d.setDate(d.getDate()-d.getDay());sundaySet.add(manilaDate(d));}
      const sundays=[...sundaySet].sort();
      const present=new Set(visibleAttendance.map(a=>`${a.member_id}|${manilaDate(a.checked_in_at)}`));
      visibleMembers=[...visibleMembers].sort((a,b)=>{const aa=areaById.get(String(a.area_id))||'Unassigned',bb=areaById.get(String(b.area_id))||'Unassigned';return aa.localeCompare(bb)||String(a.display_name||'').localeCompare(String(b.display_name||''),undefined,{sensitivity:'base'});});
      const lines=[['Area','Name',...sundays].map(escCsv).join(',')];
      visibleMembers.forEach(m=>{const area=areaById.get(String(m.area_id))||'Unassigned';lines.push([area,m.display_name||'Unnamed member',...sundays.map(s=>present.has(`${m.id}|${s}`)?'Present':'Absent')].map(escCsv).join(','));});
      const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      const scope=role==='admin'?'all-areas':(areaById.get(String(profile.area_id))||'my-area').replace(/[^a-z0-9]+/gi,'-').toLowerCase();
      link.href=url;link.download=`vccf-sunday-attendance-${scope}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast(`Attendance export downloaded: ${visibleMembers.length} members, ${sundays.length} Sundays.`);
    }catch(error){console.error('VCCF attendance export:',error);toast(`Export failed: ${error?.message||error}`)}
    finally{if(button){button.disabled=false;button.textContent='Download Sunday Attendance';}}
  }

  window.vccfExportAttendance=exportAttendance;
  window.vccfEnsureAttendanceExport=addExportButton;

  function start(){
    let attempts=0;
    const timer=setInterval(()=>{attempts++;if(addExportButton()||attempts>=60)clearInterval(timer);},500);
    addExportButton();
  }
  window.addEventListener('DOMContentLoaded',start);
  window.addEventListener('vccf-app-ready',start);
  const observer=new MutationObserver(()=>addExportButton());
  observer.observe(document.body,{subtree:true,childList:true});
})();
