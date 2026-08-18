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

drop policy if exists "site_settings_read_authenticated" on public.site_settings;
create policy "site_settings_read_authenticated"
on public.site_settings for select
to authenticated using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write"
on public.site_settings for all
to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text = 'admin'))
with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text = 'admin'));

drop policy if exists "members_status_admin_leader_update" on public.members;
create policy "members_status_admin_leader_update"
on public.members for update
to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text = 'admin')
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text in ('area leader','area_leader') and p.area_id = public.members.area_id)
)
with check (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text = 'admin')
  or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text in ('area leader','area_leader') and p.area_id = public.members.area_id)
);

-- Only Admins may delete members.
drop policy if exists "members_admin_delete" on public.members;
create policy "members_admin_delete"
on public.members for delete
to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role::text = 'admin'));

insert into public.site_settings(key,value)
values ('dashboard_youtube_url','')
on conflict (key) do nothing;
