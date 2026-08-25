(() => {
  if (window.__VCCF_ANALYTICS_REPLACEMENT_V3__) return;
  window.__VCCF_ANALYTICS_REPLACEMENT_V3__ = true;

  const roleName = r => String(r || '').trim().toLowerCase().replace(/_/g, ' ');
  let sb = null;
  let renderTimer = null;
  let rendering = false;
  let observer = null;

  const client = () => {
    if (sb) return sb;
    if (!window.supabase?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    sb = window.supabase.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return sb;
  };

  const manilaDate = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(value));

  const shortSunday = value => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric'
  }).format(new Date(`${value}T12:00:00+08:00`));

  function sundayList(count = 8) {
    const today = manilaDate(new Date());
    const d = new Date(`${today}T12:00:00+08:00`);
    d.setDate(d.getDate() - d.getDay());
    const out = [];
    for (let i = 0; i < count; i++) { out.push(manilaDate(d)); d.setDate(d.getDate() - 7); }
    return out.reverse();
  }

  async function profile() {
    const c = client();
    if (!c) return null;
    const { data: auth } = await c.auth.getUser();
    if (!auth?.user) return null;
    const { data } = await c.from('profiles').select('role,area_id,member_id').eq('user_id', auth.user.id).maybeSingle();
    return data ? { ...data, user_id: auth.user.id } : null;
  }

  async function loadData(p) {
    const c = client();
    if (!c) return null;
    const role = roleName(p?.role);
    let membersQ = c.from('members').select('id,display_name,area_id,created_at,status').order('display_name');
    if (role === 'area leader') membersQ = membersQ.eq('area_id', p.area_id);
    if (!['admin','area leader'].includes(role) && p?.member_id) membersQ = membersQ.eq('id', p.member_id);
    if (!['admin','area leader'].includes(role) && !p?.member_id) membersQ = membersQ.limit(0);

    const membersResult = await membersQ;
    if (membersResult.error) throw membersResult.error;
    const attendanceResult = await c.from('attendance').select('member_id,checked_in_at');
    if (attendanceResult.error) throw attendanceResult.error;

    let areas = [];
    try {
      const r = await c.from('areas').select('id,name,code').order('name');
      if (!r.error) areas = r.data || [];
    } catch (_) {}

    return { members: membersResult.data || [], attendance: attendanceResult.data || [], areas };
  }

  function buildModel(data) {
    const sundays = sundayList(8);
    const attendanceByMember = new Map();
    const counts = sundays.map(() => 0);
    for (const row of data.attendance) {
      const day = manilaDate(row.checked_in_at);
      const idx = sundays.indexOf(day);
      if (idx < 0) continue;
      const key = String(row.member_id);
      if (!attendanceByMember.has(key)) attendanceByMember.set(key, new Set());
      const set = attendanceByMember.get(key);
      if (!set.has(day)) { set.add(day); counts[idx] += 1; }
    }

    const latestSunday = sundays[sundays.length - 1];
    const members = data.members.map(m => {
      const days = attendanceByMember.get(String(m.id)) || new Set();
      const recent = sundays.slice(-4).some(d => days.has(d));
      const active = String(m.status || '').toLowerCase() === 'active' || (!m.status && recent);
      return { ...m, days, active };
    });

    const total = members.length;
    const active = members.filter(m => m.active).length;
    const inactive = Math.max(0, total - active);
    const avg = counts.reduce((a,b)=>a+b,0) / sundays.length;

    const buckets = new Map();
    for (const m of members) {
      const key = m.area_id == null ? '__unassigned__' : String(m.area_id);
      if (!buckets.has(key)) buckets.set(key, {key,total:0,checked:0});
      const b = buckets.get(key);
      b.total += 1;
      if (m.days.has(latestSunday)) b.checked += 1;
    }

    const areas = [...buckets.values()].map((b, i) => {
      const area = data.areas.find(a => String(a.id) === String(b.key));
      const label = b.key === '__unassigned__' ? 'Unassigned' : (area?.name || area?.code || `Area ${i+1}`);
      return {...b,label,pct:b.total ? Math.round((b.checked/b.total)*100) : 0};
    });

    return {sundays,counts,latestSunday,total,active,inactive,avg,areas};
  }

  function addStyles() {
    if (document.getElementById('vccfAnalyticsCleanStyles')) return;
    const style = document.createElement('style');
    style.id = 'vccfAnalyticsCleanStyles';
    style.textContent = `
      #analytics.vccf-clean{display:none}
      #analytics.vccf-clean.active{display:block}
      #analytics.vccf-clean .vccf-clean-wrap{display:grid;gap:16px}
      #analytics.vccf-clean .vccf-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
      #analytics.vccf-clean .vccf-kicker{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
      #analytics.vccf-clean .vccf-title{margin:0;font-size:1.1rem;letter-spacing:-.03em}
      #analytics.vccf-clean .vccf-sub{margin:4px 0 0;color:var(--muted);font-size:.8rem}
      #analytics.vccf-clean .vccf-range{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:12px;padding:10px 12px;font-weight:800;min-width:150px}
      #analytics.vccf-clean .vccf-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      #analytics.vccf-clean .vccf-stat{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px;position:relative;overflow:hidden}
      #analytics.vccf-clean .vccf-stat:before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:var(--brand-gradient)}
      #analytics.vccf-clean .vccf-label{font-size:.75rem;font-weight:800;color:var(--muted)}
      #analytics.vccf-clean .vccf-value{display:block;margin-top:8px;font-size:1.9rem;font-weight:900;letter-spacing:-.05em}
      #analytics.vccf-clean .vccf-note{display:block;margin-top:5px;font-size:.74rem;color:var(--muted)}
      #analytics.vccf-clean .vccf-panel{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 8px 28px rgba(16,24,40,.045)}
      #analytics.vccf-clean .vccf-panel h3{margin:0;font-size:1rem;letter-spacing:-.03em}
      #analytics.vccf-clean .vccf-panel p{margin:4px 0 0;color:var(--muted);font-size:.78rem}
      #analytics.vccf-clean .vccf-chart{margin-top:22px}
      #analytics.vccf-clean .vccf-plot{height:300px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:16px;align-items:end;position:relative;border-bottom:1px solid var(--line);padding:0 12px}
      #analytics.vccf-clean .vccf-grid{position:absolute;left:0;right:0;border-top:1px dashed var(--line);opacity:.65}
      #analytics.vccf-clean .vccf-column{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0}
      #analytics.vccf-clean .vccf-bar-value{font-size:.7rem;font-weight:900;margin-bottom:6px}
      #analytics.vccf-clean .vccf-bar{width:min(44px,72%);min-height:3px;border-radius:8px 8px 2px 2px;background:linear-gradient(180deg,var(--brand2),var(--brand));box-shadow:0 10px 22px rgba(109,69,232,.18)}
      #analytics.vccf-clean .vccf-labels{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:16px;padding:10px 12px 0}
      #analytics.vccf-clean .vccf-x{font-size:.66rem;color:var(--muted);text-align:center;white-space:nowrap}
      #analytics.vccf-clean .vccf-legend{display:flex;justify-content:flex-end;gap:7px;align-items:center;color:var(--muted);font-size:.72rem;margin-top:14px}
      #analytics.vccf-clean .vccf-dot{width:10px;height:10px;border-radius:3px;background:var(--brand)}
      #analytics.vccf-clean .vccf-areas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
      #analytics.vccf-clean .vccf-area{background:var(--bg);border:1px solid var(--line);border-radius:16px;padding:16px}
      #analytics.vccf-clean .vccf-area-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
      #analytics.vccf-clean .vccf-area-name{font-weight:900}
      #analytics.vccf-clean .vccf-area-pct{font-size:.78rem;font-weight:900}
      #analytics.vccf-clean .vccf-track{height:10px;background:var(--panel);border-radius:999px;overflow:hidden;margin-top:12px}
      #analytics.vccf-clean .vccf-fill{height:100%;background:var(--brand-gradient);border-radius:999px}
      #analytics.vccf-clean .vccf-area-note{margin-top:8px;font-size:.74rem;color:var(--muted)}
      @media(max-width:900px){#analytics.vccf-clean .vccf-stats{grid-template-columns:1fr 1fr}#analytics.vccf-clean .vccf-areas{grid-template-columns:1fr}}
      @media(max-width:600px){#analytics.vccf-clean .vccf-plot{height:240px;gap:8px;padding:0 4px}#analytics.vccf-clean .vccf-labels{gap:8px;padding-left:4px;padding-right:4px}.vccf-x{font-size:.58rem!important}}
    `;
    document.head.appendChild(style);
  }

  function render(section, model) {
    rendering = true;
    addStyles();
    section.className = 'view active vccf-clean';
    section.innerHTML = `
      <div class="vccf-clean-wrap">
        <div class="vccf-head">
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
          <div class="vccf-stat"><span class="vccf-label">Avg check-ins/week</span><strong class="vccf-value">${model.avg.toFixed(1)}</strong><span class="vccf-note">Across the last 8 Sundays</span></div>
        </div>
        <section class="vccf-panel">
          <h3>Sunday Attendance Overview</h3>
          <p>Attendance by Sunday · ${shortSunday(model.latestSunday)} is the latest</p>
          <div class="vccf-chart">
            <div class="vccf-plot">
              <span class="vccf-grid" style="top:0"></span><span class="vccf-grid" style="top:25%"></span><span class="vccf-grid" style="top:50%"></span><span class="vccf-grid" style="top:75%"></span>
              ${model.counts.map(v => {
                const max = Math.max(1, ...model.counts);
                const h = Math.max(3, Math.round((v/max)*245));
                return `<div class="vccf-column"><span class="vccf-bar-value">${v}</span><span class="vccf-bar" style="height:${h}px"></span></div>`;
              }).join('')}
            </div>
            <div class="vccf-labels">${model.sundays.map(d => `<span class="vccf-x">${shortSunday(d)}</span>`).join('')}</div>
            <div class="vccf-legend"><span class="vccf-dot"></span>Sunday attendance</div>
          </div>
        </section>
        <section class="vccf-panel">
          <h3>Area Performance</h3>
          <p>Check-in performance for the latest Sunday · ${shortSunday(model.latestSunday)}</p>
          <div class="vccf-areas">
            ${model.areas.length ? model.areas.map(a => `<div class="vccf-area"><div class="vccf-area-top"><span class="vccf-area-name">${a.label}</span><span class="vccf-area-pct">${a.pct}%</span></div><div class="vccf-track"><div class="vccf-fill" style="width:${Math.min(100,Math.max(0,a.pct))}%"></div></div><div class="vccf-area-note">${a.checked} of ${a.total} members checked in</div></div>`).join('') : '<div class="vccf-area"><div class="vccf-area-note">No area data available.</div></div>'}
          </div>
        </section>
      </div>
    `;
    rendering = false;
  }

  async function refreshAnalytics() {
    const section = document.getElementById('analytics');
    if (!section) return;
    const p = await profile();
    if (!p) return;
    const data = await loadData(p);
    if (!data) return;
    render(section, buildModel(data));
  }

  function schedule(delay = 200) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => refreshAnalytics().catch(e => console.warn('VCCF analytics replacement:', e)), delay);
  }

  function startObserver() {
    const section = document.getElementById('analytics');
    if (!section || observer) return;
    observer = new MutationObserver(() => { if (!rendering) schedule(100); });
    observer.observe(section, {childList:true,subtree:true});
  }

  function boot() {
    startObserver();
    schedule(300);
    setTimeout(() => schedule(100), 1000);
    setTimeout(() => schedule(100), 2500);
    document.addEventListener('click', e => { if (e.target.closest?.('[data-view="analytics"]')) schedule(160); });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
