(() => {
  if (window.__VCCF_MEMBER_CONTROLS_V2__) return;
  window.__VCCF_MEMBER_CONTROLS_V2__ = true;

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  let sortMode = 'name';
  let addressFilter = '';

  const $ = id => document.getElementById(id);

  function getMembers() {
    if (typeof window.areaMembers !== 'function' || !Array.isArray(window.db?.members)) return [];
    return window.areaMembers();
  }

  function sortMembers() {
    const members = getMembers();
    members.sort((a, b) => {
      if (sortMode === 'address') {
        return collator.compare(String(a.address || ''), String(b.address || '')) ||
               collator.compare(String(a.name || ''), String(b.name || ''));
      }
      return collator.compare(String(a.name || ''), String(b.name || ''));
    });
  }

  function updateAddressFilterOptions() {
    const select = $('vccfFilterByAddress');
    if (!select) return;

    const values = [...new Set(
      getMembers()
        .map(m => String(m.address || '').trim())
        .filter(Boolean)
    )].sort(collator.compare);

    const current = addressFilter;
    select.innerHTML = '<option value="">All addresses</option>' +
      values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('') +
      '<option value="__blank__">No address</option>';
    select.value = values.includes(current) || current === '__blank__' ? current : '';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>\"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[ch]));
  }

  function applyAddressFilter() {
    const tbody = $('memberRows');
    if (!tbody) return;

    Array.from(tbody.rows).forEach(row => {
      const address = (row.cells[3]?.textContent || '').trim();
      const visible = addressFilter === '__blank__' ? !address : (!addressFilter || address === addressFilter);
      row.hidden = !visible;
    });
  }

  function updateMemberCount() {
    const el = $('vccfMemberCount');
    if (!el) return;

    const total = Array.isArray(window.db?.members) ? window.db.members.length : 0;
    const shown = getMembers().filter(member => {
      const address = String(member.address || '').trim();
      return addressFilter === '__blank__' ? !address : (!addressFilter || address === addressFilter);
    }).length;

    el.textContent = `Total members: ${total} · Showing: ${shown}`;
  }

  function renderMembersWithControls() {
    sortMembers();
    if (typeof window.renderMembers === 'function') window.renderMembers();
    updateAddressFilterOptions();
    applyAddressFilter();
    updateMemberCount();
  }

  function patchRenderer() {
    if (window.__VCCF_MEMBER_RENDER_PATCHED_V2__) return true;
    if (typeof window.renderMembers !== 'function') return false;

    const original = window.renderMembers;
    window.renderMembers = function (...args) {
      sortMembers();
      const result = original.apply(this, args);
      updateAddressFilterOptions();
      applyAddressFilter();
      updateMemberCount();
      return result;
    };

    window.__VCCF_MEMBER_RENDER_PATCHED_V2__ = true;
    return true;
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
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      label.innerHTML = '<span>Sort by:</span>';

      const select = document.createElement('select');
      select.id = 'vccfSortBy';
      select.className = 'search';
      select.style.minWidth = '150px';
      select.innerHTML = '<option value="name">Name</option><option value="address">Address</option>';
      select.value = sortMode;
      select.addEventListener('change', () => {
        sortMode = select.value;
        renderMembersWithControls();
      });

      label.appendChild(select);
      box.appendChild(label);
    }

    if (!$('vccfFilterByAddress')) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      label.innerHTML = '<span>Filter by: Address</span>';

      const select = document.createElement('select');
      select.id = 'vccfFilterByAddress';
      select.className = 'search';
      select.style.minWidth = '210px';
      select.addEventListener('change', () => {
        addressFilter = select.value;
        applyAddressFilter();
        updateMemberCount();
      });

      label.appendChild(select);
      box.appendChild(label);
    }

    updateAddressFilterOptions();
    applyAddressFilter();
    updateMemberCount();
    return true;
  }

  function boot() {
    ensureControls();
    patchRenderer();

    const search = $('memberSearch');
    if (search && !search.dataset.vccfMemberControlsBound) {
      search.dataset.vccfMemberControlsBound = '1';
      search.addEventListener('input', () => setTimeout(updateMemberCount, 0));
    }

    const area = $('areaFilter');
    if (area && !area.dataset.vccfMemberControlsBound) {
      area.dataset.vccfMemberControlsBound = '1';
      area.addEventListener('change', () => {
        updateAddressFilterOptions();
        applyAddressFilter();
        updateMemberCount();
      });
    }

    return typeof window.renderMembers === 'function';
  }

  function start() {
    // The page already contains the Members markup before scripts near the end of
    // the document run, so we deliberately avoid a MutationObserver here. The
    // previous observer could continuously trigger itself and make the app hang.
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const ready = boot();
      if (ready || attempts >= 20) clearInterval(timer);
    }, 250);
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.addEventListener('vccf-app-ready', start);
})();
