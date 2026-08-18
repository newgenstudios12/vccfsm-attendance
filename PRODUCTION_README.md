# VCCF Production Setup

## Supabase
Use Supabase Auth with email/password and the provided Postgres migration. Browser code uses only the project URL and publishable key. Row Level Security enforces admin/area-leader/member access.

## First administrator
Because only admins can create accounts, bootstrap the first admin once through the Supabase dashboard:
1. Authentication -> Users -> Add user.
2. Create the first administrator's email/password.
3. In SQL Editor, create the matching `public.profiles` row with role `admin` and null area/member. This is a one-time bootstrap operation. Do not paste or store passwords in SQL.

After the first admin exists, future account creation should use the server-side `create-user` function included in the project (do not use client-side `signUp` for admin account provisioning).

## Browser security
Never expose `service_role` or secret keys. The browser must use only the publishable key, with RLS enabled.

## Current status
- Authentication: Supabase Auth sign-in/sign-out/session restore.
- Members: Supabase Postgres reads/writes.
- Attendance: Supabase Postgres insert/select with RLS.
- Roles: Supabase profile role and area.
- QR: existing member QR UX retained; QR resolves member code through the authenticated app.
- Account creation: UI is present but intentionally waits for the server-side create-user function to be deployed.
- Photo upload/storage migration and full gallery CRUD should be connected to Supabase Storage before final launch.


## Vercel deployment
Set these Vercel Environment Variables for Production and Preview:
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your Supabase publishable key

Build Command: `npm run build`
Output Directory: `public``
Framework Preset: `Other`
The build script generates `vccf-config.js` from environment variables, so the Supabase values are not committed to GitHub.
