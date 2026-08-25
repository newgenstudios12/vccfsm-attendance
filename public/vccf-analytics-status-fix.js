(() => {
  if (window.__VCCF_ANALYTICS_REPLACEMENT_V5__) return;
  window.__VCCF_ANALYTICS_REPLACEMENT_V5__ = true;

  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  const manilaDate = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(value));
  const shortSunday = value => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric'
  }).format(new Date(`${value}T12:00:00+08:00`));

  let sb = null;
  let observer = null;
  let refreshTimer = null;
  let requestSerial = 0;

  function client() {
    if (sb) return sb;
    if (!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    sb = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return sb;
  }

  function sundayList(count = 8) {
    const today = manilaDate(new Date());
    const d = new Date(`${today}T12:00:00+08:00`);
    d.setDate(d.getDate() - d.getDay());
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(manilaDate(d));
      d.setDate(d.getDate() - 7);
    }
    return out.reverse();
  }

  function installStyles() {
    if (document.getElementById('vccfAnalyticsReplacementV5Styles')) return;
    const style = document.createElement('style');
    style.id = 'vccfAnalyticsReplacementV5Styles';
    style.textContent = `
      #analytics.vccf-replacement-v5{display:block!important;width:100%;}
      #analytics.vccf-replacement-v5>.vccf-v5-root{display:grid;gap:16px;width:100%;}
      #analytics.vccf-replacement-v5 .vccf-v5-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
      #analytics.vccf-replacement-v5 .vccf-v5-kicker{margin:0 0 4px;color:var(--muted);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;}
      #analytics.vccf-replacement-v5 .vccf-v5-title{margin:0;font-size:1.22rem;letter-spacing:-.04em;}
      #analytics.vccf-replacement-v5 .vccf-v5-sub{margin:4px 0 0;color:var(--muted);font-size:.78rem;}
      #analytics.vccf-replacement-v5 .vccf-v5-range{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:12px;padding:10px 12px;font-weight:800;min-width:150px;}
      #analytics.vccf-replacement-v5 .vccf-v5-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
      #analytics.vccf-replacement-v5 .vccf-v5-stat{position:relative;overflow:hidden;min-height:112px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;}
      #analytics.vccf-replacement-v5 .vccf-v5-stat:before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:var(--brand-gradient);}
      #analytics.vccf-replacement-v5 .vccf-v5-label{display:block;color:var(--muted);font-size:.75rem;font-weight:800;}
      #analytics.vccf-replacement-v5 .vccf-v5-value{display:block;margin-top:8px;font-size:2rem;line-height:1;font-weight:900;letter-spacing:-.05em;}
      #analytics.vccf-replacement-v5 .vccf-v5-note{display:block;margin-top:6px;color:var(--muted);font-size:.72rem;}
      #analytics.vccf-replacement-v5 .vccf-v5-panel{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:20px;}
      #analytics.vccf-replacement-v5 .vccf-v5-panel h3{margin:0;font-size:1rem;letter-spacing:-.03em;}
      #analytics.vccf-replacement-v5 .vccf-v5-panel p{margin:4px 0 0;color:var(--muted);font-size:.76rem;}
      #analytics.vccf-replacement-v5 .vccf-v5-chart{margin-top:22px;}
      #analytics.vccf-replacement-v5 .vccf-v5-plot{position:relative;height:320px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:14px;align-items:end;padding:0 12px;border-bottom:1px solid var(--line);}
      #analytics.vccf-replacement-v5 .vccf-v5-grid{position:absolute;left:0;right:0;border-top:1px dashed var(--line);opacity:.55;}
      #analytics.vccf-replacement-v5 .vccf-v5-column{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0;}
      #analytics.vccf-replacement-v5 .vccf-v5-bar-value{margin-bottom:6px;font-size:.72rem;font-weight:900;}
      #analytics.vccf-replacement-v5 .vccf-v5-bar{width:min(48px,70%);min-height:3px;border-radius:8px 8px 2px 2px;background:var(--brand-gradient);}
      #analytics.vccf-replacement-v5 .vccf-v5-labels{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:14px;padding:10px 12px 0;}
      #analytics.vccf-replacement-v5 .vccf-v5-x{text-align:center;white-space:nowrap;color:var(--muted);font-size:.66rem;}
      #analytics.vccf-replacement-v5 .vccf-v5-legend{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:13px;color:var(--muted);font-size:.7rem;}
      #analytics.vccf-replacement-v5 .vccf-v5-dot{width:10px;height:10px;border-radius:3px;background:var(--brand-gradient);}
      #analytics.vccf-replacement-v5 .vccf-v5-areas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;}
      #analytics.vccf-replacement-v5 .vccf-v5-area{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:16px;}
      #analytics.vccf-replacement-v5 .vccf-v5-area-top{display:flex;justify-content:space-between;align-items:center;gap:10px;}
      #analytics.vccf-replacement-v5 .vccf-v5-area-name{font-weight:900;}
      #analytics.vccf-replacement-v5 .vccf-v5-area-pct{font-weight:900;}
      #analytics.vccf-replacement-v5 .vccf-v5-track{height:10px;margin-top:12px;background:var(--panel);border-radius:999px;overflow:hidden;}
      #analytics.vccf-replacement-v5 .vccf-v5-fill{height:100%;background:var(--brand-gradient);border-radius:999px;}
      #analytics.vccf-replacement-v5 .vccf-v5-area-note{margin-top:8px;color:var(--muted);font-size:.72rem;}
      @media(max-width:900px){#analytics.vccf-replacement-v5 .vccf-v5-stats{grid-template-columns:1fr 1fr}#analytics.vccf-replacement-v5 .vccf-v5-areas{grid-template-columns:1fr}}
      @media(max-width:600px){#analytics.vccf-replacement-v5 .vccf-v5-plot{height:250px;gap:7px;padding:0 4px}#analytics.vccf-replacement-v5 .vccf-v5-labels{gap:7px;padding-left:4px;padding-right:4px}#analytics.vccf-replacement-v5 .vccf-v5-x{font-size:.56rem}}
    `;
    document.head.appendChild(style);
  }

  function emptyModel() {
    const labels = sundayList(8);
    return { labels, counts: labels.map(() => 0), latestSunday: labels[labels.length - 1], total: 0, active: 0, inactive: 0, avg: 0, areas: [] };
  }

  function render(section, model, loading = false) {
    installStyles();
    section.className = 'view active vccf-replacement-v5';
    section.dataset.vccfAnalyticsOwner = 'v5';
    section.innerHTML = `
      <div id="vccfAnalyticsRootV5" class="vccf-v5-root">
        <div class="vccf-v5-head">
          <div>
            <div class="vccf-v5-kicker">Leadership analytics</div>
            <h2 class="vccf-v5-title">Sunday Attendance Overview</h2>
            <p class="vccf-v5-sub">Sunday attendance only · latest 8 Sundays${loading ? ' · loading data…' : ''}</p>
          </div>
          <select class="vccf-v5-range" aria-label="Analytics range"><option>Last 8 Sundays</option></select>
        </div>
        <div class="vccf-v5-stats">
          <div class="vccf-v5-stat"><span class="vccf-v5-label">Total members</span><strong class="vccf-v5-value">${model.total || (loading ? '—' : 0)}</strong><span class="vccf-v5-note">Members in scope</span></div>
          <div class="vccf-v5-stat"><span class="vccf-v5-label">Active</span><strong class="vccf-v5-value">${model.active || (loading ? '—' : 0)}</strong><span class="vccf-v5-note">Attendance in the last 4 Sundays</span></div>
          <div class="vccf-v5-stat"><span class="vccf-v5-label">Inactive</span><strong class="vccf-v5-value">${model.inactive || (loading ? '—' : 0)}</strong><span class="vccf-v5-note">No attendance in the last 4 Sundays</span></div>
          <div class="vccf-v5-stat"><span class="vccf-v5-label">Avg check-ins / week</span><strong class="vccf-v5-value">${loading ? '—' : model.avg.toFixed(1)}</strong><span class="vccf-v5-note">Across the last 8 Sundays</span></div>
        </div>
        <section class="vccf-v5-panel">
          <h3>Sunday Attendance Overview</h3>
          <p>Attendance by Sunday · ${shortSunday(model.latestSunday)} is the latest</p>
          <div class="vccf-v5-chart">
            <div class="vccf-v5-plot">
              <span class="vccf-v5-grid" style="top:0"></span><span class="vccf-v5-grid" style="top:25%"></span><span class="vccf-v5-grid" style="top:50%"></span><span class="vccf-v5-grid" style="top:75%"></span>
              ${model.counts.map(value => {
                const max = Math.max(1, ...model.counts);
                const height = Math.max(3, Math.round((value / max) * 255));
                return `<div class="vccf-v5-column"><span class="vccf-v5-bar-value">${loading ? '' : value}</span><span class="vccf-v5-bar" style="height:${height}px"></span></div>`;
              }).join('')}
            </div>
            <div class="vccf-v5-labels">${model.labels.map(label => `<span class="vccf-v5-x">${shortSunday(label)}</span>`).join('')}</div>
            <div class="vccf-v5-legend"><span class="vccf-v5-dot"></span>Sunday attendance</div>
          </div>
        </section>
        <section class="vccf-v5-panel">
          <h3>Area Performance</h3>
          <p>Check-in performance for the latest Sunday · ${shortSunday(model.latestSunday)}</p>
          <div class="vccf-v5-areas">
            ${model.areas.length ? model.areas.map(area => `<div class="vccf-v5-area"><div class="vccf-v5-area-top"><span class="vccf-v5-area-name">${area.name}</span><span class="vccf-v5-area-pct">${area.pct}%</span></div><div class="vccf-v5-track"><div class="vccf-v5-fill" style="width:${Math.max(0, Math.min(100, area.pct))}%"></div></div><div class="vccf-v5-area-note">${area.checked} of ${area.total} members checked in</div></div>`).join('') : `<div class="vccf-v5-area"><div class="vccf-v5-area-note">${loading ? 'Loading area performance…' : 'No area data available.'}</div></div>`}
          </div>
        </section>
      </div>
    `;
  }

  function claimImmediately(section) {
    if (!section || !section.classList.contains('active')) return false;
    const root = section.querySelector('#vccfAnalyticsRootV5');
    if (section.dataset.vccfAnalyticsOwner === 'v5' && root) return true;
    render(section, emptyModel(), true);
    return true;
  }

  async function loadModel() {
    const c = client();
    if (!c) return null;
    const { data: auth, error: authError } = await c.auth.getUser();
    if (authError || !auth?.user) return null;
    const { data: profile, error: profileError } = await c.from('profiles')
      .select('role,area_id,member_id').eq('user_id', auth.user.id).maybeSingle();
    if (profileError || !profile) return null;

    const role = roleName(profile.role);
    let memberQuery = c.from('members').select('id,display_name,area_id,status').order('display_name');
    if (role === 'area leader') memberQuery = memberQuery.eq('area_id', profile.area_id);
    if (!['admin', 'area leader'].includes(role)) {
      // Keep member analytics visible without allowing a missing member_id to expose everyone.
      if (profile.member_id) memberQuery = memberQuery.eq('id', profile.member_id);
      else memberQuery = memberQuery.limit(0);
    }

    const [membersResult, attendanceResult, areasResult] = await Promise.all([
      memberQuery,
      c.from('attendance').select('member_id,checked_in_at'),
      c.from('areas').select('id,name,code').order('name')
    ]);
    if (membersResult.error || attendanceResult.error) return null;

    const labels = sundayList(8);
    const counts = labels.map(() => 0);
    const byMember = new Map();
    for (const row of attendanceResult.data || []) {
      const day = manilaDate(row.checked_in_at);
      const index = labels.indexOf(day);
      if (index < 0) continue;
      const key = String(row.member_id);
      if (!byMember.has(key)) byMember.set(key, new Set());
      const set = byMember.get(key);
      if (!set.has(day)) { set.add(day); counts[index] += 1; }
    }

    const members = (membersResult.data || []).map(member => {
      const days = byMember.get(String(member.id)) || new Set();
      const recent = labels.slice(-4).some(day => days.has(day));
      const status = String(member.status || '').toLowerCase();
      return { ...member, days, active: status === 'active' || (!status && recent) };
    });

    const total = members.length;
    const active = members.filter(m => m.active).length;
    const inactive = Math.max(0, total - active);
    const avg = counts.reduce((sum, value) => sum + value, 0) / labels.length;
    const latestSunday = labels[labels.length - 1];
    const buckets = new Map();
    for (const member of members) {
      const key = member.area_id == null ? '__unassigned__' : String(member.area_id);
      if (!buckets.has(key)) buckets.set(key, { key, total: 0, checked: 0 });
      const bucket = buckets.get(key);
      bucket.total += 1;
      if (member.days.has(latestSunday)) bucket.checked += 1;
    }
    const areas = [...buckets.values()].map((bucket, index) => {
      const area = (areasResult.data || []).find(item => String(item.id) === String(bucket.key));
      const name = bucket.key === '__unassigned__' ? 'Unassigned' : (area?.name || area?.code || `Area ${index + 1}`);
      return { ...bucket, name, pct: bucket.total ? Math.round((bucket.checked / bucket.total) * 100) : 0 };
    });

    return { labels, counts, latestSunday, total, active, inactive, avg, areas };
  }

  async function hydrate(section) {
    const serial = ++requestSerial;
    try {
      const model = await loadModel();
      if (serial !== requestSerial || !document.body.contains(section) || !section.classList.contains('active')) return;
      if (model) render(section, model, false);
    } catch (error) {
      console.warn('VCCF Analytics V5:', error);
    }
  }

  function ensureAnalytics() {
    const section = document.getElementById('analytics');
    if (!section) return;
    if (!section.classList.contains('active')) return;
    const claimed = claimImmediately(section);
    if (claimed) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => hydrate(section), 80);
    }
  }

  function boot() {
    installStyles();
    ensureAnalytics();
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-view="analytics"]')) {
        requestSerial += 1;
        setTimeout(ensureAnalytics, 0);
        setTimeout(ensureAnalytics, 80);
      }
    });
    if (!observer && document.body) {
      observer = new MutationObserver(() => {
        const section = document.getElementById('analytics');
        if (section?.classList.contains('active') && !section.querySelector('#vccfAnalyticsRootV5')) {
          ensureAnalytics();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    setTimeout(ensureAnalytics, 400);
    setTimeout(ensureAnalytics, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
