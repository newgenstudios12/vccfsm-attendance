-- Editable Dashboard welcome banner.
-- Authenticated users can read site settings; only Admin/Pastor can update branding.
-- Banner images are stored in the public vccf-gallery bucket under dashboard-banner/.

grant select,insert,update,delete on public.site_settings to authenticated;

drop policy if exists "site_settings_admin_write" on public.site_settings;
drop policy if exists "site_settings_admin_pastor_write" on public.site_settings;

create policy "site_settings_admin_pastor_write"
on public.site_settings for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);

drop policy if exists "dashboard_banner_upload" on storage.objects;
drop policy if exists "dashboard_banner_delete" on storage.objects;

create policy "dashboard_banner_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='dashboard-banner'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);

create policy "dashboard_banner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id='vccf-gallery'
  and (storage.foldername(name))[1]='dashboard-banner'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);
