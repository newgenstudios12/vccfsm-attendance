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
})();
