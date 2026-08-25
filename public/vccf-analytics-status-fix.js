(() => {
  if (window.__VCCF_ANALYTICS_STATUS_FIX_V2__) return;
  window.__VCCF_ANALYTICS_STATUS_FIX_V2__ = true;

  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  let sb = null;

  function client() {
    if (sb) return sb;
    if (!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    sb = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return sb;
  }

  function manilaDate(value) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(value));
  }

  function recentSundays() {
    const today = manilaDate(new Date());
    const d = new Date(`${today}T12:00:00+08:00`);
    d.setDate(d.getDate() - d.getDay());
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push(manilaDate(d));
      d.setDate(d.getDate() - 7);
    }
    return out;
  }

  function findAnalyticsView() {
    return document.getElementById('analytics')
      || document.querySelector('.view[data-view="analytics"]')
      || [...document.querySelectorAll('.view')].find(v => /leadership analytics|attendance overview|attendance activity/i.test(v.textContent || ''))
      || null;
  }

  function graph() { return document.getElementById('vccfSundayAnalytics'); }

  function setTextOnce(node, text) {
    if (!node || !text) return;
    node.textContent = text;
  }

  function removeLegacyPanels(analytics) {
    if (!analytics) return;
    const candidates = [...analytics.querySelectorAll('.panel, [data-analytics], section, article')];
    for (const node of candidates) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (/heat\s*analytics|attendance\s*heatmap|heatmap|^Attendance activity\b|^Daily check-?ins over the selected range/i.test(text)) {
        if (node.id !== 'vccfSundayAnalytics') node.remove();
      }
    }

    // Remove an old duplicate Attendance Overview, but never remove the new Sunday graph.
    for (const node of [...analytics.querySelectorAll('.panel, [data-attendance-overview]')]) {
      if (node.id === 'vccfSundayAnalytics') continue;
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^Attendance Overview\b/i.test(text) || /^Sunday Attendance Overview\b/i.test(text)) node.remove();
    }
  }

  function moveIntoAnalytics(node, analytics) {
    if (!node || !analytics) return;
    if (node.parentElement !== analytics) analytics.appendChild(node);
  }

  function styleGraph(g) {
    if (!g) return;
    g.className = 'panel vccf-sunday-overview-panel';
    Object.assign(g.style, {
      position: 'static',
      inset: 'auto',
      float: 'none',
      transform: 'none',
      width: '100%',
      maxWidth: '100%',
      minHeight: '390px',
      margin: '18px 0 0',
      padding: '20px',
      clear: 'both',
      boxSizing: 'border-box',
      overflow: 'hidden'
    });
    g.dataset.analyticsOwner = 'main-analytics';
    g.querySelectorAll('canvas,svg').forEach(el => {
      el.style.width = '100%';
      el.style.maxWidth = '100%';
    });

    const directChildren = [...g.children];
    const chartLike = directChildren.find(el => {
      const count = el.children?.length || 0;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return count >= 6 || /Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun/.test(txt);
    });
    if (chartLike) {
      chartLike.style.width = '100%';
      chartLike.style.maxWidth = '100%';
      chartLike.style.minHeight = '275px';
      chartLike.style.boxSizing = 'border-box';
    }

    const descendants = [...g.querySelectorAll('div')];
    let best = null;
    for (const el of descendants) {
      const n = el.children?.length || 0;
      if (n >= 6 && n <= 12 && (!best || n > best.children.length)) best = el;
    }
    if (best) {
      best.style.width = '100%';
      best.style.maxWidth = '100%';
      best.style.minHeight = '250px';
      best.style.boxSizing = 'border-box';
      best.style.display = 'grid';
      best.style.gridTemplateColumns = `repeat(${Math.min(best.children.length, 12)}, minmax(0,1fr))`;
      best.style.gap = '18px';
      best.style.alignItems = 'end';
      best.style.justifyItems = 'center';
    }
  }

  function moveAreaPerformance(analytics, g) {
    if (!analytics || !g) return;
    const panels = [...analytics.querySelectorAll('.panel')];
    const area = panels.find(p => /area performance|check-?in performance by area/i.test((p.textContent || '').replace(/\s+/g, ' ').trim()));
    if (!area) return;
    moveIntoAnalytics(area, analytics);
    area.style.width = '100%';
    area.style.maxWidth = '100%';
    area.style.margin = '18px 0 0';
    area.classList.add('vccf-area-performance-panel');

    const cards = [...area.querySelectorAll('.panel, .bar, [data-area], div')].filter(el => /Area \d+/i.test((el.textContent || '').trim()));
    cards.forEach(card => {
      if (card.classList.contains('bar')) return;
      card.style.minHeight = '88px';
    });

    const parent = g.parentElement;
    if (parent === analytics) analytics.insertBefore(g, area), analytics.insertBefore(area, area.nextSibling);
  }

  function positionOverview(analytics) {
    const g = graph();
    if (!analytics || !g) return;
    moveIntoAnalytics(g, analytics);

    const stats = analytics.querySelector('.stats');
    const area = [...analytics.querySelectorAll('.panel')].find(p => /area performance|check-?in performance by area/i.test((p.textContent || '').replace(/\s+/g, ' ').trim()));

    if (stats) {
      analytics.insertBefore(g, stats.nextElementSibling);
    } else if (area) {
      analytics.insertBefore(g, area);
    }
    moveAreaPerformance(analytics, g);
    styleGraph(g);
  }

  function normalizeControls(analytics) {
    if (!analytics) return;
    analytics.querySelectorAll('select option').forEach(opt => {
      opt.textContent = opt.textContent.replace(/Last\s+8\s+weeks?/i, 'Last 8 Sundays');
    });
    analytics.querySelectorAll('select').forEach(select => {
      if (/Last|week|range/i.test(select.textContent || '')) {
        select.title = 'Sunday attendance range';
      }
    });
  }

  function clean() {
    const analytics = findAnalyticsView();
    if (!analytics) return;
    removeLegacyPanels(analytics);
    positionOverview(analytics);
    normalizeControls(analytics);
  }

  async function getData() {
    const c = client();
    if (!c) return null;
    const { data: auth, error: authError } = await c.auth.getUser();
    if (authError || !auth?.user) return null;
    const { data: profile, error: profileError } = await c.from('profiles')
      .select('user_id,role,area_id').eq('user_id', auth.user.id).maybeSingle();
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

  async function refresh() {
    try {
      clean();
      const data = await getData();
      if (!data) return;
      const rows = calculate(data.members, data.attendance);
      const inactive = rows.filter(row => row.effectiveStatus === 'inactive').length;
      const active = rows.length - inactive;
      writeStats(rows.length, active, inactive);
      clean();
    } catch (error) {
      console.warn('VCCF analytics status fix:', error);
    }
  }

  window.vccfRefreshMemberAnalyticsStatus = refresh;

  let observerTimer = null;
  const queueClean = () => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(clean, 60);
  };

  function schedule() {
    refresh();
    setTimeout(refresh, 700);
    setTimeout(refresh, 1600);
    setTimeout(refresh, 3200);
  }

  document.addEventListener('DOMContentLoaded', () => {
    schedule();
    new MutationObserver(queueClean).observe(document.body, { childList: true, subtree: true });
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-view="members"],[data-view="dashboard"],[data-view="analytics"],[data-view="attendance"]');
    if (button) setTimeout(refresh, 200);
  });
})();
