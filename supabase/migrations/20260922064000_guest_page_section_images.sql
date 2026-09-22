-- Guest page section image controls.
-- Guests can read only guest-page appearance settings.
-- Admins can edit guest-page appearance; pastors keep access to other site settings.

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from anon;
grant select (key, value, updated_at) on table public.site_settings to anon;

drop policy if exists site_settings_public_guest_appearance_read on public.site_settings;
create policy site_settings_public_guest_appearance_read
on public.site_settings
for select
to anon
using (key like 'guest_page_%');

drop policy if exists site_settings_admin_pastor_write on public.site_settings;
create policy site_settings_admin_pastor_write
on public.site_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.role::text = 'admin'
        or (p.role::text = 'pastor' and site_settings.key not like 'guest_page_%')
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.role::text = 'admin'
        or (p.role::text = 'pastor' and site_settings.key not like 'guest_page_%')
      )
  )
);
