/* VCCF_LOGIN_GUARD_V1
   Final login handler. Loaded after vccf-config.js so it is the authoritative
   form handler and cannot be replaced by the config compatibility patch.
*/
(() => {
  if (window.__VCCF_LOGIN_GUARD_V1__) return;
  window.__VCCF_LOGIN_GUARD_V1__ = true;

  const wait = (promise, ms, message) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);

  function install() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const client = window.supabase?.createClient?.(
      window.VCCF_SUPABASE_URL || '',
      window.VCCF_SUPABASE_PUBLISHABLE_KEY || ''
    );
    if (!client) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (form.dataset.vccfSigningIn === '1') return;
      form.dataset.vccfSigningIn = '1';

      const button = form.querySelector('button[type="submit"],button');
      const originalText = button?.textContent || 'Sign in';
      if (button) { button.disabled = true; button.textContent = 'Signing in…'; }

      const identifier = document.getElementById('loginUser')?.value.trim() || '';
      const password = document.getElementById('loginPass')?.value || '';

      try {
        if (!identifier || !password) throw new Error('Please enter your username/email and password.');
        if (!window.VCCF_SUPABASE_URL || !window.VCCF_SUPABASE_PUBLISHABLE_KEY) {
          throw new Error('Supabase configuration is missing.');
        }

        const raw = identifier.toLowerCase();
        const email = raw.includes('@')
          ? raw
          : `${raw.replace(/[^a-z0-9._-]/g, '').replace(/^[-_.]+|[-_.]+$/g, '')}@vccf.local`;
        if (email === '@vccf.local') throw new Error('Please enter a valid username or email.');

        // Authentication is the only blocking operation on the login path.
        // Never wait for members, attendance, profiles, gallery, or other data.
        const result = await wait(
          client.auth.signInWithPassword({ email, password }),
          12000,
          'Sign-in request timed out. Please check your connection and try again.'
        );
        if (result.error) throw new Error(result.error.message || 'Unable to sign in.');
        if (!result.data?.user) throw new Error('Sign-in did not return a user session.');

        const user = result.data.user;
        session = {
          username: email,
          name: user.user_metadata?.display_name || user.email || identifier,
          role: 'Member',
          area: '', areaId: null, memberId: null, memberCode: null
        };

        document.getElementById('login').style.display = 'none';
        document.getElementById('app').classList.add('active');
        document.getElementById('currentName').textContent = session.name;
        document.getElementById('currentRole').textContent = 'Member';
        document.getElementById('avatar').textContent = session.name.charAt(0).toUpperCase();
        document.getElementById('accountInfo').textContent = `${session.name} · Member`;
        if (typeof toast === 'function') toast('Signed in. Loading your VCCF data…');

        // Hydrate the full profile in the background. A slow database query can
        // no longer keep the user trapped on the login screen.
        setTimeout(async () => {
          try {
            if (typeof loadDb === 'function') {
              await wait(loadDb(), 10000, 'VCCF data is taking too long to load.');
              if (session && typeof refresh === 'function') refresh();
            }
          } catch (err) {
            console.error('VCCF background data load:', err);
            if (typeof toast === 'function') toast(err?.message || 'Signed in, but some VCCF data could not be loaded yet.');
          }
        }, 0);
      } catch (err) {
        console.error('VCCF login guard:', err);
        if (typeof toast === 'function') toast(err?.message || 'Unable to sign in.');
      } finally {
        form.dataset.vccfSigningIn = '0';
        if (button) { button.disabled = false; button.textContent = originalText; }
      }
    };
  }

  // Run after every existing DOMContentLoaded handler, including the handler
  // installed by vccf-config.js. A zero-delay task makes this authoritative.
  window.addEventListener('DOMContentLoaded', () => setTimeout(install, 0));
})();
