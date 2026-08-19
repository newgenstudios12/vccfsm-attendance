(() => {
  if (window.__VCCF_MEMBER_CONTROLS_V3__) return;
  window.__VCCF_MEMBER_CONTROLS_V3__ = true;

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  let sortMode = 'name';
  let addressFilter = '';
  const $ = id => document.getElementById(id);

  function getMembersDb() {
    try {
      return (typeof db !== 'undefined' && Array.isArray(db.members)) ? db : null;
    } catch (_) {
      return null;
    }
  }

  function members() {
    const state = getMembersDb();
    if (!state) return [];
    try {
      if (typeof areaMembers === 'function') return areaMembers();
    } catch (_) {}
    return state.members;
  }

  function ensureControls() {
    const section = $('members');
    if (!section) return false;
    const toolbar = section.querySelector('.toolbar');
    if (!toolbar) return false;

    let box = $('vccfMemberControls');
    if (!box) {
      box = document.createElement('div');
      box.id = 'vccfMemberControls';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Member list controls');
      box.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px 0;';
      toolbar.insertAdjacentElement('afterend', box);
    }

    if (!$('vccfMemberCount')) {
      const count = document.createElement('span');
      count.id = 'vccfMemberCount';
      count.style.cssText = 'font-weight:800;color:var(--muted);padding:10px 2px;';
      box.appendChild(count);
    }

    if (!$('vccfSortBy')) {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      const label = document.createElement('span');
      label.textContent = 'Sort by:';
      const select = document.createElement('select');
      select.id = 'vccfSortBy';
      select.className = 'search';
      select.style.minWidth = '150px';
      select.setAttribute('aria-label', 'Sort members by');
      select.innerHTML = '<option value="name">Name</option><option value="address">Address</option>';
      select.value = sortMode;
      select.addEventListener('change', () => {
        sortMode = select.value;
        render();
      });
      wrap.append(label, select);
      box.appendChild(wrap);
    }

    if (!$('vccfFilterByAddress')) {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      const label = document.createElement('span');
      label.textContent = 'Filter by: Address';
      const select = document.createElement('select');
      select.id = 'vccfFilterByAddress';
      select.className = 'search';
      select.style.minWidth = '230px';
      select.setAttribute('aria-label', 'Filter members by address');
      select.addEventListener('change', () => {
        addressFilter = select.value;
        applyRowFilter();
        updateCount();
      });
      wrap.append(label, select);
      box.appendChild(wrap);
    }

    refreshAddressOptions();
    return true;
  }

  function refreshAddressOptions() {
    const select = $('vccfFilterByAddress');
    if (!select) return;
    const values = [...new Set(
      members()
        .map(m => String(m.address || '').trim())
        .filter(Boolean)
    )].sort(collator.compare);

    const current = addressFilter;
    const options = ['<option value="">All addresses</option>']
      .concat(values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`))
      .concat(['<option value="__blank__">No address</option>']);

    select.innerHTML = options.join('');
    select.value = values.includes(current) || current === '__blank__' ? current : '';
  }

  function escapeHtml(v) {
    return String(v).replace(/[&<>\"]/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[m]));
  }

  function sortRows() {
    const data = members();
    data.sort((a, b) => {
      if (sortMode === 'address') {
        return collator.compare(String(a.address || ''), String(b.address || '')) ||
          collator.compare(String(a.name || ''), String(b.name || ''));
      }
      return collator.compare(String(a.name || ''), String(b.name || ''));
    });
  }

  function applyRowFilter() {
    const tbody = $('memberRows');
    if (!tbody) return;
    [...tbody.rows].forEach(row => {
      const address = (row.cells[3]?.textContent || '').trim();
      const show = addressFilter === '__blank__' ? !address : (!addressFilter || address === addressFilter);
      row.style.display = show ? '' : 'none';
    });
  }

  function updateCount() {
    const state = getMembersDb();
    const all = state?.members || [];
    const visible = members();
    const shown = visible.filter(m => {
      const a = String(m.address || '').trim();
      return addressFilter === '__blank__' ? !a : (!addressFilter || a === addressFilter);
    }).length;
    const el = $('vccfMemberCount');
    if (el) el.textContent = `Total members: ${all.length} · Showing: ${shown}`;
  }

  function render() {
    sortRows();
    if (typeof renderMembers === 'function') renderMembers();
    refreshAddressOptions();
    applyRowFilter();
    updateCount();
  }

  function patchRenderer() {
    if (window.__VCCF_MEMBER_RENDER_PATCHED_V2__) return true;
    if (typeof renderMembers !== 'function') return false;
    const original = renderMembers;
    window.__VCCF_MEMBER_RENDER_PATCHED_V2__ = true;
    window.renderMembers = function (...args) {
      sortRows();
      const result = original.apply(this, args);
      refreshAddressOptions();
      applyRowFilter();
      updateCount();
      return result;
    };
    return true;
  }

  function installThemeFade() {
    if (document.getElementById('vccfThemeFadeStyles')) return;
    const style = document.createElement('style');
    style.id = 'vccfThemeFadeStyles';
    style.textContent = `
      html, body, .app, .sidebar, .main, .panel, .stat, .toolbar, .tablewrap, .login-card,
      input, select, textarea, button, .btn, .search, .modal-card, .topbar, .userchip {
        transition: background-color .24s ease, color .24s ease, border-color .24s ease,
                    box-shadow .24s ease, opacity .24s ease;
      }
      .logo { transition: opacity .18s ease; }
      body.vccf-theme-fading .logo { opacity: .1; }
      @media (prefers-reduced-motion: reduce) {
        html, body, .app, .sidebar, .main, .panel, .stat, .toolbar, .tablewrap, .login-card,
        input, select, textarea, button, .btn, .search, .modal-card, .topbar, .userchip, .logo {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    let lastTheme = document.documentElement.dataset.theme || 'light';
    const observer = new MutationObserver(() => {
      const nextTheme = document.documentElement.dataset.theme || 'light';
      if (nextTheme === lastTheme) return;
      lastTheme = nextTheme;
      document.body.classList.add('vccf-theme-fading');
      window.setTimeout(() => document.body.classList.remove('vccf-theme-fading'), 240);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function boot() {
    const ready = ensureControls();
    patchRenderer();
    installThemeFade();

    const search = $('memberSearch');
    if (search && !search.dataset.vccfControlsPatched) {
      search.dataset.vccfControlsPatched = '1';
      search.addEventListener('input', () => {
        window.setTimeout(() => {
          refreshAddressOptions();
          applyRowFilter();
          updateCount();
        }, 0);
      });
    }

    const area = $('areaFilter');
    if (area && !area.dataset.vccfControlsPatched) {
      area.dataset.vccfControlsPatched = '1';
      area.addEventListener('change', () => {
        refreshAddressOptions();
        applyRowFilter();
        updateCount();
      });
    }

    applyRowFilter();
    updateCount();
    return ready;
  }

  function start() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const ready = boot();
      const state = getMembersDb();
      if (ready && state && state.members.length > 0) {
        clearInterval(timer);
      } else if (attempts >= 40) {
        clearInterval(timer);
      }
    }, 300);
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
