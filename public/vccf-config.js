// Public Supabase client configuration.
// The publishable key is safe for browser use when Row Level Security is enabled.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';

// Production login compatibility patch.
// The login flow needs the authenticated user + profiles row first. A denied
// read on an optional data table must not prevent the app shell from opening.
(() => {
  const supabaseGlobal = window.supabase;
  const originalCreateClient = supabaseGlobal?.createClient;
  if (!originalCreateClient || window.__VCCF_LOGIN_PATCH_V2__) return;
  window.__VCCF_LOGIN_PATCH_V2__ = true;

  const optionalReadTables = new Set(['areas', 'members', 'attendance', 'photos', 'site_people']);

  function wrapBuilder(builder, table) {
    if (!builder || typeof builder.then !== 'function' || builder.__vccfWrapped) return builder;
    builder.__vccfWrapped = true;
    const originalThen = builder.then.bind(builder);
    builder.then = (resolve, reject) => originalThen(result => {
      if (optionalReadTables.has(table) && result?.error) {
        return resolve({ data: [], error: null, count: 0, status: 200, statusText: 'OK' });
      }
      return resolve(result);
    }, reject);
    return builder;
  }

  function patchQuery(query, table) {
    if (!query || query.__vccfQueryPatched) return query;
    query.__vccfQueryPatched = true;

    const originalSelect = query.select?.bind(query);
    if (originalSelect) {
      query.select = (columns, ...rest) => {
        // The profiles table has no required members relationship in the
        // production schema. Fetch the profile columns directly.
        if (table === 'profiles' && typeof columns === 'string' && columns.includes('members(*)')) {
          columns = 'user_id,role,member_id,area_id,display_name,created_at,updated_at';
        }
        return wrapBuilder(originalSelect(columns, ...rest), table);
      };
    }

    return wrapBuilder(query, table);
  }

  supabaseGlobal.createClient = function (...args) {
    const client = originalCreateClient.apply(this, args);
    const originalFrom = client.from.bind(client);
    client.from = table => patchQuery(originalFrom(table), table);
    return client;
  };
})();
