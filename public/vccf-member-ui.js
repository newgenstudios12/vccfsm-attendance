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

  async function saveMemberStatus(memberId, status) {
    const c = getClient();
    if (!c) throw new Error('Database connection is unavailable.');
    const { data, error } = await c.rpc('set_member_status', { p_member_id: memberId, p_status: status });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id || !row?.status) throw new Error('Status update returned no updated member. Make sure the set_member_status SQL function has been run in Supabase.');
    return row;
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

    const autoInactive = result.filter(m => m.autoInactive && m.status !== 'inactive');
    await Promise.all(autoInactive.map(async x => {
      try { const saved = await saveMemberStatus(x.id, 'inactive'); x.status = saved.status; }
      catch (e) { console.warn('VCCF automatic inactive update failed:', e); }
    }));
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

  function fixAttendanceNames() {
    try {
      if (typeof db === 'undefined' || !Array.isArray(db.members)) return;
      const byId = new Map(db.members.map(m => [String(m.id), m]));
      const byCode = new Map(db.members.map(m => [String(m.memberCode || ''), m]));
      document.querySelectorAll('#attendanceRows tr').forEach(row => {
        const first = row.cells?.[0]; if (!first) return;
        const small = first.querySelector('small');
        const key = small?.textContent?.trim() || '';
        const m = byId.get(key) || byCode.get(key);
        if (!m || !m.name) return;
        const avatar = typeof memberAvatar === 'function' ? memberAvatar(m, true) : `<span class="member-avatar sm">${esc((m.name || '?').slice(0,1).toUpperCase())}</span>`;
        first.innerHTML = `<div class="member-cell">${avatar}<div><b>${esc(m.name)}</b><br><small style="color:var(--muted)">${esc(m.memberCode || m.id)}</small></div></div>`;
      });
      document.querySelectorAll('#recentAttendance tr').forEach(row => {
        const first = row.cells?.[0]; if (!first) return;
        const current = first.querySelector('b')?.textContent?.trim();
        if (current) return;
        const code = first.querySelector('small')?.textContent?.trim();
        const m = byId.get(code) || byCode.get(code);
        if (!m) return;
        const avatar = typeof memberAvatar === 'function' ? memberAvatar(m, true) : '';
        first.innerHTML = `<div class="member-cell">${avatar}<b>${esc(m.name)}</b></div>`;
      });
    } catch (e) { console.warn('VCCF attendance name repair:', e); }
  }

  async function syncMemberAddressData() {
    const c = getClient();
    if (!c || typeof db === 'undefined' || !Array.isArray(db.members)) return;
    const { data, error } = await c.from('members').select('id,address').order('display_name');
    if (error || !Array.isArray(data)) { console.warn('VCCF address sync:', error); return; }
    const rawById = new Map(data.map(m => [String(m.id), m]));
    db.members.forEach(m => {
      const raw = rawById.get(String(m.id));
      if (!raw) return;
      m.address = raw.address || '';
    });
    if (typeof renderMembers === 'function') renderMembers();
  }

  function installAddressSavePatch() {
    if (window.__VCCF_ADDRESS_PATCH__) return;
    window.__VCCF_ADDRESS_PATCH__ = true;

    const originalEdit = window.editMember;
    if (typeof originalEdit === 'function') {
      window.editMember = function(id) {
        window.__VCCF_EDITING_MEMBER_ID__ = id;
        return originalEdit(id);
      };
    }

    // The main app's memberForm handler does not include address in its Supabase payload.
    // Intercept edit submissions, save address first, then allow the original handler to
    // continue saving the other member fields and reloading the database.
    document.addEventListener('submit', async e => {
      const form = e.target;
      if (!form || form.id !== 'memberForm') return;
      const id = window.__VCCF_EDITING_MEMBER_ID__;
      if (!id || form.dataset.vccfAddressHandled === '1') return;

      e.preventDefault();
      e.stopImmediatePropagation();
      form.dataset.vccfAddressHandled = '1';

      const address = document.getElementById('mAddress')?.value?.trim() || '';
      const c = getClient();
      if (!c) {
        form.dataset.vccfAddressHandled = '';
        toast('Database connection is unavailable.');
        return;
      }

      const { error } = await c.from('members').update({ address }).eq('id', id);
      if (error) {
        form.dataset.vccfAddressHandled = '';
        toast(`Address could not be saved: ${error.message}`);
        return;
      }

      // Run the original onsubmit handler after the address has been persisted.
      form.dataset.vccfAddressHandled = '1';
      form.requestSubmit();
    }, true);

    // On the second submit, bypass this patch so the original handler can run.
    document.addEventListener('submit', e => {
      const form = e.target;
      if (form?.id === 'memberForm' && form.dataset.vccfAddressHandled === '1') {
        form.dataset.vccfAddressHandled = '2';
        window.__VCCF_EDITING_MEMBER_ID__ = null;
      }
    }, false);
  }

  async function decorate() {
    installAddressSavePatch();
    const table = document.querySelector('#members .tablewrap table.table');
    if (!table?.tHead?.rows?.[0] || !table.tBodies?.[0]) {
      fixAttendanceNames();
      return;
    }
    const p = await getProfile();
    if (!isManager(p?.role)) { fixAttendanceNames(); return; }
    const members = await getMembersForStatus(p);
    const byId = new Map(members.map(m => [String(m.id), m]));
    const head = table.tHead.rows[0];
    let statusIndex = [...head.cells].findIndex(c => c.dataset.vccfStatusHeader === '1');
    if (statusIndex < 0) {
      const qrIndex = [...head.cells].findIndex(c => /qr/i.test(c.textContent || ''));
      statusIndex = qrIndex >= 0 ? qrIndex : Math.max(0, head.cells.length - 1);
      const th = document.createElement('th'); th.textContent = 'Status'; th.dataset.vccfStatusHeader = '1';
      head.insertBefore(th, head.cells[statusIndex] || null);
    }

    [...table.tBodies[0].rows].forEach(row => {
      const id = findMemberId(row), m = byId.get(String(id));
      if (!m) return;
      let cell = row.querySelector('td[data-vccf-status-cell="1"]');
      if (!cell) { cell = document.createElement('td'); cell.dataset.vccfStatusCell = '1'; row.insertBefore(cell, row.cells[statusIndex] || null); }
      const inactive = m.status === 'inactive';
      cell.innerHTML = `<select class="vccf-inline-status" data-id="${esc(m.id)}" style="border:1px solid var(--line);border-radius:9px;padding:7px 9px;background:var(--panel);color:${inactive?'#dc3545':'#198754'};font-weight:800"><option value="active" ${!inactive?'selected':''}>Active</option><option value="inactive" ${inactive?'selected':''}>Inactive</option></select>`;
      cell.querySelector('select').onchange = async e => {
        const select = e.target, requested = select.value, previous = m.status || 'active';
        const current = await getProfile(true);
        if (!isManager(current?.role)) { toast('You do not have permission.'); select.value=previous; return; }
        if (roleName(current.role) === 'area leader' && String(m.area_id) !== String(current.area_id)) { toast('You can only change members in your area.'); select.value=previous; return; }
        select.disabled = true;
        try { const saved = await saveMemberStatus(m.id, requested); m.status = saved.status; toast(`Member set to ${saved.status}.`); select.value = saved.status; select.style.color = saved.status === 'inactive' ? '#dc3545' : '#198754'; }
        catch (err) { console.error('VCCF member status save failed:', err); toast(`Could not save status: ${err?.message || err}`); select.value = previous; }
        finally { select.disabled = false; }
      };
      const actionCell = row.cells[row.cells.length - 1];
      if (actionCell && roleName(p.role) === 'admin' && !actionCell.querySelector('[data-vccf-delete-member]')) {
        const b=document.createElement('button'); b.type='button'; b.className='btn danger'; b.textContent='Delete'; b.dataset.vccfDeleteMember='1'; b.style.marginLeft='6px'; b.onclick=()=>deleteMember(m.id); actionCell.appendChild(b);
      }
    });
    fixAttendanceNames();
    await syncMemberAddressData();
  }

  function start() {
    let tries = 0;
    const tick = async () => { tries++; try { await decorate(); } catch (e) { console.warn('VCCF member UI:', e); } if (tries < 30) setTimeout(tick, 500); };
    tick();
  }

  window.addEventListener('DOMContentLoaded', start);
  window.addEventListener('vccf-app-ready', () => { cachedProfile=null; start(); });
  document.addEventListener('click', e => { const b=e.target.closest?.('button[data-view="members"]'); if(b) setTimeout(decorate,100); });
})();