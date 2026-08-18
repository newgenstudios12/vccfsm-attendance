(() => {
  if (window.__VCCF_THEME_PERSIST_V1__) return;
  window.__VCCF_THEME_PERSIST_V1__ = true;

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

  function applyTheme(theme) {
    const value = valid(theme) ? theme : 'light';
    document.documentElement.dataset.theme = value;
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
    if (!c) return;
    try {
      const { data: auth } = await c.auth.getUser();
      userId = auth?.user?.id || null;
      if (!userId) { ready = false; applyTheme('light'); return; }
      const { data, error } = await c.rpc('get_my_theme_preference');
      if (error) throw error;
      const theme = Array.isArray(data) ? data[0] : data;
      const value = typeof theme === 'string' ? theme : theme?.theme_preference;
      applyTheme(valid(value) ? value : 'light');
      lastSaved = valid(value) ? value : 'light';
      ready = true;
    } catch (e) {
      console.warn('VCCF theme preference could not be loaded:', e);
      applyTheme('light');
      ready = true;
      lastSaved = 'light';
    }
  }

  function watchThemeChanges() {
    const observer = new MutationObserver(() => {
      if (ready) saveTheme(currentTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    document.addEventListener('click', () => {
      if (!ready) return;
      setTimeout(() => saveTheme(currentTheme()), 80);
    }, true);
  }

  async function start() {
    watchThemeChanges();
    await loadTheme();
    const c = getClient();
    c?.auth?.onAuthStateChange(() => setTimeout(loadTheme, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  // Username login support: Supabase Auth still receives an email-shaped identifier,
  // while the UI accepts a username when an account was created without an email.
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
    'Bagong Pook','Bagumbayan','Bubukal','Cabooan','Calangay','Cambuja','Coralan','Cueva',
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
    input.dataset.barangayPatched = '1';
    const select = document.createElement('select');
    select.id = 'mAddress';
    select.required = true;
    select.innerHTML = '<option value="">Select barangay</option>' +
      BARANGAYS.map(b => `<option value="Barangay, Santa Maria, Laguna">${esc(b)}, Santa Maria</option>`).join('') +
      '<option value="Others">Others</option>';
    const other = document.createElement('input');
    other.id = 'mAddressOther';
    other.type = 'text';
    other.placeholder = 'Enter address / barangay';
    other.style.marginTop = '8px';
    other.className = 'hidden';
    wrap.innerHTML = '<label>Address</label>';
    wrap.appendChild(select);
    wrap.appendChild(other);

    // Store the actual barangay name in the value that the existing member form reads.
    select.addEventListener('change', () => {
      if (select.value === 'Others') {
        other.classList.remove('hidden');
        other.required = true;
      } else {
        other.classList.add('hidden');
        other.required = false;
        other.value = '';
      }
      select.dataset.addressValue = select.value === 'Others' ? '' : (select.options[select.selectedIndex]?.textContent || '');
    });

    const normalizedOld = old.trim();
    if (normalizedOld) {
      const match = BARANGAYS.find(b => normalizedOld.toLowerCase() === `${b}, santa maria`.toLowerCase() || normalizedOld.toLowerCase() === `${b}, santa maria, laguna`.toLowerCase());
      if (match) {
        select.value = 'Barangay, Santa Maria, Laguna';
        [...select.options].find(o => o.textContent.startsWith(match + ','))?.setAttribute('selected','selected');
        select.value = [...select.options].find(o => o.textContent.startsWith(match + ','))?.value || 'Barangay, Santa Maria, Laguna';
      } else {
        select.value = 'Others';
        other.classList.remove('hidden');
        other.required = true;
        other.value = normalizedOld;
      }
    }
  }

  function saveAddressAfterMemberSubmit() {
    const form = document.getElementById('memberForm');
    const select = document.getElementById('mAddress');
    if (!form || !select || form.dataset.addressSavePatched) return;
    form.dataset.addressSavePatched = '1';
    form.addEventListener('submit', async () => {
      const address = select.value === 'Others' ? (document.getElementById('mAddressOther')?.value.trim() || 'Others') : (select.options[select.selectedIndex]?.textContent || '').trim();
      if (!address) return;
      const name = document.getElementById('mName')?.value.trim() || '';
      const birthday = document.getElementById('mBirth')?.value || '';
      const areaText = document.getElementById('mArea')?.value || '';
      setTimeout(async () => {
        try {
          const c = getClient(); if (!c) return;
          const existing = typeof db !== 'undefined' ? (db.members || []).find(m => m.name === name && m.birthday === birthday && m.area === areaText) : null;
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
    const observer = new MutationObserver(() => {
      patchAddressField();
      saveAddressAfterMemberSubmit();
    });
    observer.observe(modal, {subtree:true, childList:true});
    setInterval(() => { patchAddressField(); saveAddressAfterMemberSubmit(); }, 500);
  }

  function startEnhancements() {
    enableUsernameLogin();
    observeMemberModal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startEnhancements, { once:true });
  else startEnhancements();
})();
