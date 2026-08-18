(() => {
  const supa=window.supabase?.createClient?.(window.VCCF_SUPABASE_URL,window.VCCF_SUPABASE_PUBLISHABLE_KEY);if(!supa||window.__VCCF_MEMBER_UI__)return;window.__VCCF_MEMBER_UI__=true;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const sundayDates=()=>{const d=new Date(today()+'T12:00:00+08:00');d.setDate(d.getDate()-d.getDay());return Array.from({length:4},()=>{const x=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);d.setDate(d.getDate()-7);return x})};
  const toast=m=>{const x=document.getElementById('toast');if(x){x.textContent=m;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2500)}};
  const roleName=r=>String(r||'').toLowerCase().replace(/_/g,' '),manager=r=>['admin','area leader'].includes(roleName(r));
  async function profile(){const {data:{user}}=await supa.auth.getUser();if(!user)return null;const {data}=await supa.from('profiles').select('role,area_id').eq('user_id',user.id).maybeSingle();return data?{...data,user_id:user.id}:null}

  async function statusData(){
    const p=await profile();if(!manager(p?.role))return [];
    let mq=supa.from('members').select('id,display_name,area_id,status,created_at');if(roleName(p.role)==='area leader')mq=mq.eq('area_id',p.area_id);
    const [{data:ms},{data:att}]=await Promise.all([mq,supa.from('attendance').select('member_id,checked_in_at,area_id')]);
    const ds=sundayDates(),sets=new Map();(att||[]).forEach(a=>{const d=new Date(a.checked_in_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});if(ds.includes(d)){if(!sets.has(a.member_id))sets.set(a.member_id,new Set());sets.get(a.member_id).add(d)}});
    const updates=[];const out=(ms||[]).map(m=>{const joined=m.created_at?new Date(m.created_at).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}):null;const eligible=!joined||joined<=ds[3];const missedFour=eligible&&ds.every(d=>!(sets.get(m.id)?.has(d)));const status=missedFour?'inactive':(m.status||'active');if(m.status!==status)updates.push({id:m.id,status});return {...m,status}});
    await Promise.all(updates.map(x=>supa.from('members').update({status:x.status,status_updated_at:new Date().toISOString()}).eq('id',x.id)));return out;
  }

  async function deleteMember(id){
    const p=await profile();
    if(roleName(p?.role)!=='admin'){toast('Only administrators can delete members.');return}
    const memberId=String(id);
    const members=await supa.from('members').select('id,display_name').eq('id',memberId).maybeSingle();
    if(members.error){toast(members.error.message);return}
    if(!members.data){toast('Member not found.');return}
    if(!confirm(`Delete ${members.data.display_name||'this member'}? This removes the member record and attendance history. The login account, if any, is not deleted.`))return;
    try{
      const unlink=await supa.from('profiles').update({member_id:null}).eq('member_id',memberId);
      if(unlink.error)throw unlink.error;
      const att=await supa.from('attendance').delete().eq('member_id',memberId);
      if(att.error)throw att.error;
      const del=await supa.from('members').delete().eq('id',memberId);
      if(del.error)throw del.error;
      toast('Member deleted successfully.');
      if(typeof window.loadDb==='function')await window.loadDb();
      if(typeof window.renderMembers==='function')window.renderMembers();
      if(typeof window.refresh==='function')window.refresh();
      setTimeout(decorateMembersTable,150);
    }catch(e){toast(e?.message||'Unable to delete member.')}
  }
  window.vccfDeleteMember=deleteMember;

  async function decorateMembersTable(){
    const p=await profile();if(!manager(p?.role))return;const table=document.querySelector('#members .tablewrap table.table');if(!table?.tHead?.rows?.[0]||!table.tBodies?.[0])return;
    const members=await statusData(),byId=new Map(members.map(m=>[String(m.id),m])),head=table.tHead.rows[0];
    let statusIndex=[...head.cells].findIndex(c=>c.dataset.memberStatus==='1');
    if(statusIndex<0){const qrIndex=[...head.cells].findIndex(c=>/qr|code/i.test(c.textContent||''));statusIndex=qrIndex<0?head.cells.length:qrIndex;const th=document.createElement('th');th.textContent='Status';th.dataset.memberStatus='1';head.insertBefore(th,head.cells[statusIndex]||null)}
    [...table.tBodies[0].rows].forEach(row=>{const id=row.cells[0]?.querySelector('small')?.textContent?.trim(),m=byId.get(String(id));let cell=row.querySelector('td[data-member-status-cell="1"]');if(!cell){cell=document.createElement('td');cell.dataset.memberStatusCell='1';row.insertBefore(cell,row.cells[statusIndex]||null)}if(!m){cell.textContent='—';return}const inactive=m.status==='inactive',c=inactive?'#dc3545':'#198754';cell.innerHTML=`<select class="vccf-inline-status" data-id="${esc(m.id)}" style="border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--panel);color:${c};font-weight:800"><option value="active" ${!inactive?'selected':''}>Active</option><option value="inactive" ${inactive?'selected':''}>Inactive</option></select>`;cell.querySelector('select').onchange=async e=>{const r=await profile();if(!manager(r?.role)){toast('You do not have permission.');return}if(roleName(r.role)==='area leader'&&String(m.area_id)!==String(r.area_id)){toast('You can only change members in your area.');e.target.value=m.status;return}const u=await supa.from('members').update({status:e.target.value,status_updated_at:new Date().toISOString()}).eq('id',m.id);if(u.error){toast(u.error.message);return}m.status=e.target.value;toast(`Member set to ${e.target.value}.`);await updateDashboardStats()}});
      const actionCell=row.cells[row.cells.length-1];
      if(actionCell&&roleName(p.role)==='admin'&&!actionCell.querySelector('[data-vccf-delete-member]')){
        const b=document.createElement('button');b.type='button';b.className='btn danger';b.textContent='Delete';b.dataset.vccfDeleteMember='1';b.style.marginLeft='6px';b.onclick=()=>deleteMember(m.id);actionCell.appendChild(b);
      }
    });
  }

  async function updateDashboardStats(){
    const p=await profile();if(!manager(p?.role))return;const ms=await statusData(),counts={total:ms.length,active:ms.filter(m=>m.status==='active').length,inactive:ms.filter(m=>m.status==='inactive').length};
    const total=document.getElementById('totalMembers'),att=document.getElementById('sundayAttendance'),rate=document.getElementById('attendanceRate'),newer=document.getElementById('newMembers');
    if(total)total.textContent=counts.total;if(newer)newer.textContent=counts.active;if(att)att.textContent=counts.inactive;if(rate)rate.textContent=counts.total?Math.round(counts.active/counts.total*100)+'%':'0%';
    const labels=[total?.previousElementSibling,newer?.previousElementSibling,att?.previousElementSibling,rate?.previousElementSibling];if(labels[0])labels[0].textContent='Total Members';if(labels[1])labels[1].textContent='Active Members';if(labels[2])labels[2].textContent='Inactive Members';if(labels[3])labels[3].textContent='Active Rate';
    let scope=document.getElementById('memberStatusScope');if(!scope){const dashboard=document.getElementById('dashboard'),stats=document.querySelector('#dashboard .stats');if(!dashboard||!stats)return;scope=document.createElement('div');scope.id='memberStatusScope';scope.style.cssText='color:var(--muted);font-size:.82rem;margin-top:8px';stats.insertAdjacentElement('afterend',scope)}scope.textContent=roleName(p.role)==='admin'?'Showing all areas':'Showing your assigned area';
  }

  function patchRenderMembers(){if(typeof window.renderMembers!=='function'||window.renderMembers.__vccfPatched)return;const original=window.renderMembers;const patched=function(){original();setTimeout(decorateMembersTable,100)};patched.__vccfPatched=true;window.renderMembers=patched;setTimeout(decorateMembersTable,100)}
  function run(){setTimeout(async()=>{try{patchRenderMembers();const view=document.querySelector('.view.active')?.id;if(view==='members')await decorateMembersTable();if(view==='dashboard')await updateDashboardStats()}catch(e){console.warn('VCCF member UI:',e)}},300)}
  window.addEventListener('DOMContentLoaded',()=>{run();document.querySelectorAll('.nav button[data-view]').forEach(b=>b.addEventListener('click',run))});new MutationObserver(run).observe(document.body,{subtree:true,childList:true});
})();
