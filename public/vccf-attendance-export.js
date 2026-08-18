(() => {
  if (window.__VCCF_ATTENDANCE_EXPORT_V1__) return;
  window.__VCCF_ATTENDANCE_EXPORT_V1__ = true;

  const escCsv = value => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const roleName = value => String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  const manilaDate = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(value));

  function getClient() {
    if (window.__VCCF_EXPORT_CLIENT__) return window.__VCCF_EXPORT_CLIENT__;
    if (!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    window.__VCCF_EXPORT_CLIENT__ = window.supabase.createClient(
      window.VCCF_SUPABASE_URL,
      window.VCCF_SUPABASE_PUBLISHABLE_KEY
    );
    return window.__VCCF_EXPORT_CLIENT__;
  }

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2800);
  }

  function findAttendanceSection() {
    const rows = document.getElementById('attendanceRows');
    if (!rows) return null;
    return rows.closest('section, .panel, .card, .content, main') || rows.parentElement?.parentElement || rows.parentElement;
  }

  function addExportButton() {
    if (document.getElementById('vccfExportAttendance')) return true;
    const section = findAttendanceSection();
    if (!section) return false;

    const button = document.createElement('button');
    button.id = 'vccfExportAttendance';
    button.type = 'button';
    button.className = 'btn secondary';
    button.textContent = 'Download Sunday Attendance';
    button.style.margin = '0 0 14px 8px';
    button.addEventListener('click', exportAttendance);

    const heading = section.querySelector('h1,h2,h3,h4,.section-title,.panel-title');
    if (heading?.parentElement) heading.parentElement.appendChild(button);
    else section.insertBefore(button, section.firstChild);
    return true;
  }

  async function exportAttendance() {
    const client = getClient();
    if (!client) { toast('Database connection is unavailable.'); return; }

    const button = document.getElementById('vccfExportAttendance');
    if (button) { button.disabled = true; button.textContent = 'Preparing…'; }

    try {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth?.user) throw new Error('Please sign in first.');

      const { data: profile, error: profileError } = await client
        .from('profiles').select('role,area_id').eq('user_id', auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Your VCCF profile was not found.');

      const role = roleName(profile.role);
      if (!['admin', 'area leader'].includes(role)) {
        throw new Error('Only administrators and area leaders can download attendance data.');
      }

      const [membersResult, areasResult, attendanceResult] = await Promise.all([
        client.from('members').select('id,display_name,area_id').order('display_name'),
        client.from('areas').select('id,name').order('name'),
        client.from('attendance').select('member_id,area_id,checked_in_at').order('checked_in_at')
      ]);
      if (membersResult.error) throw membersResult.error;
      if (areasResult.error) throw areasResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const members = membersResult.data || [];
      const areas = areasResult.data || [];
      const attendance = attendanceResult.data || [];
      const areaById = new Map(areas.map(a => [String(a.id), a.name || 'Unassigned']));

      let visibleMembers = members;
      if (role === 'area leader') {
        visibleMembers = members.filter(m => String(m.area_id) === String(profile.area_id));
      }
      const visibleIds = new Set(visibleMembers.map(m => String(m.id)));
      const visibleAttendance = attendance.filter(a => visibleIds.has(String(a.member_id)));

      // Build a Sunday column for every Sunday represented in the attendance history.
      // If there are no records yet, export the current Sunday so the sheet is still useful.
      const sundaySet = new Set();
      visibleAttendance.forEach(a => {
        const d = manilaDate(a.checked_in_at);
        const day = new Date(`${d}T12:00:00+08:00`).getDay();
        if (day === 0) sundaySet.add(d);
      });
      if (!sundaySet.size) {
        const today = new Date(new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date()) + 'T12:00:00+08:00');
        today.setDate(today.getDate() - today.getDay());
        sundaySet.add(new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(today));
      }
      const sundays = [...sundaySet].sort();

      // A member is Present when they have at least one check-in on that Sunday.
      const attendanceSet = new Set(
        visibleAttendance
          .filter(a => new Date(manilaDate(a.checked_in_at) + 'T12:00:00+08:00').getDay() === 0)
          .map(a => `${a.member_id}|${manilaDate(a.checked_in_at)}`)
      );

      // Categorize by area first, then alphabetically by member name.
      visibleMembers.sort((a, b) => {
        const areaA = String(areaById.get(String(a.area_id)) || 'Unassigned');
        const areaB = String(areaById.get(String(b.area_id)) || 'Unassigned');
        return areaA.localeCompare(areaB) || String(a.display_name || '').localeCompare(String(b.display_name || ''), undefined, { sensitivity: 'base' });
      });

      const headers = ['Area', 'Name', ...sundays];
      const lines = [headers.map(escCsv).join(',')];
      let lastArea = null;

      for (const member of visibleMembers) {
        const area = areaById.get(String(member.area_id)) || 'Unassigned';
        const row = [area, member.display_name || 'Unnamed member'];
        sundays.forEach(sunday => {
          row.push(attendanceSet.has(`${member.id}|${sunday}`) ? 'Present' : 'Absent');
        });
        lines.push(row.map(escCsv).join(','));
        lastArea = area;
      }

      const csv = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const scope = role === 'admin' ? 'all-areas' : (areaById.get(String(profile.area_id)) || 'my-area').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      link.href = url;
      link.download = `vccf-sunday-attendance-${scope}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Attendance export downloaded: ${visibleMembers.length} members, ${sundays.length} Sundays.`);
    } catch (error) {
      console.error('VCCF attendance export:', error);
      toast(`Export failed: ${error?.message || error}`);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Download Sunday Attendance'; }
    }
  }

  window.vccfExportAttendance = exportAttendance;

  function start() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (addExportButton() || attempts >= 20) clearInterval(timer);
    }, 500);
  }

  window.addEventListener('DOMContentLoaded', start);
  window.addEventListener('vccf-app-ready', start);
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-view="attendance"],button[onclick*="attendance"],button')) {
      setTimeout(addExportButton, 250);
    }
  });
})();
