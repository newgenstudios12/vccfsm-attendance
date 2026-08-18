-- VCCF Connect: member status + dashboard YouTube video
alter table public.members
  add column if not exists status text not null default 'active' check (status in ('active','inactive')),
  add column if not exists status_updated_at timestamptz;

create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_settings enable row level security;

-- Logged-in users may read the dashboard setting. Writes are restricted to admins by policy.
drop policy if exists "site_settings_read_authenticated" on public.site_settings;
create policy "site_settings_read_authenticated"
on public.site_settings for select
to authenticated using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write"
on public.site_settings for all
to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and lower(p.role) = 'admin'))
with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and lower(p.role) = 'admin'));

-- Admins and Area Leaders can update member status; leaders are restricted to their own area.
drop policy if exists "members_status_admin_leader_update" on public.members;
create policy "members_status_admin_leader_update"
on public.members for update
to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and lower(p.role) = 'admin')
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and lower(p.role) = 'area leader' and p.area_id = public.members.area_id)
)
with check (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and lower(p.role) = 'admin')
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and lower(p.role) = 'area leader' and p.area_id = public.members.area_id)
);

insert into public.site_settings(key,value)
values ('dashboard_youtube_url','')
on conflict (key) do nothing;
