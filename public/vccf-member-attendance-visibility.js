(() => {
  if (window.__VCCF_MEMBER_ATTENDANCE_VISIBILITY__) return;
  window.__VCCF_MEMBER_ATTENDANCE_VISIBILITY__ = true;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g,' ');
  const client = () => window.supabase?.createClient && window.VCCF_SUPABASE_URL && window.VCCF_SUPABASE_PUBLISHABLE_KEY
    ? window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY) : null;

  async function profile(){
    const c=client(); if(!c) return null;
    const {data:{user}}=await c.auth.getUser(); if(!user) return null;
    const {data}=await c.from('profiles').select('role,area_id,member_id').eq('user_id',user.id).maybeSingle();
    return data;
  }

  async function render(){
    const body=document.getElementById('attendanceRows'); if(!body) return;
    const c=client(); const p=await profile(); if(!c||!p) return;
    const [{data:attendance,error:aErr},{data:members,error:mErr},{data:areas}]=await Promise.all([
      c.from('attendance').select('id,member_id,area_id,checked_in_at').order('checked_in_at',{ascending:false}),
      c.from('members').select('id,display_name,area_id'),
      c.from('areas').select('id,name')
    ]);
    if(aErr||mErr){ console.warn('Attendance visibility:',aErr||mErr); return; }
    const byMember=new Map((members||[]).map(m=>[String(m.id),m]));
    const byArea=new Map((areas||[]).map(a=>[String(a.id),a.name]));
    body.innerHTML=(attendance||[]).map(a=>{
      const m=byMember.get(String(a.member_id));
      const name=m?.display_name||'Unknown member';
      const area=byArea.get(String(a.area_id||m?.area_id))||String(a.area_id||'');
      const d=new Date(a.checked_in_at);
      const date=d.toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
      const time=d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Manila'});
      return `<tr><td><div class="member-cell"><span class="member-avatar sm">${esc(name.slice(0,1).toUpperCase())}</span><div><b style="color:var(--text)">${esc(name)}</b></div></div></td><td><span class="tag">${esc(area)}</span></td><td>${date}</td><td>${time}</td><td>✓ Present</td></tr>`;
    }).join('') || '<tr><td colspan="5" style="color:var(--muted)">No attendance recorded yet.</td></tr>';
  }

  function boot(){
    const attendance=document.getElementById('attendance');
    if(!attendance?.classList.contains('active')) return;
    render();
  }
  window.vccfRefreshSharedAttendance=render;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));
  document.querySelectorAll('.nav button[data-view="attendance"]').forEach(b=>b.addEventListener('click',()=>setTimeout(render,180)));
  window.addEventListener('vccf-app-ready',()=>setTimeout(boot,300));
})();
