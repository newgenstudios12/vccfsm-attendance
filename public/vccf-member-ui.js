(() => {
  if (window.__VCCF_MEMBER_UI_V6__) return;
  window.__VCCF_MEMBER_UI_V6__ = true;

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  const isManager = r => ['admin','area leader'].includes(roleName(r));
  const toast = m => { const x=document.getElementById('toast'); if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500);} };
  let client=null, cachedProfile=null, repairInFlight=false, repairQueued=false;

  function getClient(){
    if(client) return client;
    const sb=window.supabase;
    if(!sb?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    client=sb.createClient(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function getProfile(force=false){
    if(cachedProfile && !force) return cachedProfile;
    const c=getClient(); if(!c) return null;
    const {data:auth,error:ae}=await c.auth.getUser();
    if(ae || !auth?.user) return null;
    const {data,error}=await c.from('profiles').select('user_id,role,area_id').eq('user_id',auth.user.id).maybeSingle();
    if(error || !data) return null;
    cachedProfile=data; return data;
  }

  function memberIdFromRow(row){
    const vals=[...row.querySelectorAll('small')].map(x=>x.textContent.trim()).filter(Boolean);
    for(const v of vals){
      const m=(typeof db!=='undefined'?(db?.members||[]):[]).find(x=>String(x.id)===v || String(x.memberCode||'')===v);
      if(m) return String(m.id);
    }
    return vals[0] || '';
  }

  async function saveMemberStatus(id,status){
    const c=getClient(); if(!c) throw new Error('Database connection is unavailable.');
    let rpcError=null;
    try{
      const {data,error}=await c.rpc('set_member_status',{p_member_id:id,p_status:status});
      if(!error){
        const row=Array.isArray(data)?data[0]:data;
        if(row?.id) return row;
      } else rpcError=error;
    }catch(e){rpcError=e}
    const {data,error}=await c.from('members').update({status,status_updated_at:new Date().toISOString()}).eq('id',id).select('id,status').maybeSingle();
    if(error) throw error;
    if(!data?.id) throw rpcError||new Error('Status update returned no updated member.');
    return data;
  }

  async function getManagedMembers(p){
    const c=getClient(); if(!c || !p) return [];
    let q=c.from('members').select('id,display_name,address,area_id,status,created_at');
    if(roleName(p.role)==='area leader') q=q.eq('area_id',p.area_id);
    const {data,error}=await q.order('display_name');
    if(error){console.warn('VCCF member query:',error);return [];} 
    const rows=data||[];
    const {data:att,error:ae}=await c.from('attendance').select('member_id,checked_in_at');
    if(ae) return rows;
    const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'});
    const d=new Date(fmt.format(new Date())+'T12:00:00+08:00');
    d.setDate(d.getDate()-d.getDay());
    const sundays=[];
    for(let i=0;i<4;i++){sundays.push(fmt.format(d));d.setDate(d.getDate()-7);}
    const seen=new Map();
    (att||[]).forEach(a=>{const day=fmt.format(new Date(a.checked_in_at));if(sundays.includes(day)){if(!seen.has(String(a.member_id)))seen.set(String(a.member_id),new Set());seen.get(String(a.member_id)).add(day);}});
    return rows.map(m=>{
      const joined=m.created_at?fmt.format(new Date(m.created_at)):null;
      const eligible=!joined || joined<=sundays[3];
      const autoInactive=eligible && sundays.every(day=>!(seen.get(String(m.id))?.has(day)));
      return {...m,status:autoInactive?'inactive':(m.status||'active'),autoInactive};
    });
  }

  async function refreshMemberStatistics(){
    try{
      const p=await getProfile(true); if(!p || !isManager(p.role)) return;
      const members=await getManagedMembers(p);
      const areaSelect=[...document.querySelectorAll('select')].find(s=>/statistics|area|total/i.test((s.getAttribute('aria-label')||'')+' '+s.className+' '+[...s.options].map(o=>o.textContent).join(' ')) && [...s.options].some(o=>/all areas|total|per area/i.test(o.textContent)));
      const selected=areaSelect?.value||'total';
      let filtered=members;
      if(roleName(p.role)!=='area leader' && selected && !/total|all/i.test(selected)) filtered=members.filter(m=>String(m.area_id)===String(selected) || String(m.area_id||'').toLowerCase()===String(selected).toLowerCase());
      const total=filtered.length;
      const inactive=filtered.filter(m=>String(m.status||'active').toLowerCase()==='inactive').length;
      const active=Math.max(0,total-inactive);
      const stats=[...document.querySelectorAll('.stats .stat')];
      stats.forEach(card=>{
        const label=(card.querySelector('small')?.textContent||'').trim().toLowerCase();
        const value=card.querySelector('strong'); if(!value)return;
        if(label.includes('inactive')) value.textContent=inactive;
        else if(label.includes('active')) value.textContent=active;
        else if(label.includes('total') && label.includes('member')) value.textContent=total;
      });
    }catch(e){console.warn('VCCF statistics refresh:',e);}
  }
  window.vccfRefreshMemberStatistics=refreshMemberStatistics;

  async function deleteMember(id){
    const p=await getProfile(true);
    if(roleName(p?.role)!=='admin'){toast('Only administrators can delete members.');return;}
    const c=getClient(); if(!c)return;
    const {data:member,error:me}=await c.from('members').select('id,display_name').eq('id',id).maybeSingle();
    if(me){toast(me.message);return;}
    if(!member){toast('Member not found.');return;}
    if(!confirm(`Delete ${member.display_name||'this member'}? This removes the member record and attendance history.`))return;
    const u=await c.from('profiles').update({member_id:null}).eq('member_id',id); if(u.error){toast(u.error.message);return}
    const a=await c.from('attendance').delete().eq('member_id',id); if(a.error){toast(a.error.message);return}
    const d=await c.from('members').delete().eq('id',id); if(d.error){toast(d.error.message);return}
    toast('Member deleted successfully.');
    if(typeof window.loadDb==='function')await window.loadDb();
    if(typeof window.refresh==='function')window.refresh();
    queueRepair();
  }
  window.vccfDeleteMember=deleteMember;

  async function syncAddresses(){
    const c=getClient();
    if(!c || typeof db==='undefined' || !Array.isArray(db.members)) return;
    const {data,error}=await c.from('members').select('id,address');
    if(error||!Array.isArray(data)){console.warn('VCCF address sync:',error);return;}
    const map=new Map(data.map(x=>[String(x.id),x.address||'']));
    db.members.forEach(m=>{if(map.has(String(m.id)))m.address=map.get(String(m.id));});
  }

  async function repairAttendanceNames(){
    try{
      const c=getClient(); if(!c) return;
      const p=await getProfile(); if(!p) return;
      const tbody=document.getElementById('attendanceRows');
      if(!tbody) return;
      const {data:rows,error}=await c.from('attendance').select('id,member_id,area_id,checked_in_at').order('checked_in_at',{ascending:false});
      if(error){console.warn('VCCF attendance query:',error);return;}
      const visible=(rows||[]).filter(a=>roleName(p.role)==='admin'||(roleName(p.role)==='area leader'&&String(a.area_id)===String(p.area_id)));
      const ids=[...new Set(visible.map(a=>String(a.member_id)).filter(Boolean))];
      let members=[];
      if(ids.length){const r=await c.from('members').select('id,display_name,area_id').in('id',ids);if(r.error){console.warn('VCCF attendance members:',r.error);return}members=r.data||[];}
      const byId=new Map(members.map(m=>[String(m.id),m]));
      let areas=[];const areaIds=[...new Set(visible.map(a=>String(a.area_id)).filter(Boolean))];
      if(areaIds.length){const r=await c.from('areas').select('id,name').in('id',areaIds);if(!r.error)areas=r.data||[];}
      const areaById=new Map(areas.map(a=>[String(a.id),a.name]));
      const manilaDate=a=>new Date(a).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
      const manilaTime=a=>new Date(a).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'});
      tbody.innerHTML=visible.map(a=>{
        const m=byId.get(String(a.member_id));
        const name=m?.display_name||m?.name||'Unknown member';
        const area=areaById.get(String(a.area_id))||'';
        const date=manilaDate(a.checked_in_at),time=manilaTime(a.checked_in_at);
        return `<tr><td><div class="member-cell"><span class="member-avatar sm">${esc(name.slice(0,1).toUpperCase())}</span><div><b style="color:var(--text)">${esc(name)}</b><br><small style="color:var(--muted)">${esc(m?.id||a.member_id||'')}</small></div></div></td><td><span class="tag">${esc(area)}</span></td><td>${date}</td><td>${time}</td><td>✓ Present <button class="btn secondary" style="margin-left:8px" onclick="editAttendanceDate('${esc(a.id)}')">Edit date</button></td></tr>`;
      }).join('')||'<tr><td colspan="5" style="color:var(--muted)">No attendance recorded yet.</td></tr>';
    }catch(e){console.warn('VCCF attendance name repair:',e);}
  }

  async function repairRecentAttendance(){
    try{
      const c=getClient();const el=document.getElementById('recentAttendance');if(!c||!el)return;
      const {data:rows,error}=await c.from('attendance').select('id,member_id,area_id,checked_in_at').order('checked_in_at',{ascending:false}).limit(8);
      if(error)return;
      const ids=[...new Set((rows||[]).map(a=>String(a.member_id)).filter(Boolean))];
      let members=[];if(ids.length){const r=await c.from('members').select('id,display_name').in('id',ids);if(!r.error)members=r.data||[];}
      const byId=new Map(members.map(m=>[String(m.id),m]));
      el.innerHTML=(rows||[]).map(a=>{const m=byId.get(String(a.member_id));const name=m?.display_name||m?.name||'Unknown member';return `<tr><td><div class="member-cell"><span class="member-avatar sm">${esc(name.slice(0,1).toUpperCase())}</span><b style="color:var(--text)">${esc(name)}</b></div></td><td><span class="tag">${esc(a.area_id||'')}</span></td><td>${new Date(a.checked_in_at).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'})}</td><td>✓ Present</td></tr>`}).join('')||'<tr><td colspan="4" style="color:var(--muted)">No attendance recorded yet.</td></tr>';
    }catch(e){console.warn('VCCF recent attendance repair:',e);}
  }

  async function repairMembersTable(){
    if(repairInFlight){repairQueued=true;return;}
    repairInFlight=true;
    try{
      const table=document.querySelector('#members .tablewrap table.table');
      if(!table?.tHead?.rows?.[0]||!table.tBodies?.[0]){
        await repairAttendanceNames();
        await repairRecentAttendance();
        await refreshMemberStatistics();
        return;
      }
      const p=await getProfile();
      if(!isManager(p?.role)){await repairAttendanceNames();return;}
      await syncAddresses();
      const managed=await getManagedMembers(p);
      const byId=new Map(managed.map(m=>[String(m.id),m]));
      const head=table.tHead.rows[0];
      const wanted=['Name','Birthday','Area','Address','Access','Status','QR','Actions'];
      const existing=new Map([...head.cells].map(h=>[h.textContent.trim().toLowerCase(),h]));
      const headers=wanted.map(label=>{
        const key=label.toLowerCase();
        const h=existing.get(key)||document.createElement('th');
        if(!existing.has(key)) h.textContent=label;
        return h;
      });
      head.replaceChildren(...headers);

      [...table.tBodies[0].rows].forEach(row=>{
        const id=memberIdFromRow(row); const m=byId.get(id); if(!m)return;
        const cells=[...row.cells];
        const view=cells.find(c=>[...c.querySelectorAll('button')].some(b=>b.textContent.trim().toLowerCase()==='view'));
        const action=cells.find(c=>[...c.querySelectorAll('button')].some(b=>['edit','delete'].includes(b.textContent.trim().toLowerCase())));
        const name=cells.find(c=>c.querySelector('small') && c.querySelector('.member-cell')) || cells[0];
        const birthday=cells.find(c=>/^\d{4}-\d{2}-\d{2}$/.test(c.textContent.trim()));
        const access=cells.find(c=>/^(member|admin|area leader)$/i.test(c.textContent.trim()));
        const area=cells.find(c=>/area\s*\d+/i.test(c.textContent.trim()) || c.querySelector('.tag'));
        const actionButtons=action?[...action.querySelectorAll('button')]:[];
        const editButton=actionButtons.find(b=>b.textContent.trim().toLowerCase()==='edit');
        const deleteButton=actionButtons.find(b=>b.textContent.trim().toLowerCase()==='delete');
        row.replaceChildren();
        [name,birthday,area,null,access,null,null,null].forEach((src,i)=>{
          const td=document.createElement('td');
          if(i===3)td.textContent=m.address||'';
          else if(i===5){
            const select=document.createElement('select');select.className='vccf-inline-status';select.dataset.id=m.id;select.style.cssText='border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--panel);font-weight:800;';
            select.innerHTML='<option value="active">Active</option><option value="inactive">Inactive</option>';select.value=m.status==='inactive'?'inactive':'active';select.style.color=select.value==='inactive'?'#dc3545':'#198754';
            select.onchange=async()=>{
              const requested=select.value,previous=m.status||'active';
              const current=await getProfile(true);
              if(!isManager(current?.role)){select.value=previous;return;}
              if(roleName(current.role)==='area leader'&&String(m.area_id)!==String(current.area_id)){toast('You can only change members in your area.');select.value=previous;return;}
              select.disabled=true;
              try{const saved=await saveMemberStatus(m.id,requested);m.status=saved.status;select.value=saved.status;select.style.color=saved.status==='inactive'?'#dc3545':'#198754';toast(`Member set to ${saved.status}.`);await refreshMemberStatistics();}
              catch(e){console.error(e);toast(`Could not save status: ${e?.message||e}`);select.value=previous;}
              finally{select.disabled=false;}
            };
            td.appendChild(select);
          } else if(i===6){if(view)td.appendChild(view);}
          else if(i===7){
            if(editButton)td.appendChild(editButton);
            if(roleName(p.role)==='admin'){
              if(deleteButton)td.appendChild(deleteButton);
              else {const b=document.createElement('button');b.type='button';b.className='btn danger';b.textContent='Delete';b.style.marginLeft='6px';b.onclick=()=>deleteMember(m.id);td.appendChild(b);}
            }
          } else if(src){while(src.firstChild)td.appendChild(src.firstChild);}
          row.appendChild(td);
        });
      });
      await repairAttendanceNames();
      await repairRecentAttendance();
      await refreshMemberStatistics();
    }finally{
      repairInFlight=false;
      if(repairQueued){repairQueued=false;setTimeout(()=>repairMembersTable(),50);}
    }
  }

  function queueRepair(delay=200){
    clearTimeout(window.__VCCF_MEMBER_REPAIR_TIMER__);
    window.__VCCF_MEMBER_REPAIR_TIMER__=setTimeout(()=>repairMembersTable(),delay);
  }
  window.vccfRepairMembers=queueRepair;

  function installAddressSave(){
    if(window.__VCCF_ADDRESS_SAVE_V6__)return;
    window.__VCCF_ADDRESS_SAVE_V6__=true;
    const originalEdit=window.editMember;
    if(typeof originalEdit==='function')window.editMember=function(id){window.__VCCF_EDITING_MEMBER_ID__=id;return originalEdit(id);};
    document.addEventListener('submit',async e=>{
      const form=e.target;if(form?.id!=='memberForm')return;
      const id=window.__VCCF_EDITING_MEMBER_ID__;if(!id||form.dataset.addressPatched==='2')return;
      if(form.dataset.addressPatched==='1'){form.dataset.addressPatched='2';window.__VCCF_EDITING_MEMBER_ID__=null;return;}
      e.preventDefault();e.stopImmediatePropagation();form.dataset.addressPatched='1';
      const c=getClient();if(!c){toast('Database connection is unavailable.');form.dataset.addressPatched='';return;}
      const address=document.getElementById('mAddress')?.value?.trim()||'';
      const {error}=await c.from('members').update({address}).eq('id',id);
      if(error){toast(`Address could not be saved: ${error.message}`);form.dataset.addressPatched='';return;}
      form.requestSubmit();
    },true);
  }

  async function start(){
    if(window.__VCCF_MEMBER_START_V6__) return;
    window.__VCCF_MEMBER_START_V6__=true;
    installAddressSave();
    queueRepair(150);
  }

  window.addEventListener('DOMContentLoaded',start,{once:true});
  window.addEventListener('vccf-app-ready',()=>{cachedProfile=null;queueRepair(150);});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('button[data-view="members"]')) queueRepair(200);
    else if(e.target.closest?.('button[data-view="dashboard"],button[data-view="attendance"]')) clearTimeout(window.__VCCF_MEMBER_REPAIR_TIMER__);
  });
})();