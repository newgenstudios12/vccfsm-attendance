(() => {
  const supa = window.supabase?.createClient?.(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
  if (!supa || window.__VCCF_MEMBER_UI__) return;
  window.__VCCF_MEMBER_UI__ = true;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sundays=()=>{const d=new Date(today()+'T12:00:00+08:00');d.setDate(d.getDate()-d.getDay());return Array.from({length:4},()=>{const x=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);d.setDate(d.getDate()-7);return x})};
  const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500)}};
  async function profile(){const {data:{user}}=await supa.auth.getUser();if(!user)return null;const {data}=await supa.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();return data?{...data,user_id:user.id}:null}
  const manager=r=>['admin','area leader'].includes(String(r||'').toLowerCase());
  async function statusData(){
    const [{data:ms},{data:att}]=await Promise.all([supa.from('members').select('id,display_name,area_id,status,created_at'),supa.from('attendance').select('member_id,checked_in_at')]);
    const ds=sundays(), sets=new Map();
    (att||[]).forEach(a=>{const d=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});if(ds.includes(d)){if(!sets.has(a.member_id))sets.set(a.member_id,new Set());sets.get(a.member_id).add(d)}});
    const changes=[];const out=(ms||[]).map(m=>{const joined=m.created_at?new Date(m.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}):null;const eligible=!joined||joined<=ds[3];const inactive=eligible&&ds.every(d=>!(sets.get(m.id)?.has(d)));const auto=inactive?'inactive':'active';if(m.status!==auto)changes.push({id:m.id,status:auto});return {...m,status:auto}});
    await Promise.all(changes.map(x=>supa.from('members').update({status:x.status,status_updated_at:new Date().toISOString()}).eq('id',x.id)));
    return out;
  }
  async function addStatusColumn(){
    const p=await profile();if(!manager(p?.role))return;
    const members=await statusData();
    const visible=String(p.role).toLowerCase()==='admin'?members:members.filter(m=>String(m.area_id)===String(p.area_id));
    const section=document.getElementById('members');if(!section)return;
    const table=section.querySelector('.tablewrap table.table');if(!table)return;
    const head=table.tHead?.rows?.[0];if(!head)return;
    if([...head.cells].some(c=>c.dataset.memberStatus==='1'))return;
    let qrIndex=[...head.cells].findIndex(c=>/qr|code/i.test(c.textContent));if(qrIndex<0)qrIndex=head.cells.length;
    const th=document.createElement('th');th.textContent='Status';th.dataset.memberStatus='1';head.insertBefore(th,head.cells[qrIndex]||null);
    [...table.tBodies[0].rows].forEach(row=>{
      const text=row.textContent||'';const m=visible.find(x=>text.includes(x.display_name||'§§§'));
      const cell=document.createElement('td');
      if(!m){cell.textContent='—';row.insertBefore(cell,row.cells[qrIndex]||null);return}
      const inactive=m.status==='inactive';cell.innerHTML=`<select class="vccf-inline-status" data-id="${esc(m.id)}" style="border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--panel);color:var(--text);font-weight:800"><option value="active" ${!inactive?'selected':''}>Active</option><option value="inactive" ${inactive?'selected':''}>Inactive</option></select>`;row.insertBefore(cell,row.cells[qrIndex]||null);
      cell.querySelector('select').onchange=async e=>{const r=await profile();if(!manager(r?.role)){toast('You do not have permission.');return}if(String(r.role).toLowerCase()==='area leader'&&String(m.area_id)!==String(r.area_id)){toast('You can only change members in your area.');e.target.value=m.status;return}const u=await supa.from('members').update({status:e.target.value,status_updated_at:new Date().toISOString()}).eq('id',m.id);if(u.error){toast(u.error.message);return}m.status=e.target.value;toast(`Member set to ${e.target.value}.`)};
    });
  }
  async function stats(){
    const p=await profile();if(!manager(p?.role))return;const ms=await statusData();const vis=String(p.role).toLowerCase()==='admin'?ms:ms.filter(m=>String(m.area_id)===String(p.area_id));const counts={total:vis.length,active:vis.filter(m=>m.status==='active').length,inactive:vis.filter(m=>m.status==='inactive').length};let box=document.getElementById('memberStatusStats');if(!box){const dashboard=document.getElementById('dashboard');if(!dashboard)return;box=document.createElement('div');box.id='memberStatusStats';box.className='panel';box.style.marginTop='16px';dashboard.appendChild(box)}box.innerHTML=`<h3>Member Status</h3><div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><small>Total Members</small><strong>${counts.total}</strong></div><div class="stat"><small>Active Members</small><strong>${counts.active}</strong></div><div class="stat"><small>Inactive Members</small><strong>${counts.inactive}</strong></div></div><p style="color:var(--muted);margin:12px 0 0">${String(p.role).toLowerCase()==='admin'?'All areas':'Your assigned area'}</p>`;
  }
  function videoFix(){
    const btn=document.getElementById('editDashboardVideo');if(!btn||btn.dataset.fixed==='1')return;btn.dataset.fixed='1';btn.onclick=async()=>{const {data}=await supa.from('site_settings').select('value').eq('key','dashboard_youtube_url').maybeSingle();const current=data?.value||'';const value=window.prompt('Paste the YouTube video link here:',current);if(value===null)return;const trimmed=value.trim();if(trimmed&&!/(youtube\.com|youtu\.be)/i.test(trimmed)){toast('Please enter a YouTube link.');return}const {data:{user}}=await supa.auth.getUser();const r=await supa.from('site_settings').upsert({key:'dashboard_youtube_url',value:trimmed,updated_at:new Date().toISOString(),updated_by:user?.id||null},{onConflict:'key'});if(r.error){toast(r.error.message);return}toast(trimmed?'Video link saved.':'Video removed.');setTimeout(()=>location.reload(),500)};
  }
  function run(){setTimeout(async()=>{try{const view=document.querySelector('.view.active')?.id;if(view==='members')await addStatusColumn();if(view==='dashboard'){await stats();videoFix()}}catch(e){console.warn(e)}},500)}
  window.addEventListener('DOMContentLoaded',()=>{run();document.querySelectorAll('.nav button[data-view]').forEach(b=>b.addEventListener('click',run));});
  const mo=new MutationObserver(run);mo.observe(document.body,{subtree:true,childList:true});
})();
