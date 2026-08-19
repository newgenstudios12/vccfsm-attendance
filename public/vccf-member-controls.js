(() => {
  if (window.__VCCF_MEMBER_CONTROLS_V2__) return;
  window.__VCCF_MEMBER_CONTROLS_V2__ = true;

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  let sortMode = 'name';
  let addressFilter = '';
  const $ = id => document.getElementById(id);

  function members() {
    if (!Array.isArray(window.db?.members)) return [];
    if (typeof window.areaMembers === 'function') return window.areaMembers();
    return window.db.members;
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
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:7px;font-weight:800;font-size:.85rem;';
      const label = document.createElement('span');
      label.textContent = 'Sort by:';
      const select = document.createElement('select');
      select.id = 'vccfSortBy';
      select.className = 'search';
      select.style.minWidth = '150px';
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
    const all = Array.isArray(window.db?.members) ? window.db.members : [];
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
    if (typeof window.renderMembers === 'function') window.renderMembers();
    refreshAddressOptions();
    applyRowFilter();
    updateCount();
  }

  function patchRenderer() {
    if (window.__VCCF_MEMBER_RENDER_PATCHED__) return true;
    if (typeof window.renderMembers !== 'function') return false;
    const original = window.renderMembers;
    window.renderMembers = function (...args) {
      sortRows();
      const result = original.apply(this, args);
      refreshAddressOptions();
      applyRowFilter();
      updateCount();
      return result;
    };
    window.__VCCF_MEMBER_RENDER_PATCHED__ = true;
    return true;
  }

  function boot() {
    const ready = ensureControls();
    patchRenderer();
    if ($('memberSearch') && !$('memberSearch').dataset.vccfControlsPatched) {
      $('memberSearch').dataset.vccfControlsPatched = '1';
      $('memberSearch').addEventListener('input', () => {
        setTimeout(() => {
          refreshAddressOptions();
          applyRowFilter();
          updateCount();
        }, 0);
      });
    }
    if ($('areaFilter') && !$('areaFilter').dataset.vccfControlsPatched) {
      $('areaFilter').dataset.vccfControlsPatched = '1';
      $('areaFilter').addEventListener('change', () => {
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
      if (ready && Array.isArray(window.db?.members) && window.db.members.length >= 0) {
        if (window.db.members.length > 0 || attempts >= 20) clearInterval(timer);
      }
      if (attempts >= 40) clearInterval(timer);
    }, 300);
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
