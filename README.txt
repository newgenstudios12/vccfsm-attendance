VCCF Santa Maria Attendance — Supabase Connected

This build replaces demo/localStorage authentication and application data with Supabase Auth + Postgres queries.

Setup:
1. Copy vccf-config.js.example to vccf-config.js.
2. Put your Supabase Project URL and PUBLISHABLE key in vccf-config.js.
3. Apply supabase/migrations/20260818_000001_initial_vccf.sql using your normal migration/deployment workflow.
4. Create the first admin in Supabase Auth and create its public.profiles row as documented in PRODUCTION_README.md.
5. npm install && npm run build.

Never put a Supabase service-role/secret key in vccf-config.js or the browser.
