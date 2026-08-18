// Public Supabase client configuration.
// The publishable key is safe for browser use when Row Level Security is enabled.
window.VCCF_SUPABASE_URL = 'https://hvnlstaecjqhjtiojutd.supabase.co';
window.VCCF_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5nUROPeBjpxHf0B77RjO2w_XBXBXc3g';

// Production login fix:
// The app previously requested the profiles table with `members(*)`.
// That relationship is not required for login and can fail even when the
// authenticated user and profiles row are valid. Rewrite that one select to
// fetch the profile row directly; the app already loads members separately.
(() => {
  const originalCreateClient = window.supabase?.createClient;
  if (!originalCreateClient || window.__VCCF_PROFILE_QUERY_PATCHED__) return;
  window.__VCCF_PROFILE_QUERY_PATCHED__ = true;

  window.supabase.createClient = function (...args) {
    const client = originalCreateClient.apply(this, args);
    const originalFrom = client.from.bind(client);

    client.from = function (table) {
      const query = originalFrom(table);
      if (table !== 'profiles') return query;

      const originalSelect = query.select.bind(query);
      query.select = function (columns, ...rest) {
        if (typeof columns === 'string' && columns.includes('members(*)')) {
          columns = 'user_id,role,member_id,area_id,display_name,created_at,updated_at';
        }
        return originalSelect(columns, ...rest);
      };
      return query;
    };

    return client;
  };
})();
