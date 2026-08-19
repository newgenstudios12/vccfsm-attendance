(() => {
  if (window.__VCCF_THEME_PERSIST_V3__) return;
  window.__VCCF_THEME_PERSIST_V3__ = true;

  const valid = v => v === 'dark' || v === 'light';
  let client = null;
  let userId = null;
  let ready = false;
  let saving = false;
  let queued = null;
  let lastSaved = null;

  function getClient() {
    if (client) return client;
    const sb = window.supabase;
    if (!sb?.createClient || !window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) return null;
    client = sb.createClient(window.VCCF_SUPABASE_URL, window.VCCF_SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  function currentTheme() {
    return valid(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : 'light';
  }

  function syncLogos(theme) {
    const dark = theme === 'dark';
    document.querySelectorAll('.logo').forEach(img => {
      const desired = dark ? img.dataset.dark : img.dataset.light;
      if (desired && img.getAttribute('src') !== desired) img.setAttribute('src', desired);
    });
  }

  function applyTheme(theme) {
    const value = valid(theme) ? theme : 'light';
    document.documentElement.dataset.theme = value;
    localStorage.setItem('vccf-theme', value);
    syncLogos(value);
    updateThemeButtons();
  }

  async function saveTheme(theme) {
    if (!ready || !userId || !valid(theme)) return;
    if (theme === lastSaved) return;
    if (saving) { queued = theme; return; }
    saving = true;
    try {
      const c = getClient();
      if (!c) return;
      const { error } = await c.rpc('set_my_theme_preference', { p_theme: theme });
      if (error) throw error;
      lastSaved = theme;
    } catch (e) {
      console.warn('VCCF theme preference could not be saved:', e);
    } finally {
      saving = false;
      if (queued && queued !== lastSaved) {
        const next = queued;
        queued = null;
        saveTheme(next);
      } else queued = null;
    }
  }

  async function loadTheme() {
    const c = getClient();
    const local = localStorage.getItem('vccf-theme');
    if (!c) { applyTheme(valid(local) ? local : 'light'); return; }
    try {
      const { data: auth } = await c.auth.getUser();
      userId = auth?.user?.id || null;
      if (!userId) {
        ready = false;
        applyTheme(valid(local) ? local : 'light');
        return;
      }
      const { data, error } = await c.rpc('get_my_theme_preference');
      if (error) throw error;
      const theme = Array.isArray(data) ? data[0] : data;
      const value = typeof theme === 'string' ? theme : theme?.theme_preference;
      applyTheme(valid(value) ? value : (valid(local) ? local : 'light'));
      lastSaved = valid(value) ? value : currentTheme();
      ready = true;
    } catch (e) {
      console.warn('VCCF theme preference could not be loaded:', e);
      applyTheme(valid(local) ? local : 'light');
      ready = true;
      lastSaved = currentTheme();
    }
  }

  function setTheme(theme) {
    const value = valid(theme) ? theme : 'light';
    applyTheme(value);
    if (ready) saveTheme(value);
  }

  function buttonStyle() {
    return 'border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:9px 12px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,.06);';
  }

  function makeThemeButton(id) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.style.cssText = buttonStyle();
    b.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
    return b;
  }

  function updateThemeButtons() {
    const dark = currentTheme() === 'dark';
    const text = dark ? '☀️ Light mode' : '🌙 Dark mode';
    ['vccfLoginThemeToggle', 'vccfTopThemeToggle'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.textContent = text;
    });
    const settingsToggle = document.getElementById('themeToggle');
    if (settingsToggle) settingsToggle.checked = dark;
    syncLogos(dark ? 'dark' : 'light');
  }

  function installThemeButtons() {
    if (!document.getElementById('vccfLoginThemeToggle')) {
      const loginCard = document.querySelector('#login .login-card');
      if (loginCard) {
        const b = makeThemeButton('vccfLoginThemeToggle');
        b.style.cssText += 'display:block;margin:0 0 18px auto;';
        loginCard.insertBefore(b, loginCard.firstChild);
      }
    }

    if (!document.getElementById('vccfTopThemeToggle')) {
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        const b = makeThemeButton('vccfTopThemeToggle');
        b.style.cssText += 'margin-left:auto;';
        const userchip = topbar.querySelector('.userchip');
        if (userchip) topbar.insertBefore(b, userchip);
        else topbar.appendChild(b);
      }
    }
    updateThemeButtons();
  }

  function watchThemeChanges() {
    const observer = new MutationObserver(() => {
      updateThemeButtons();
      if (ready) saveTheme(currentTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const checkbox = document.getElementById('themeToggle');
    if (checkbox && !checkbox.dataset.vccfPatched) {
      checkbox.dataset.vccfPatched = '1';
      checkbox.addEventListener('change', () => setTheme(checkbox.checked ? 'dark' : 'light'));
    }
  }

  const usernameEmail = value => {
    const s = String(value || '').trim().toLowerCase();
    if (!s || s.includes('@')) return s;
    return `${s.replace(/[^a-z0-9._-]/g, '')}@vccf.local`;
  };

  function enableUsernameLogin() {
    const form = document.getElementById('loginForm');
    const input = document.getElementById('loginUser');
    if (!form || !input || form.dataset.usernameLoginPatched) return;
    form.dataset.usernameLoginPatched = '1';
    form.addEventListener('submit', () => {
      const raw = input.value.trim();
      if (raw && !raw.includes('@')) input.value = usernameEmail(raw);
    }, true);
    input.placeholder = 'Enter email or username';
  }

  const BARANGAYS = [
    'Adia','Bagong Pook','Bagumbayan','Bubukal','Cabooan','Calangay','Cambuja','Coralan','Cueva',
    'Inayapan','Jose Laurel, Sr.','Kayhakat','Macasipac','Masinao','Mataling-Ting','Pao-o',
    'Parang Ng Buho','Barangay I','Barangay II','Barangay III','Barangay IV','Jose Rizal',
    'Santiago','Talangka','Tungkod'
  ];

  function esc(v) {
    return String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  }

  function patchAddressField() {
    const input = document.getElementById('mAddress');
    if (!input || input.dataset.barangayPatched) return;
    const old = input.value || '';
    const wrap = input.closest('.field');
    if (!wrap) return;

    const select = document.createElement('select');
    select.id = 'mAddress';
    select.dataset.barangayPatched = '1';
    select.required = true;
    select.innerHTML = '<option value="">Select barangay</option>' +
      BARANGAYS.map(b => `<option value="${esc(b)}, Santa Maria">${esc(b)}, Santa Maria</option>`).join('') +
      '<option value="Others">Others</option>';

    const other = document.createElement('input');
    other.id = 'mAddressOther';
    other.type = 'text';
    other.placeholder = 'Enter address / barangay';
    other.style.marginTop = '8px';
    other.className = 'hidden';

    wrap.innerHTML = '<label>Address (Barangay, Santa Maria)</label>';
    wrap.appendChild(select);
    wrap.appendChild(other);

    const syncOthers = () => {
      const isOther = select.value === 'Others';
      other.classList.toggle('hidden', !isOther);
      other.required = isOther;
      if (!isOther) other.value = '';
    };
    select.addEventListener('change', syncOthers);

    const normalizedOld = old.trim();
    if (normalizedOld) {
      const match = BARANGAYS.find(b =>
        normalizedOld.toLowerCase() === `${b}, santa maria`.toLowerCase() ||
        normalizedOld.toLowerCase() === `${b}, santa maria, laguna`.toLowerCase()
      );
      if (match) {
        select.value = `${match}, Santa Maria`;
      } else {
        select.value = 'Others';
        other.value = normalizedOld;
      }
      syncOthers();
    }
  }

  function saveAddressAfterMemberSubmit() {
    const form = document.getElementById('memberForm');
    const select = document.getElementById('mAddress');
    if (!form || !select || form.dataset.addressSavePatched) return;
    form.dataset.addressSavePatched = '1';
    form.addEventListener('submit', () => {
      const address = select.value === 'Others'
        ? (document.getElementById('mAddressOther')?.value.trim() || 'Others')
        : select.value.trim();
      if (!address) return;
      const name = document.getElementById('mName')?.value.trim() || '';
      const birthday = document.getElementById('mBirth')?.value || '';
      const areaText = document.getElementById('mArea')?.value || '';
      setTimeout(async () => {
        try {
          const c = getClient(); if (!c) return;
          const existing = typeof db !== 'undefined'
            ? (db.members || []).find(m => m.name === name && m.birthday === birthday && m.area === areaText)
            : null;
          if (existing?.id) {
            const r = await c.from('members').update({address}).eq('id', existing.id);
            if (r.error) console.warn('Address save:', r.error);
          } else {
            const r = await c.from('members').select('id').eq('display_name', name).eq('birth_date', birthday).limit(1).maybeSingle();
            if (!r.error && r.data?.id) await c.from('members').update({address}).eq('id', r.data.id);
          }
          if (typeof window.loadDb === 'function') await window.loadDb();
          if (typeof window.refresh === 'function') window.refresh();
        } catch (e) { console.warn('Address save failed:', e); }
      }, 700);
    }, true);
  }

  function observeMemberModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    if (modal.dataset.vccfAddressObserver) return;
    modal.dataset.vccfAddressObserver = '1';
    const observer = new MutationObserver(() => {
      patchAddressField();
      saveAddressAfterMemberSubmit();
    });
    observer.observe(modal, {subtree:true, childList:true});
    setInterval(() => { patchAddressField(); saveAddressAfterMemberSubmit(); }, 500);
  }

  function startEnhancements() {
    installThemeButtons();
    enableUsernameLogin();
    observeMemberModal();
    watchThemeChanges();
    syncLogos(currentTheme());
  }

  async function start() {
    startEnhancements();
    await loadTheme();
    installThemeButtons();
    updateThemeButtons();
    const c = getClient();
    c?.auth?.onAuthStateChange(() => setTimeout(() => {
      loadTheme().then(installThemeButtons);
    }, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
