(() => {
  if (window.__VCCF_ANALYTICS_REPLACEMENT_V4__) return;
  window.__VCCF_ANALYTICS_REPLACEMENT_V4__ = true;

  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  const manilaDate = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(value));
  const shortSunday = value => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric'
  }).format(new Date(`${value}T12:00:00+08:00`));

  let sb = null;
  let renderTimer = null;
  let rendering = false;
  let bodyObserver = null;

  function client() {
    if (sb) return sb;
    if (!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    sb = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return sb;
  }

  function sundays(count = 8) {
    const today = manilaDate(new Date());
    const d = new Date(`${today}T12:00:00+08:00`);
    d.setDate(d.getDate() - d.getDay());
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(manilaDate(d));
      d.setDate(d.getDate() - 7);
    }
    return out.reverse();
  }

  async function getProfile() {
    const c = client();
    if (!c) return null;
    const { data: auth } = await c.auth.getUser();
    if (!auth?.user) return null;
    const { data, error } = await c.from('profiles')
      .select('role,area_id,member_id')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return { ...data, user_id: auth.user.id };
  }

  async function getData(profile) {
    const c = client();
    if (!c) return null;
    const role = roleName(profile?.role);

    let memberQuery = c.from('members')
      .select('id,display_name,area_id,created_at,status')
      .order('display_name');

    if (role === 'area leader') memberQuery = memberQuery.eq('area_id', profile.area_id);
    if (!['admin', 'area leader'].includes(role)) {
      if (profile?.member_id) memberQuery = memberQuery.eq('id', profile.member_id);
      else memberQuery = memberQuery.limit(0);
    }

    const [membersResult, attendanceResult, areasResult] = await Promise.all([
      memberQuery,
      c.from('attendance').select('member_id,checked_in_at'),
      c.from('areas').select('id,name,code').order('name')
    ]);

    if (membersResult.error) throw membersResult.error;
    if (attendanceResult.error) throw attendanceResult.error;
    return {
      members: membersResult.data || [],
      attendance: attendanceResult.data || [],
      areas: areasResult.error ? [] : (areasResult.data || [])
    };
  }

  function buildModel(data) {
    const labels = sundays(8);
    const attendanceByMember = new Map();
    const counts = labels.map(() => 0);

    for (const row of data.attendance) {
      const day = manilaDate(row.checked_in_at);
      const index = labels.indexOf(day);
      if (index < 0) continue;
      const key = String(row.member_id);
      if (!attendanceByMember.has(key)) attendanceByMember.set(key, new Set());
      const set = attendanceByMember.get(key);
      if (!set.has(day)) {
        set.add(day);
        counts[index] += 1;
      }
    }

    const latestSunday = labels[labels.length - 1];
    const members = data.members.map(member => {
      const days = attendanceByMember.get(String(member.id)) || new Set();
      const recent = labels.slice(-4).some(day => days.has(day));
      const status = String(member.status || '').toLowerCase();
      return { ...member, days, active: status === 'active' || (!status && recent) };
    });

    const total = members.length;
    const active = members.filter(member => member.active).length;
    const inactive = Math.max(0, total - active);
    const avg = counts.reduce((sum, value) => sum + value, 0) / labels.length;

    const buckets = new Map();
    for (const member of members) {
      const key = member.area_id == null ? '__unassigned__' : String(member.area_id);
      if (!buckets.has(key)) buckets.set(key, { key, total: 0, checked: 0 });
      const bucket = buckets.get(key);
      bucket.total += 1;
      if (member.days.has(latestSunday)) bucket.checked += 1;
    }

    const areaRows = [...buckets.values()].map((bucket, index) => {
      const area = data.areas.find(item => String(item.id) === String(bucket.key));
      const name = bucket.key === '__unassigned__'
        ? 'Unassigned'
        : (area?.name || area?.code || `Area ${index + 1}`);
      return { ...bucket, name, pct: bucket.total ? Math.round((bucket.checked / bucket.total) * 100) : 0 };
    });

    return { labels, counts, latestSunday, total, active, inactive, avg, areaRows };
  }

  function installStyles() {
    if (document.getElementById('vccfAnalyticsReplacementStyles')) return;
    const style = document.createElement('style');
    style.id = 'vccfAnalyticsReplacementStyles';
    style.textContent = `
      #analytics.vccf-replacement { display:block !important; }
      #analytics.vccf-replacement > .vccf-root { display:grid; gap:18px; width:100%; }
      #analytics.vccf-replacement .vccf-top { display:flex; justify-content:space-between; align-items:flex-end; gap:18px; flex-wrap:wrap; }
      #analytics.vccf-replacement .vccf-kicker { margin:0 0 4px; color:var(--muted); font-size:.74rem; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
      #analytics.vccf-replacement .vccf-title { margin:0; font-size:1.35rem; line-height:1.2; letter-spacing:-.04em; }
      #analytics.vccf-replacement .vccf-sub { margin:5px 0 0; color:var(--muted); font-size:.82rem; }
      #analytics.vccf-replacement .vccf-range { border:1px solid var(--line); background:var(--panel); color:var(--text); border-radius:12px; padding:11px 13px; font-weight:800; min-width:155px; }
      #analytics.vccf-replacement .vccf-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
      #analytics.vccf-replacement .vccf-stat { position:relative; overflow:hidden; background:var(--panel); border:1px solid var(--line); border-radius:18px; padding:18px; min-height:118px; }
      #analytics.vccf-replacement .vccf-stat:before { content:""; position:absolute; left:0; top:0; right:0; height:4px; background:var(--brand-gradient); }
      #analytics.vccf-replacement .vccf-label { display:block; color:var(--muted); font-size:.75rem; font-weight:800; }
      #analytics.vccf-replacement .vccf-value { display:block; margin-top:8px; font-size:2rem; line-height:1; font-weight:900; letter-spacing:-.05em; }
      #analytics.vccf-replacement .vccf-note { display:block; margin-top:7px; color:var(--muted); font-size:.74rem; }
      #analytics.vccf-replacement .vccf-panel { background:var(--panel); border:1px solid var(--line); border-radius:20px; padding:20px; box-shadow:0 8px 28px rgba(0,0,0,.08); }
      #analytics.vccf-replacement .vccf-panel h3 { margin:0; font-size:1.02rem; letter-spacing:-.03em; }
      #analytics.vccf-replacement .vccf-panel p { margin:5px 0 0; color:var(--muted); font-size:.78rem; }
      #analytics.vccf-replacement .vccf-chart { margin-top:24px; }
      #analytics.vccf-replacement .vccf-plot { position:relative; height:330px; display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:16px; align-items:end; padding:0 14px; border-bottom:1px solid var(--line); }
      #analytics.vccf-replacement .vccf-gridline { position:absolute; left:0; right:0; border-top:1px dashed var(--line); opacity:.55; }
      #analytics.vccf-replacement .vccf-column { height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; min-width:0; }
      #analytics.vccf-replacement .vccf-bar-value { margin-bottom:7px; font-size:.72rem; font-weight:900; }
      #analytics.vccf-replacement .vccf-bar { width:min(48px,72%); min-height:3px; border-radius:8px 8px 2px 2px; background:var(--brand-gradient); box-shadow:0 10px 24px rgba(215,25,32,.16); }
      #analytics.vccf-replacement .vccf-labels { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:16px; padding:11px 14px 0; }
      #analytics.vccf-replacement .vccf-x { text-align:center; white-space:nowrap; color:var(--muted); font-size:.67rem; }
      #analytics.vccf-replacement .vccf-legend { display:flex; justify-content:flex-end; align-items:center; gap:7px; margin-top:14px; color:var(--muted); font-size:.72rem; }
      #analytics.vccf-replacement .vccf-dot { width:10px; height:10px; border-radius:3px; background:var(--brand-gradient); }
      #analytics.vccf-replacement .vccf-areas { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:18px; }
      #analytics.vccf-replacement .vccf-area { background:var(--bg); border:1px solid var(--line); border-radius:16px; padding:16px; }
      #analytics.vccf-replacement .vccf-area-top { display:flex; justify-content:space-between; align-items:center; gap:12px; }
      #analytics.vccf-replacement .vccf-area-name { font-weight:900; }
      #analytics.vccf-replacement .vccf-area-pct { font-weight:900; }
      #analytics.vccf-replacement .vccf-track { height:10px; margin-top:12px; background:var(--panel); border-radius:999px; overflow:hidden; }
      #analytics.vccf-replacement .vccf-fill { height:100%; background:var(--brand-gradient); border-radius:999px; }
      #analytics.vccf-replacement .vccf-area-note { margin-top:8px; color:var(--muted); font-size:.74rem; }
      @media(max-width:900px){#analytics.vccf-replacement .vccf-stats{grid-template-columns:1fr 1fr}#analytics.vccf-replacement .vccf-areas{grid-template-columns:1fr}}
      @media(max-width:600px){#analytics.vccf-replacement .vccf-plot{height:250px;gap:7px;padding:0 4px}#analytics.vccf-replacement .vccf-labels{gap:7px;padding-left:4px;padding-right:4px}#analytics.vccf-replacement .vccf-x{font-size:.57rem}}
    `;
    document.head.appendChild(style);
  }

  function render(section, model) {
    rendering = true;
    installStyles();
    section.className = 'view active vccf-replacement';
    section.dataset.vccfAnalyticsReady = '1';
    section.innerHTML = `
      <div id="vccfAnalyticsRoot" class="vccf-root">
        <div class="vccf-top">
          <div>
            <div class="vccf-kicker">Leadership analytics</div>
            <h2 class="vccf-title">Sunday Attendance Overview</h2>
            <p class="vccf-sub">Sunday attendance only · latest 8 Sundays</p>
          </div>
          <select class="vccf-range" aria-label="Analytics range"><option>Last 8 Sundays</option></select>
        </div>
        <div class="vccf-stats">
          <div class="vccf-stat"><span class="vccf-label">Total members</span><strong class="vccf-value">${model.total}</strong><span class="vccf-note">Members in scope</span></div>
          <div class="vccf-stat"><span class="vccf-label">Active</span><strong class="vccf-value">${model.active}</strong><span class="vccf-note">Attendance in the last 4 Sundays</span></div>
          <div class="vccf-stat"><span class="vccf-label">Inactive</span><strong class="vccf-value">${model.inactive}</strong><span class="vccf-note">No attendance in the last 4 Sundays</span></div>
          <div class="vccf-stat"><span class="vccf-label">Avg check-ins / week</span><strong class="vccf-value">${model.avg.toFixed(1)}</strong><span class="vccf-note">Across the last 8 Sundays</span></div>
        </div>
        <section class="vccf-panel">
          <h3>Sunday Attendance Overview</h3>
          <p>Attendance by Sunday · ${shortSunday(model.latestSunday)} is the latest</p>
          <div class="vccf-chart">
            <div class="vccf-plot">
              <span class="vccf-gridline" style="top:0"></span><span class="vccf-gridline" style="top:25%"></span><span class="vccf-gridline" style="top:50%"></span><span class="vccf-gridline" style="top:75%"></span>
              ${model.counts.map(value => {
                const max = Math.max(1, ...model.counts);
                const height = Math.max(3, Math.round((value / max) * 265));
                return `<div class="vccf-column"><span class="vccf-bar-value">${value}</span><span class="vccf-bar" style="height:${height}px"></span></div>`;
              }).join('')}
            </div>
            <div class="vccf-labels">${model.labels.map(label => `<span class="vccf-x">${shortSunday(label)}</span>`).join('')}</div>
            <div class="vccf-legend"><span class="vccf-dot"></span>Sunday attendance</div>
          </div>
        </section>
        <section class="vccf-panel">
          <h3>Area Performance</h3>
          <p>Check-in performance for the latest Sunday · ${shortSunday(model.latestSunday)}</p>
          <div class="vccf-areas">
            ${model.areaRows.length ? model.areaRows.map(area => `<div class="vccf-area"><div class="vccf-area-top"><span class="vccf-area-name">${area.name}</span><span class="vccf-area-pct">${area.pct}%</span></div><div class="vccf-track"><div class="vccf-fill" style="width:${Math.max(0, Math.min(100, area.pct))}%"></div></div><div class="vccf-area-note">${area.checked} of ${area.total} members checked in</div></div>`).join('') : '<div class="vccf-area"><div class="vccf-area-note">No area data available.</div></div>'}
          </div>
        </section>
      </div>
    `;
    rendering = false;
  }

  async function refreshAnalytics() {
    const section = document.getElementById('analytics');
    if (!section) return;
    const profile = await getProfile();
    if (!profile) return;
    const data = await getData(profile);
    if (!data) return;
    render(section, buildModel(data));
  }

  function shouldClaimAnalytics() {
    const section = document.getElementById('analytics');
    if (!section) return false;
    if (!section.classList.contains('active')) return false;
    if (!section.querySelector('#vccfAnalyticsRoot')) return true;
    const root = section.querySelector('#vccfAnalyticsRoot');
    return root.parentElement !== section;
  }

  function schedule(delay = 120) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if (shouldClaimAnalytics()) refreshAnalytics().catch(error => console.warn('VCCF analytics replacement:', error));
    }, delay);
  }

  function boot() {
    installStyles();
    schedule(0);
    setTimeout(() => { if (shouldClaimAnalytics()) refreshAnalytics().catch(() => {}); }, 800);
    setTimeout(() => { if (shouldClaimAnalytics()) refreshAnalytics().catch(() => {}); }, 2200);

    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-view="analytics"]');
      if (button) schedule(0);
    });

    if (!bodyObserver && document.body) {
      bodyObserver = new MutationObserver(() => {
        if (rendering) return;
        if (shouldClaimAnalytics()) schedule(80);
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
