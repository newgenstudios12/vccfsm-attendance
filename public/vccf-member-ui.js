(() => {
  if (window.__VCCF_MEMBER_UI_V2__) return;
  window.__VCCF_MEMBER_UI_V2__ = true;

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  const isManager = r => ['admin', 'area leader'].includes(roleName(r));
  const toast = m => {
    const x = document.getElementById('toast');
    if (x) { x.textContent = m; x.classList.add('show'); setTimeout(() => x.classList.remove('show'), 2500); }
  };

  let client = null;
  let cachedProfile = null;

  function getClient() {
    if (client) return client;
    const sb = window.supabase;
    if (!sb?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    client = sb.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function getProfile(force = false) {
    if (cachedProfile && !force) return cachedProfile;
    const c = getClient();
    if (!c) return null;
    const { data: auth, error: ae } = await c.auth.getUser();
    if (ae || !auth?.user) return null;
    const { data, error } = await c.from('profiles').select('user_id,role,area_id').eq('user_id', auth.user.id).maybeSingle();
    if (error || !data) return null;
    cachedProfile = data;
    return data;
  }

  function findMemberId(row) {
    return row?.cells?.[0]?.querySelector('small')?.textContent?.trim() || '';
  }

  async function getMembersForStatus(p) {
    const c = getClient();
    if (!c || !p) return [];
    let q = c.from('members').select('id,display_name,area_id,status,created_at');
    if (roleName(p.role) === 'area leader') q = q.eq('area_id', p.area_id);
    const { data, error } = await q;
    if (error) { console.warn('VCCF member status query:', error); return []; }

    const rows = data || [];
    const { data: att, error: attError } = await c.from('attendance').select('member_id,checked_in_at');
    if (attError) { console.warn('VCCF attendance status query:', attError); return rows; }

    const now = new Date();
    const manila = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' });
    const d = new Date(manila.format(now) + 'T12:00:00+08:00');
    d.setDate(d.getDate() - d.getDay());
    const sundays = Array.from({length:4}, () => { const x=manila.format(d); d.setDate(d.getDate()-7); return x; });
    const seen = new Map();
    (att || []).forEach(a => {
      const day = manila.format(new Date(a.checked_in_at));
      if (sundays.includes(day)) {
        if (!seen.has(String(a.member_id))) seen.set(String(a.member_id), new Set());
        seen.get(String(a.member_id)).add(day);
      }
    });

    const result = rows.map(m => {
      const joined = m.created_at ? manila.format(new Date(m.created_at)) : null;
      const eligible = !joined || joined <= sundays[3];
      const inactiveByAttendance = eligible && sundays.every(day => !(seen.get(String(m.id))?.has(day)));
      return {...m, status: inactiveByAttendance ? 'inactive' : (m.status || 'active'), autoInactive: inactiveByAttendance};
    });

    // Only enforce the automatic four-Sunday rule. Do not write every row back here;
    // otherwise a manual status change can immediately be overwritten by a refresh.
    const autoInactive = result.filter(m => m.autoInactive && m.status !== 'inactive');
    await Promise.all(autoInactive.map(x => c.from('members').update({status:'inactive'}).eq('id',x.id)));
    autoInactive.forEach(x => { x.status = 'inactive'; });
    return result;
  }

  async function deleteMember(id) {
    const p = await getProfile(true);
    if (roleName(p?.role) !== 'admin') { toast('Only administrators can delete members.'); return; }
    const c = getClient();
    if (!c) return;
    const { data: member, error: me } = await c.from('members').select('id,display_name').eq('id', id).maybeSingle();
    if (me) { toast(me.message); return; }
    if (!member) { toast('Member not found.'); return; }
    if (!confirm(`Delete ${member.display_name || 'this member'}? This removes the member record and attendance history.`)) return;

    const unlink = await c.from('profiles').update({member_id:null}).eq('member_id', id);
    if (unlink.error) { toast(unlink.error.message); return; }
    const att = await c.from('attendance').delete().eq('member_id', id);
    if (att.error) { toast(att.error.message); return; }
    const del = await c.from('members').delete().eq('id', id);
    if (del.error) { toast(del.error.message); return; }

    toast('Member deleted successfully.');
    if (typeof window.loadDb === 'function') await window.loadDb();
    if (typeof window.refresh === 'function') window.refresh();
    setTimeout(decorate, 200);
  }
  window.vccfDeleteMember = deleteMember;

  async function decorate() {
    const table = document.querySelector('#members .tablewrap table.table');
    if (!table?.tHead?.rows?.[0] || !table.tBodies?.[0]) return;
    const p = await getProfile();
    if (!isManager(p?.role)) return;

    const members = await getMembersForStatus(p);
    const byId = new Map(members.map(m => [String(m.id), m]));
    const head = table.tHead.rows[0];

    let statusIndex = [...head.cells].findIndex(c => c.dataset.vccfStatusHeader === '1');
    if (statusIndex < 0) {
      const qrIndex = [...head.cells].findIndex(c => /qr/i.test(c.textContent || ''));
      statusIndex = qrIndex >= 0 ? qrIndex : Math.max(0, head.cells.length - 1);
      const th = document.createElement('th');
      th.textContent = 'Status';
      th.dataset.vccfStatusHeader = '1';
      head.insertBefore(th, head.cells[statusIndex] || null);
    }

    [...table.tBodies[0].rows].forEach(row => {
      const id = findMemberId(row);
      const m = byId.get(String(id));
      if (!m) return;

      let cell = row.querySelector('td[data-vccf-status-cell="1"]');
      if (!cell) {
        cell = document.createElement('td');
        cell.dataset.vccfStatusCell = '1';
        row.insertBefore(cell, row.cells[statusIndex] || null);
      }
      const inactive = m.status === 'inactive';
      cell.innerHTML = `<select class="vccf-inline-status" data-id="${esc(m.id)}" style="border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--panel);color:${inactive?'#dc3545':'#198754'};font-weight:800"><option value="active" ${!inactive?'selected':''}>Active</option><option value="inactive" ${inactive?'selected':''}>Inactive</option></select>`;
      cell.querySelector('select').onchange = async e => {
        const select = e.target;
        const requested = select.value;
        const previous = m.status || 'active';
        const current = await getProfile(true);
        if (!isManager(current?.role)) { toast('You do not have permission.'); select.value=previous; return; }
        if (roleName(current.role) === 'area leader' && String(m.area_id) !== String(current.area_id)) { toast('You can only change members in your area.'); select.value=previous; return; }
        const c = getClient();
        if (!c) { toast('Database connection is unavailable.'); select.value=previous; return; }

        select.disabled = true;
        const r = await c.from('members').update({status:requested}).eq('id',m.id).select('id,status').maybeSingle();
        select.disabled = false;

        if (r.error) {
          console.error('VCCF member status save failed:', r.error);
          toast(`Could not save status: ${r.error.message}`);
          select.value=previous;
          return;
        }
        if (!r.data) {
          console.error('VCCF member status save returned no row. Check Supabase UPDATE RLS policy.');
          toast('Status was not saved. Please check the member UPDATE policy in Supabase.');
          select.value=previous;
          return;
        }

        m.status = r.data.status;
        toast(`Member set to ${r.data.status}.`);
        select.value = r.data.status;
        select.style.color = r.data.status === 'inactive' ? '#dc3545' : '#198754';
      };

      const actionCell = row.cells[row.cells.length - 1];
      if (actionCell && roleName(p.role) === 'admin' && !actionCell.querySelector('[data-vccf-delete-member]')) {
        const b=document.createElement('button');
        b.type='button'; b.className='btn danger'; b.textContent='Delete'; b.dataset.vccfDeleteMember='1'; b.style.marginLeft='6px';
        b.onclick=()=>deleteMember(m.id);
        actionCell.appendChild(b);
      }
    });
  }

  function start() {
    let tries = 0;
    const tick = async () => {
      tries++;
      try { await decorate(); } catch (e) { console.warn('VCCF member UI:', e); }
      if (tries < 30) setTimeout(tick, 500);
    };
    tick();
  }

  window.addEventListener('DOMContentLoaded', start);
  window.addEventListener('vccf-app-ready', () => { cachedProfile=null; start(); });
  document.addEventListener('click', e => {
    const b=e.target.closest?.('button[data-view="members"]');
    if(b) setTimeout(decorate,100);
  });
})();
