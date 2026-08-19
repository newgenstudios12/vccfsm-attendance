(() => {
  if (window.__VCCF_UI_ENHANCEMENTS_V2__) return;
  window.__VCCF_UI_ENHANCEMENTS_V2__ = true;

  const $ = id => document.getElementById(id);
  const validTheme = t => t === 'dark' || t === 'light';
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

  function applyLogoTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('.logo').forEach(img => {
      const src = img.dataset[dark ? 'dark' : 'light'];
      if (src) img.src = src;
    });
    document.querySelectorAll('img[src*="vccf-logo-black.png"]').forEach(img => {
      if (img.classList.contains('logo')) return;
      const src = dark ? 'vccf-logo-white.png' : 'vccf-logo-black.png';
      img.src = src;
    });
  }

  function currentTheme() {
    return validTheme(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : 'light';
  }

  async function persistTheme(theme) {
    try {
      localStorage.setItem('vccf-theme', theme);
      const c = window.supabase?.createClient?.(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
      if (!c) return;
      const { data: { user } } = await c.auth.getUser();
      if (user) await c.rpc('set_my_theme_preference', { p_theme: theme });
    } catch (e) {
      console.warn('VCCF theme preference save:', e);
    }
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    applyLogoTheme();
    persistTheme(next);
    const toggle = $('themeToggle');
    if (toggle) toggle.checked = next === 'dark';
  }

  function addThemeButton(container, className) {
    if (!container || container.querySelector('.vccf-theme-button')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn secondary vccf-theme-button ${className || ''}`;
    btn.style.cssText = 'white-space:nowrap;display:inline-flex;align-items:center;gap:7px;';
    btn.addEventListener('click', toggleTheme);
    container.appendChild(btn);
    updateThemeButton(btn);
  }

  function updateThemeButton(btn) {
    const dark = currentTheme() === 'dark';
    btn.innerHTML = dark ? '☀️ Light mode' : '🌙 Dark mode';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function setupThemeButtons() {
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      let holder = loginCard.querySelector('.vccf-login-theme-holder');
      if (!holder) {
        holder = document.createElement('div');
        holder.className = 'vccf-login-theme-holder';
        holder.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px;';
        loginCard.insertBefore(holder, loginCard.firstChild);
      }
      addThemeButton(holder, 'vccf-login-theme');
    }

    const topbar = document.querySelector('.topbar');
    if (topbar) {
      let actions = topbar.querySelector('.vccf-topbar-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'vccf-topbar-actions';
        actions.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const userchip = topbar.querySelector('.userchip');
        if (userchip) topbar.insertBefore(actions, userchip);
        else topbar.appendChild(actions);
      }
      addThemeButton(actions, 'vccf-app-theme');
    }

    document.querySelectorAll('.vccf-theme-button').forEach(updateThemeButton);
  }

  let sortMode = 'name';
  let addressFilter = '';

  function memberPool() {
    if (typeof areaMembers !== 'function' || !Array.isArray(window.db?.members)) return [];
    return areaMembers();
  }

  function visibleMembers() {
    const q = ($('memberSearch')?.value || '').toLowerCase();
    const area = $('areaFilter')?.value || '';
    return memberPool().filter(m =>
      (String(m.name || '').toLowerCase().includes(q) || String(m.address || '').toLowerCase().includes(q)) &&
      (!area || m.area === area) &&
      (!addressFilter || String(m.address || '') === addressFilter)
    );
  }

  function sortMembersInDb() {
    if (!Array.isArray(window.db?.members)) return;
    window.db.members.sort((a, b) => {
      if (sortMode === 'address') {
        return collator.compare(String(a.address || ''), String(b.address || '')) ||
          collator.compare(String(a.name || ''), String(b.name || ''));
      }
      return collator.compare(String(a.name || ''), String(b.name || ''));
    });
  }

  function updateMemberCount() {
    const total = Array.isArray(window.db?.members) ? window.db.members.length : 0;
    const shown = visibleMembers().length;
    const count = $('vccfMembersCount');
    if (count) count.textContent = `Total members: ${total} · Showing: ${shown}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[m]));
  }

  function refreshAddressFilterOptions() {
    const select = $('vccfFilterAddress');
    if (!select) return;
    const current = addressFilter;
    const addresses = [...new Set(memberPool().map(m => String(m.address || '').trim()).filter(Boolean))].sort(collator.compare);
    select.innerHTML = '<option value="">All addresses</option>' +
      addresses.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('') +
      '<option value="__blank__">No address</option>';
    select.value = current || '';
  }

  function applyAddressFilterToRows() {
    const tbody = $('memberRows');
    if (!tbody) return;
    [...tbody.rows].forEach(row => {
      const address = row.cells[3]?.textContent?.trim() || '';
      const matches = addressFilter === '__blank__' ? !address : (!addressFilter || address === addressFilter);
      row.style.display = matches ? '' : 'none';
    });
  }

  function setupMemberControls() {
    const section = $('members');
    if (!section) return;
    const toolbar = section.querySelector('.toolbar');
    if (!toolbar) return;

    let holder = toolbar.querySelector('.vccf-member-controls');
    if (!holder) {
      holder = document.createElement('div');
      holder.className = 'vccf-member-controls';
      holder.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;';
      toolbar.insertAdjacentElement('afterend', holder);
    }

    if (!holder.querySelector('#vccfMembersCount')) {
      const count = document.createElement('span');
      count.id = 'vccfMembersCount';
      count.style.cssText = 'font-weight:800;color:var(--muted);font-size:.85rem;';
      holder.appendChild(count);
    }

    if (!holder.querySelector('#vccfSortMembers')) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.85rem;font-weight:800;';
      label.innerHTML = '<span>Sort by:</span>';
      const select = document.createElement('select');
      select.id = 'vccfSortMembers';
      select.className = 'search';
      select.style.cssText = 'min-width:170px;';
      select.innerHTML = '<option value="name">Name</option><option value="address">Address</option>';
      select.value = sortMode;
      select.addEventListener('change', () => {
        sortMode = select.value;
        sortMembersInDb();
        if (typeof window.renderMembers === 'function') window.renderMembers();
        setTimeout(() => {
          applyAddressFilterToRows();
          updateMemberCount();
        }, 60);
      });
      label.appendChild(select);
      holder.appendChild(label);
    }

    if (!holder.querySelector('#vccfFilterAddress')) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.85rem;font-weight:800;';
      label.innerHTML = '<span>Filter by: Address</span>';
      const select = document.createElement('select');
      select.id = 'vccfFilterAddress';
      select.className = 'search';
      select.style.cssText = 'min-width:210px;';
      select.addEventListener('change', () => {
        addressFilter = select.value;
        applyAddressFilterToRows();
        updateMemberCount();
      });
      label.appendChild(select);
      holder.appendChild(label);
    }

    refreshAddressFilterOptions();
    $('memberSearch')?.addEventListener('input', () => setTimeout(() => {
      applyAddressFilterToRows();
      updateMemberCount();
    }, 0));
    $('areaFilter')?.addEventListener('change', () => setTimeout(() => {
      refreshAddressFilterOptions();
      applyAddressFilterToRows();
      updateMemberCount();
    }, 0));
    applyAddressFilterToRows();
    updateMemberCount();
  }

  function patchMembersRenderer() {
    if (window.__VCCF_RENDER_MEMBERS_WRAPPED__) return;
    if (typeof window.renderMembers !== 'function') return;
    const original = window.renderMembers;
    window.renderMembers = function(...args) {
      sortMembersInDb();
      const result = original.apply(this, args);
      setTimeout(() => {
        refreshAddressFilterOptions();
        applyAddressFilterToRows();
        updateMemberCount();
      }, 0);
      return result;
    };
    window.__VCCF_RENDER_MEMBERS_WRAPPED__ = true;
  }

  function observeTheme() {
    const observer = new MutationObserver(() => {
      applyLogoTheme();
      document.querySelectorAll('.vccf-theme-button').forEach(updateThemeButton);
    });
    observer.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  }

  function run() {
    applyLogoTheme();
    setupThemeButtons();
    patchMembersRenderer();
    setupMemberControls();
  }

  observeTheme();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(run, 200), { once:true });
  } else {
    setTimeout(run, 200);
  }
  window.addEventListener('vccf-app-ready', () => setTimeout(run, 100));
  const observer = new MutationObserver(() => run());
  observer.observe(document.body, { childList:true, subtree:true });
})();
