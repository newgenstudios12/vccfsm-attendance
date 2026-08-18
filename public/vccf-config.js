// Public Supabase client configuration.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';

// Keep optional table reads from blocking the authenticated session.
(() => {
  const g = window.supabase;
  const originalCreateClient = g?.createClient;
  if (!originalCreateClient || window.__VCCF_LOGIN_PATCH_V4__) return;
  window.__VCCF_LOGIN_PATCH_V4__ = true;
  const optional = new Set(['areas','members','attendance','photos','site_people']);
  function wrap(builder, table) {
    if (!builder) return builder;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === 'then' && typeof target.then === 'function') {
          return (resolve, reject) => target.then(result => {
            if (optional.has(table) && result?.error) return resolve({data:[],error:null,count:0,status:200,statusText:'OK'});
            return resolve(result);
          }, reject);
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (table === 'profiles' && prop === 'select' && typeof args[0] === 'string' && args[0].includes('members(*)')) {
            args = ['user_id,role,member_id,area_id,display_name,created_at,updated_at', ...args.slice(1)];
          }
          return wrap(value.apply(target, args), table);
        };
      }
    });
  }
  g.createClient = function(...args) {
    const client = originalCreateClient.apply(this,args);
    const originalFrom = client.from.bind(client);
    client.from = table => wrap(originalFrom(table), table);
    return client;
  };

  // The legacy page swallows login errors in a toast. Replace that handler after
  // the page has registered it, and show the exact failure on the login card.
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    const form = document.getElementById('loginForm');
    if (!form || !window.supabaseClientForVccf) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginUser')?.value.trim();
      const password = document.getElementById('loginPass')?.value;
      const button = form.querySelector('button[type="submit"],button');
      if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
      let box = document.getElementById('vccfLoginError');
      if (!box) { box = document.createElement('div'); box.id='vccfLoginError'; box.style.cssText='margin-top:14px;padding:12px;border-radius:10px;background:#fff1f1;color:#b42318;font-size:.85rem;white-space:pre-wrap'; form.appendChild(box); }
      box.textContent = '';
      try {
        const { data, error } = await window.supabaseClientForVccf.auth.signInWithPassword({email,password});
        if (error) throw new Error(`Supabase login: ${error.message} (${error.status || 'no status'})`);
        if (!data?.user) throw new Error('Supabase login returned no user.');
        const { data: p, error: pe } = await window.supabaseClientForVccf.from('profiles').select('user_id,role,member_id,area_id,display_name').eq('user_id', data.user.id).maybeSingle();
        if (pe) throw new Error(`Profile lookup: ${pe.message}`);
        if (!p) throw new Error('Login succeeded, but no VCCF profile exists for this Auth user.');
        box.style.background='#ecfdf3'; box.style.color='#027a48'; box.textContent='Authentication succeeded. Loading VCCF…';
        // Let the existing application finish its normal session/bootstrap flow.
        window.location.reload();
      } catch (err) {
        console.error('VCCF login diagnostic:', err);
        box.textContent = err?.message || String(err);
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Sign in'; }
      }
    };
  }, 0));
})();

// The app's index.html creates the client from these globals. The diagnostic
// handler above uses this reference when available; index.html may assign it.
