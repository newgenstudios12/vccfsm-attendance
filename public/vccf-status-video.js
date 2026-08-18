(() => {
  const supa = window.supabase?.createClient?.(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  if (!supa || window.__VCCF_STATUS_VIDEO__) return;
  window.__VCCF_STATUS_VIDEO__ = true;

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const todayPH = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sundayList = (count=4) => {
    const d = new Date(todayPH()+'T12:00:00+08:00');
    const day = d.getDay(); d.setDate(d.getDate()-day);
    const out=[]; for(let i=0;i<count;i++){ out.push(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)); d.setDate(d.getDate()-7); }
    return out;
  };
  const toast = msg => { const x=document.getElementById('toast'); if(x){x.textContent=msg;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2800)} };
  const getProfile = async () => { const {data:{user}}=await supa.auth.getUser(); if(!user)return null; const {data}=await supa.from('profiles').select('role,area_id,member_id').eq('user_id',user.id).maybeSingle(); return data?{...data,user_id:user.id}:null; };
  const isManager = r => ['admin','area leader'].includes(String(r||'').toLowerCase());

  function youtubeId(raw){
    if(!raw)return '';
    const s=raw.trim();
    if(/^[A-Za-z0-9_-]{11}$/.test(s))return s;
    try{
      const u=new URL(s);
      if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0];
      if(u.searchParams.get('v'))return u.searchParams.get('v');
      const m=u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/); if(m)return m[1];
    }catch(e){}
    const m=s.match(/([A-Za-z0-9_-]{11})/); return m?m[1]:'';
  }

  async function renderVideo(){
    const dashboard=document.getElementById('dashboard'); if(!dashboard)return;
    let panel=document.getElementById('vccfVideoPanel');
    if(!panel){ panel=document.createElement('div');panel.id='vccfVideoPanel';panel.className='panel';panel.style.marginTop='16px'; dashboard.appendChild(panel); }
    const {data}=await supa.from('site_settings').select('value').eq('key','dashboard_youtube_url').maybeSingle();
    const url=data?.value||''; const id=youtubeId(url); const profile=await getProfile();
    panel.innerHTML=`<div class="toolbar" style="margin-bottom:10px"><div><h3 style="margin:0">VCCF Video</h3><p style="color:var(--muted);margin:4px 0 0">Featured YouTube video for the VCCF Connect dashboard.</p></div>${String(profile?.role||'').toLowerCase()==='admin'?'<button class="btn" id="editDashboardVideo">Edit video</button>':''}</div>` + (id ? `<div style="position:relative;width:100%;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#111"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="VCCF YouTube video" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;web-share" allowfullscreen></iframe></div>` : '<div style="padding:30px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px">No video has been added yet.</div>');
    document.getElementById('editDashboardVideo')?.addEventListener('click', async()=>{
      const modal=document.getElementById('modal'),body=document.getElementById('modalBody'),title=document.getElementById('modalTitle');
      if(!modal||!body)return;
      title.textContent='Dashboard YouTube Video';
      body.innerHTML=`<div class="field"><label>YouTube link</label><input id="dashboardYoutubeInput" value="${esc(url)}" placeholder="https://www.youtube.com/watch?v=..."></div><p style="color:var(--muted);font-size:.8rem">Paste a normal YouTube link, youtu.be link, Shorts link, or embed link.</p><div style="display:flex;gap:8px"><button class="btn" id="saveDashboardVideo">Save video</button><button class="btn danger" id="removeDashboardVideo">Remove</button></div>`;
      modal.classList.add('open');
      document.getElementById('saveDashboardVideo').onclick=async()=>{const value=document.getElementById('dashboardYoutubeInput').value.trim();if(value&&!youtubeId(value)){toast('That does not look like a valid YouTube link.');return}const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error){toast(r.error.message);return}modal.classList.remove('open');await renderVideo();toast(value?'Video updated.':'Video removed.');};
      document.getElementById('removeDashboardVideo').onclick=async()=>{const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value:'',updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error){toast(r.error.message);return}modal.classList.remove('open');await renderVideo();toast('Video removed.');};
    });
  }

  async function calculateStatuses(){
    const {data:members,error:me}=await supa.from('members').select('id,display_name,area_id,created_at,status');
    if(me||!members)return [];
    const {data:attendance}=await supa.from('attendance').select('member_id,checked_in_at,area_id');
    const sundays=sundayList(4); const fourth=sundays[3];
    const byMember=new Map(); (attendance||[]).forEach(a=>{const date=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}); if(sundays.includes(date)){if(!byMember.has(a.member_id))byMember.set(a.member_id,new Set());byMember.get(a.member_id).add(date)}});
    const updates=[];
    for(const m of members){
      const joined=m.created_at?new Date(m.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}):null;
      const eligible=!joined || joined<=fourth;
      const missed=eligible && sundays.every(d=>!(byMember.get(m.id)?.has(d)));
      const next=missed?'inactive':'active';
      if(m.status!==next)updates.push({id:m.id,status:next});
    }
    for(const u of updates){await supa.from('members').update({status:u.status,status_updated_at:new Date().toISOString()}).eq('id',u.id)}
    return members.map(m=>({...m,status:(updates.find(x=>x.id===m.id)?.status)||m.status||'active'}));
  }

  async function renderStatusTable(){
    const section=document.getElementById('members'); if(!section)return;
    let panel=document.getElementById('memberStatusPanel');
    if(!panel){panel=document.createElement('div');panel.id='memberStatusPanel';panel.className='panel';panel.style.marginTop='16px';const main=section.querySelector('.panel');main?.insertAdjacentElement('afterend',panel);}
    const profile=await getProfile(); if(!isManager(profile?.role)){panel.remove();return}
    const members=await calculateStatuses();
    const areaFilter=document.getElementById('areaFilter')?.value||'';
    const visible=String(profile.role).toLowerCase()==='admin'?members:members.filter(m=>String(m.area_id)===String(profile.area_id));
    panel.innerHTML=`<div class="toolbar"><div><h3 style="margin:0">Member Status</h3><p style="color:var(--muted);margin:4px 0 0">Inactive is automatic after four consecutive missed Sundays. Admins and Area Leaders can override it.</p></div></div><div class="tablewrap"><table class="table"><thead><tr><th>Member</th><th>Status</th><th>Attendance rule</th><th>Action</th></tr></thead><tbody>${visible.map(m=>{const inactive=m.status==='inactive';return `<tr><td>${esc(m.display_name||'Unnamed')}</td><td><span class="tag" style="background:${inactive?'#dc35451a':'#1987541a'};color:${inactive?'#dc3545':'#198754'}">${inactive?'Inactive':'Active'}</span></td><td>${inactive?'Missed 4 consecutive Sundays':'Active'}</td><td><button class="btn secondary vccf-status-toggle" data-id="${esc(m.id)}" data-status="${inactive?'active':'inactive'}">Set ${inactive?'Active':'Inactive'}</button></td></tr>`}).join('')||'<tr><td colspan="4" style="color:var(--muted)">No members in this area.</td></tr>'}</tbody></table></div>`;
    panel.querySelectorAll('.vccf-status-toggle').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.id,status=btn.dataset.status;const p=await getProfile();if(String(p?.role).toLowerCase()==='area leader'){const {data:m}=await supa.from('members').select('area_id').eq('id',id).maybeSingle();if(String(m?.area_id)!==String(p.area_id)){toast('You can only change members in your area.');return}}const r=await supa.from('members').update({status,status_updated_at:new Date().toISOString()}).eq('id',id);if(r.error){toast(r.error.message);return}await renderStatusTable();toast(`Member set to ${status}.`);});
  }

  function attach(){
    const nav=document.querySelectorAll('.nav button[data-view]');
    nav.forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{if(b.dataset.view==='dashboard')renderVideo();if(b.dataset.view==='members')renderStatusTable()},350)));
    setTimeout(()=>{renderVideo();renderStatusTable()},1500);
    const filter=document.getElementById('areaFilter');filter?.addEventListener('change',()=>setTimeout(renderStatusTable,200));
  }
  window.addEventListener('DOMContentLoaded',()=>setTimeout(attach,200));
})();
