(() => {
  const supa=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  if(!supa||window.__VCCF_STATUS_VIDEO__)return; window.__VCCF_STATUS_VIDEO__=true;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)}};
  const roleName=r=>String(r||'').toLowerCase().replace(/_/g,' ');
  const phDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sundayList=(n=8)=>{const d=new Date(phDate()+'T12:00:00+08:00');d.setDate(d.getDate()-d.getDay());const out=[];for(let i=0;i<n;i++){out.push(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d));d.setDate(d.getDate()-7)}return out};
  async function profile(){const {data:{user}}=await supa.auth.getUser();if(!user)return null;const {data}=await supa.from('profiles').select('role,area_id,member_id').eq('user_id',user.id).maybeSingle();return data?{...data,user_id:user.id}:null}
  function youtubeId(raw){if(!raw)return '';const s=raw.trim();if(/^[A-Za-z0-9_-]{11}$/.test(s))return s;try{const u=new URL(s);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0];if(u.searchParams.get('v'))return u.searchParams.get('v');const m=u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);if(m)return m[1]}catch(e){}const m=s.match(/([A-Za-z0-9_-]{11})/);return m?m[1]:''}

  async function renderVideo(){
    const dashboard=document.getElementById('dashboard');if(!dashboard)return;
    let panel=document.getElementById('vccfVideoPanel');if(!panel){panel=document.createElement('div');panel.id='vccfVideoPanel';panel.className='panel';panel.style.marginTop='16px';dashboard.appendChild(panel)}
    const {data}=await supa.from('site_settings').select('value').eq('key','dashboard_youtube_url').maybeSingle();const url=data?.value||'',id=youtubeId(url),p=await profile();
    panel.innerHTML=`<div class="toolbar" style="margin-bottom:10px"><div><h3 style="margin:0">VCCF Video</h3><p style="color:var(--muted);margin:4px 0 0">Featured YouTube video for the VCCF Connect dashboard.</p></div>${roleName(p?.role)==='admin'?'<button class="btn" id="editDashboardVideo">Edit video</button>':''}</div>`+(id?`<div style="position:relative;width:100%;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#111"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="VCCF YouTube video" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share" allowfullscreen></iframe></div>`:'<div style="padding:30px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px">No video has been added yet.</div>');
    document.getElementById('editDashboardVideo')?.addEventListener('click',async()=>{
      const modal=document.getElementById('modal'),body=document.getElementById('modalBody'),title=document.getElementById('modalTitle');if(!modal||!body)return;
      title.textContent='Dashboard YouTube Video';body.innerHTML=`<div class="field"><label for="dashboardYoutubeInput">YouTube link</label><textarea id="dashboardYoutubeInput" rows="3" placeholder="Paste the YouTube link here"></textarea></div><p style="color:var(--muted);font-size:.8rem">Normal YouTube, youtu.be, Shorts, or embed links are accepted.</p><div style="display:flex;gap:8px"><button class="btn" id="saveDashboardVideo">Save video</button><button class="btn danger" id="removeDashboardVideo">Remove</button></div>`;modal.classList.add('open');const input=document.getElementById('dashboardYoutubeInput');input.value=url;setTimeout(()=>{input.focus();input.select()},50);
      document.getElementById('saveDashboardVideo').onclick=async()=>{const value=input.value.trim();if(value&&!youtubeId(value)){toast('Please enter a valid YouTube link.');input.focus();return}const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error){toast(r.error.message);return}modal.classList.remove('open');await renderVideo();toast(value?'Video updated.':'Video removed.')};
      document.getElementById('removeDashboardVideo').onclick=async()=>{const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value:'',updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error){toast(r.error.message);return}modal.classList.remove('open');await renderVideo();toast('Video removed.')};
    });
  }

  async function calculateStatuses(){
    const {data:members,error}=await supa.from('members').select('id,display_name,area_id,created_at,status');if(error||!members)return [];
    const {data:attendance}=await supa.from('attendance').select('member_id,checked_in_at');const sundays=sundayList(4),oldest=sundays[3];const by=new Map();
    (attendance||[]).forEach(a=>{const d=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});if(sundays.includes(d)){if(!by.has(String(a.member_id)))by.set(String(a.member_id),new Set());by.get(String(a.member_id)).add(d)}});
    const updates=[];
    for(const m of members){
      const joined=m.created_at?new Date(m.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}):null;
      const eligible=!joined||joined<=oldest;
      const fourConsecutiveMisses=eligible&&sundays.every(d=>!(by.get(String(m.id))?.has(d)));
      const next=fourConsecutiveMisses?'inactive':'active';
      if(m.status!==next)updates.push({id:m.id,status:next});
    }
    for(const u of updates)await supa.from('members').update({status:u.status,status_updated_at:new Date().toISOString()}).eq('id',u.id);
    return members.map(m=>({...m,status:updates.find(x=>x.id===m.id)?.status||((m.status==='inactive'&&members.find(x=>x.id===m.id))?m.status:'active')}));
  }

  async function loadStatusesIntoDb(){const rows=await calculateStatuses();const map=new Map(rows.map(x=>[String(x.id),x.status]));(window.db?.members||[]).forEach(m=>m.status=map.get(String(m.id))||m.status||'active');return rows}

  async function enhanceOwnMemberStatus(){
    const section=document.getElementById('members');if(!section)return;
    const p=await profile();if(!p||roleName(p.role)==='admin'||roleName(p.role)==='area leader')return;
    const memberId=p.member_id;if(!memberId)return;
    const {data,error}=await supa.from('members').select('status').eq('id',memberId).maybeSingle();if(error||!data)return;
    let panel=document.getElementById('memberOwnStatus');
    if(!panel){panel=document.createElement('div');panel.id='memberOwnStatus';panel.style.cssText='margin:0 0 16px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel);display:flex;align-items:center;justify-content:space-between;gap:12px';section.prepend(panel)}
    const inactive=String(data.status||'active').toLowerCase()==='inactive';
    panel.innerHTML=`<div><b>My Status</b><div style="color:var(--muted);font-size:.82rem;margin-top:3px">Your current membership status</div></div><span style="font-weight:800" class="tag ${inactive?'danger':''}">${inactive?'Inactive':'Active'}</span>`;
  }

  async function enhanceMembers(){
    const section=document.getElementById('members');if(!section)return;document.getElementById('memberStatusPanel')?.remove();
    const p=await profile();if(!p||!['admin','area leader'].includes(roleName(p.role)))return;
    await loadStatusesIntoDb();
    const table=section.querySelector('#memberRows')?.closest('table');if(!table)return;const head=table.tHead?.rows?.[0],body=table.tBodies?.[0];if(!head||!body)return;
    const headers=[...head.cells];let statusIndex=headers.findIndex(c=>c.dataset.vccfStatus==='1'||c.textContent.trim().toLowerCase()==='status');let qrIndex=headers.findIndex(c=>/qr|code/i.test(c.textContent));if(qrIndex<0)qrIndex=headers.length;
    if(statusIndex<0){const th=document.createElement('th');th.textContent='Status';th.dataset.vccfStatus='1';head.insertBefore(th,head.cells[qrIndex]||null);statusIndex=qrIndex;qrIndex++}
    let actionsIndex=[...head.cells].findIndex(c=>c.dataset.vccfActions==='1');
    if(actionsIndex<0){const th=document.createElement('th');th.textContent='Actions';th.dataset.vccfActions='1';head.appendChild(th);actionsIndex=head.cells.length-1}
    const visible=(window.db?.members||[]).filter(m=>roleName(p.role)==='admin'||String(m.areaId)===String(p.area_id));
    [...body.rows].forEach(row=>{
      const idCell=row.cells[0]?.querySelector('small');const id=idCell?.textContent?.trim();const m=visible.find(x=>String(x.id)===String(id));if(!m)return;
      const cell=row.cells[statusIndex]||row.insertCell(statusIndex);cell.innerHTML=`<select class="vccf-inline-status" style="border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--panel);color:var(--text);font-weight:800"><option value="active">Active</option><option value="inactive">Inactive</option></select>`;cell.querySelector('select').value=m.status||'active';
      cell.querySelector('select').onchange=async e=>{const me=await profile();if(!me||!['admin','area leader'].includes(roleName(me.role))){toast('You do not have permission.');return}if(roleName(me.role)==='area leader'&&String(m.areaId)!==String(me.area_id)){toast('You can only change members in your area.');e.target.value=m.status||'active';return}const r=await supa.from('members').update({status:e.target.value,status_updated_at:new Date().toISOString()}).eq('id',m.id);if(r.error){toast(r.error.message);e.target.value=m.status||'active';return}m.status=e.target.value;const local=(window.db?.members||[]).find(x=>String(x.id)===String(m.id));if(local)local.status=m.status;toast(`Member set to ${e.target.value}.`)};
      const actionCell=row.cells[actionsIndex]||row.insertCell(actionsIndex);actionCell.dataset.vccfActionsCell='1';
      if(roleName(p.role)==='admin'&&!actionCell.querySelector('.vccf-delete-member')){
        const b=document.createElement('button');b.className='btn danger vccf-delete-member';b.textContent='Delete';
        b.onclick=async()=>{
          if(!confirm(`Delete ${m.name}? This will remove the member and their attendance records.`))return;
          b.disabled=true;b.textContent='Deleting...';
          const p1=await supa.from('profiles').update({member_id:null}).eq('member_id',m.id);if(p1.error){toast(p1.error.message);b.disabled=false;b.textContent='Delete';return}
          const p2=await supa.from('attendance').delete().eq('member_id',m.id);if(p2.error){toast(p2.error.message);b.disabled=false;b.textContent='Delete';return}
          const p3=await supa.from('members').delete().eq('id',m.id);if(p3.error){toast(p3.error.message);b.disabled=false;b.textContent='Delete';return}
          await window.loadDb();window.refresh();toast('Member deleted.');
        };
        actionCell.appendChild(b);
      }
    });
  }

  async function fixAttendanceNames(){
    if(!window.db?.attendance)return;const render=()=>{const rows=[...window.db.attendance].reverse();const el=document.getElementById('attendanceRows');if(!el)return;el.innerHTML=rows.map(a=>{const m=window.db.members.find(x=>String(x.id)===String(a.memberId))||{name:a.name||'Unknown member',area:a.area||'',photo:''};return `<tr><td><div class="member-cell">${typeof window.memberAvatar==='function'?window.memberAvatar(m,true):`<span class="member-avatar sm">${(m.name||'?').slice(0,1)}</span>`}<div><b style="color:var(--text)">${esc(m.name)}</b><br><small style="color:var(--muted)">${esc(m.id||a.id||'')}</small></div></div></td><td><span class="tag">${esc(m.area||a.area||'')}</span></td><td>${esc(a.date)}</td><td>${esc(a.time)}</td><td>✓ Present</td></tr>`}).join('')||'<tr><td colspan="5" style="color:var(--muted)">No attendance recorded yet.</td></tr>'};render()}

  async function fixRecentAttendance(){
    const el=document.getElementById('recentAttendance');if(!el||!window.db?.attendance)return;const rows=window.db.attendance.slice(-8).reverse();el.innerHTML=rows.map(a=>{const m=window.db.members.find(x=>String(x.id)===String(a.memberId))||{name:a.name||'Unknown member',area:a.area||'',photo:''};return `<tr><td><div class="member-cell">${typeof window.memberAvatar==='function'?window.memberAvatar(m,true):''}<b style="color:var(--text)">${esc(m.name)}</b></div></td><td><span class="tag">${esc(m.area||a.area||'')}</span></td><td>${esc(a.time)}</td><td>✓ Present</td></tr>`}).join('')||'<tr><td colspan="4" style="color:var(--muted)">No attendance recorded yet.</td></tr>'}

  async function renderSundayAnalytics(){
    const section=document.getElementById('analytics')||document.querySelector('[data-view="analytics"]');if(!section)return;
    const current=document.getElementById('vccfSundayAnalytics');
    [...section.querySelectorAll('.panel')].forEach(x=>{if(x!==current&&/Attendance Overview/i.test(x.textContent||''))x.remove()});
    const p=await profile();if(!p)return;
    const role=roleName(p.role);let ids=null;
    const {data:members}=await supa.from('members').select('id,area_id');
    if(role!=='admin'&&role!=='area leader')ids=p.member_id?[String(p.member_id)]:[];
    else if(role==='area leader')ids=(members||[]).filter(m=>String(m.area_id)===String(p.area_id)).map(m=>String(m.id));
    const {data:attendance}=await supa.from('attendance').select('member_id,checked_in_at');
    const sundays=sundayList(8);const allowed=ids?new Set(ids):null;
    const counts=sundays.slice().reverse().map(d=>{const seen=new Set();(attendance||[]).forEach(a=>{const ad=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});if(ad===d&&(!allowed||allowed.has(String(a.member_id))))seen.add(String(a.member_id))});return {date:d,count:seen.size}});
    let panel=document.getElementById('vccfSundayAnalytics');if(!panel){panel=document.createElement('div');panel.id='vccfSundayAnalytics';panel.className='panel';section.prepend(panel)}
    const max=Math.max(1,...counts.map(x=>x.count));
    panel.innerHTML=`<div class="toolbar"><div><h3 style="margin:0">Sunday Attendance Overview</h3><p style="color:var(--muted);margin:4px 0 0">Sunday attendance only · ${role==='admin'?'All members':role==='area leader'?'Your area':'Your attendance'}</p></div></div><div style="height:260px;display:flex;align-items:flex-end;gap:10px;padding:20px 8px 4px;border-top:1px solid var(--line);overflow-x:auto">${counts.map(x=>{const h=Math.max(4,Math.round(x.count/max*190));const label=new Date(x.date+'T12:00:00+08:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});return `<div style="min-width:54px;height:220px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px"><b>${x.count}</b><div title="${label}: ${x.count}" style="width:34px;height:${h}px;border-radius:7px 7px 2px 2px;background:var(--accent,#2563eb)"></div><small style="color:var(--muted);white-space:nowrap">${label}</small></div>`}).join('')}</div>`;
  }

  async function renderStats(){
    const dashboard=document.getElementById('dashboard');if(!dashboard)return;const p=await profile();if(!p||!['admin','area leader'].includes(roleName(p.role)))return;const rows=await loadStatusesIntoDb();
    let panel=document.getElementById('memberStatsFilter');if(!panel){panel=document.createElement('div');panel.id='memberStatsFilter';panel.className='panel';panel.style.marginTop='16px';dashboard.appendChild(panel)}
    const areas=window.db?.areas||[];const assigned=roleName(p.role)==='area leader'?areas.filter(a=>String(a.id)===String(p.area_id)):areas;const current=document.getElementById('memberStatsArea')?.value||'all';
    panel.innerHTML=`<div class="toolbar"><div><h3 style="margin:0">Member Statistics</h3><p style="color:var(--muted);margin:4px 0 0">Choose total membership or a specific area.</p></div><select id="memberStatsArea" style="min-width:180px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--panel);color:var(--text)"><option value="all">${roleName(p.role)==='admin'?'All Areas':'My Area'}</option>${assigned.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></div><div id="memberStatsCards" class="stats" style="grid-template-columns:repeat(3,1fr)"></div>`;
    const draw=()=>{const sel=document.getElementById('memberStatsArea').value;const vis=sel==='all'?rows:rows.filter(m=>String(m.area_id)===String(sel));document.getElementById('memberStatsCards').innerHTML=`<div class="stat"><small>Total Members</small><strong>${vis.length}</strong></div><div class="stat"><small>Active Members</small><strong>${vis.filter(m=>m.status==='active').length}</strong></div><div class="stat"><small>Inactive Members</small><strong>${vis.filter(m=>m.status==='inactive').length}</strong></div>`};document.getElementById('memberStatsArea').onchange=draw;draw();
  }

  let runTimer=null;
  let running=false;
  async function run(){
    if(running)return;
    running=true;
    try{
      if(document.getElementById('dashboard')?.classList.contains('active')){await renderVideo();await renderStats();await fixRecentAttendance()}
      if(document.getElementById('analytics')?.classList.contains('active')||document.querySelector('[data-view="analytics"].active'))await renderSundayAnalytics()
      if(document.getElementById('members')?.classList.contains('active')){if(typeof window.renderMembers==='function')window.renderMembers();await enhanceMembers();await enhanceOwnMemberStatus()}
      if(document.getElementById('attendance')?.classList.contains('active'))await fixAttendanceNames()
    }catch(e){console.warn('VCCF UI enhancement:',e)}
    finally{running=false}
  }
  const scheduleRun=()=>{clearTimeout(runTimer);runTimer=setTimeout(run,120)};

  window.addEventListener('DOMContentLoaded',()=>setTimeout(run,700));
  document.querySelectorAll('.nav button[data-view]').forEach(b=>b.addEventListener('click',scheduleRun));
  window.addEventListener('vccf-app-ready',scheduleRun);
  const loadAttendanceExport=()=>{if(window.__VCCF_ATTENDANCE_EXPORT_LOADER__)return;window.__VCCF_ATTENDANCE_EXPORT_LOADER__=true;const s=document.createElement('script');s.src='/vccf-attendance-export.js';s.onload=()=>window.vccfAttendanceExportLoaded=true;document.head.appendChild(s)};
  window.addEventListener('DOMContentLoaded',loadAttendanceExport);
  window.addEventListener('vccf-app-ready',loadAttendanceExport);
})();
