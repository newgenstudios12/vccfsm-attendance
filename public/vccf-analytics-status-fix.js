(() => {
  if (window.__VCCF_ANALYTICS_STATUS_FIX_V1__) return;
  window.__VCCF_ANALYTICS_STATUS_FIX_V1__ = true;

  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  let sb = null;

  function client() {
    if (sb) return sb;
    if (!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    sb = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return sb;
  }

  function manilaDate(value) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  }

  function recentSundays() {
    const today = manilaDate(new Date());
    const d = new Date(`${today}T12:00:00+08:00`);
    d.setDate(d.getDate() - d.getDay());
    const out = [];
    for (let i = 0; i < 4; i++) { out.push(manilaDate(d)); d.setDate(d.getDate() - 7); }
    return out;
  }

  function writeStats(total, active, inactive) {
    document.querySelectorAll('.stats .stat').forEach(card => {
      const label = (card.querySelector('small')?.textContent || '').trim().toLowerCase();
      const value = card.querySelector('strong');
      if (!value) return;
      if (label.includes('inactive')) value.textContent = inactive;
      else if (label.includes('active')) value.textContent = active;
      else if (label.includes('total') && label.includes('member')) value.textContent = total;
    });
  }

  function findAnalyticsView() {
    return document.getElementById('analytics')
      || document.querySelector('.view[data-view="analytics"]')
      || [...document.querySelectorAll('.view')].find(v => /Leadership analytics|Attendance overview|Attendance activity/i.test(v.textContent || ''))
      || null;
  }

  function removeHeatAnalytics() {
    const analytics = findAnalyticsView();
    if (!analytics) return;
    analytics.querySelectorAll('.panel, [data-analytics], section, article').forEach(node => {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (/heat\s*analytics|attendance\s*heatmap|heatmap|^Attendance activity\b|^Daily check-?ins over the selected range/i.test(text)) {
        if (node.id !== 'vccfSundayAnalytics') node.remove();
      }
    });
  }

  function enforceSundayOverviewPlacement() {
    const analytics = findAnalyticsView();
    const graph = document.getElementById('vccfSundayAnalytics');
    if (!analytics || !graph) return;

    const copies = [...document.querySelectorAll('#vccfSundayAnalytics')];
    copies.slice(1).forEach(node => node.remove());
    if (!analytics.contains(graph)) analytics.appendChild(graph);

    Object.assign(graph.style, {
      position: 'static', inset: 'auto', float: 'none', transform: 'none',
      left: 'auto', top: 'auto', right: 'auto', bottom: 'auto',
      width: '100%', maxWidth: '100%', margin: '18px 0 0', clear: 'both'
    });
    graph.dataset.analyticsOwner = 'main-analytics';
  }

  function cleanAnalyticsLayout() {
    removeHeatAnalytics();
    enforceSundayOverviewPlacement();
  }

  async function getData() {
    const c = client();
    if (!c) return null;
    const { data: auth, error: authError } = await c.auth.getUser();
    if (authError || !auth?.user) return null;
    const { data: profile, error: profileError } = await c.from('profiles').select('user_id,role,area_id').eq('user_id', auth.user.id).maybeSingle();
    if (profileError || !profile || !['admin', 'area leader'].includes(roleName(profile.role))) return null;
    let memberQuery = c.from('members').select('id,display_name,area_id,created_at,status').order('display_name');
    if (roleName(profile.role) === 'area leader') memberQuery = memberQuery.eq('area_id', profile.area_id);
    const { data: members, error: membersError } = await memberQuery;
    if (membersError) throw membersError;
    const { data: attendance, error: attendanceError } = await c.from('attendance').select('member_id,checked_in_at');
    if (attendanceError) throw attendanceError;
    return { profile, members: members || [], attendance: attendance || [] };
  }

  function calculate(members, attendance) {
    const sundays = recentSundays();
    const seen = new Map();
    for (const row of attendance) {
      const day = manilaDate(row.checked_in_at);
      if (!sundays.includes(day)) continue;
      const id = String(row.member_id);
      if (!seen.has(id)) seen.set(id, new Set());
      seen.get(id).add(day);
    }
    return members.map(member => {
      const joined = member.created_at ? manilaDate(member.created_at) : null;
      const eligible = !joined || joined <= sundays[3];
      const hasRecentAttendance = sundays.some(day => seen.get(String(member.id))?.has(day));
      const inactive = eligible && !hasRecentAttendance;
      return { ...member, effectiveStatus: inactive ? 'inactive' : 'active' };
    });
  }

  function updateStatusControls(rows) {
    const byId = new Map(rows.map(row => [String(row.id), row]));
    document.querySelectorAll('.vccf-inline-status[data-id]').forEach(select => {
      const row = byId.get(String(select.dataset.id));
      if (!row) return;
      select.value = row.effectiveStatus;
      select.style.color = row.effectiveStatus === 'inactive' ? '#dc3545' : '#198754';
      select.title = row.effectiveStatus === 'inactive' ? 'Inactive: no attendance recorded on any of the last four Sundays.' : 'Active: attendance recorded within the last four Sundays.';
    });
  }

  async function refresh() {
    try {
      cleanAnalyticsLayout();
      const data = await getData();
      if (!data) return;
      const rows = calculate(data.members, data.attendance);
      const inactive = rows.filter(row => row.effectiveStatus === 'inactive').length;
      const active = rows.length - inactive;
      writeStats(rows.length, active, inactive);
      updateStatusControls(rows);
      cleanAnalyticsLayout();
    } catch (error) {
      console.warn('VCCF analytics status fix:', error);
    }
  }

  window.vccfRefreshMemberAnalyticsStatus = refresh;

  let observerTimer = null;
  const queueClean = () => { clearTimeout(observerTimer); observerTimer = setTimeout(cleanAnalyticsLayout, 40); };

  function schedule() {
    refresh();
    setTimeout(refresh, 800);
    setTimeout(refresh, 1800);
    setTimeout(refresh, 3500);
  }

  document.addEventListener('DOMContentLoaded', () => {
    schedule();
    new MutationObserver(queueClean).observe(document.body, { childList: true, subtree: true });
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-view="members"],[data-view="dashboard"],[data-view="analytics"],[data-view="attendance"]');
    if (button) setTimeout(refresh, 250);
  });
})();
