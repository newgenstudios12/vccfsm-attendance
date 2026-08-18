// Public Supabase client configuration.
// The publishable key is safe for browser use when Row Level Security is enabled.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';

// Production login compatibility patch.
// Keep the authentication/profile lookup from being blocked by optional table RLS,
// and remove the invalid profiles -> members relationship from the legacy query.
(() => {
  const supabaseGlobal = window.supabase;
  const originalCreateClient = supabaseGlobal?.createClient;
  if (!originalCreateClient || window.__VCCF_LOGIN_PATCH_V3__) return;
  window.__VCCF_LOGIN_PATCH_V3__ = true;

  const optionalReadTables = new Set(['areas', 'members', 'attendance', 'photos', 'site_people']);

  function wrapBuilder(builder, table) {
    if (!builder || (typeof builder !== 'object' && typeof builder !== 'function')) return builder;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === 'then' && typeof target.then === 'function') {
          return (resolve, reject) => target.then(result => {
            if (optionalReadTables.has(table) && result?.error) {
              return resolve({ data: [], error: null, count: 0, status: 200, statusText: 'OK' });
            }
            return resolve(result);
          }, reject);
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return (...args) => {
          let nextArgs = args;
          if (table === 'profiles' && prop === 'select' && typeof args[0] === 'string' && args[0].includes('members(*)')) {
            nextArgs = ['user_id,role,member_id,area_id,display_name,created_at,updated_at', ...args.slice(1)];
          }
          return wrapBuilder(value.apply(target, nextArgs), table);
        };
      }
    });
  }

  supabaseGlobal.createClient = function (...args) {
    const client = originalCreateClient.apply(this, args);
    const originalFrom = client.from.bind(client);
    client.from = table => wrapBuilder(originalFrom(table), table);
    return client;
  };
})();
