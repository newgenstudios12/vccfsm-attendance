create table if not exists public.digital_id_template_settings (
  id text primary key default 'default' check (id = 'default'),
  template_url text,
  storage_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.digital_id_template_settings enable row level security;
grant select, insert, update on public.digital_id_template_settings to authenticated;

insert into public.digital_id_template_settings (id)
values ('default')
on conflict (id) do nothing;

drop policy if exists digital_id_template_settings_read on public.digital_id_template_settings;
create policy digital_id_template_settings_read
on public.digital_id_template_settings
for select
to authenticated
using (id = 'default');

drop policy if exists digital_id_template_settings_admin_insert on public.digital_id_template_settings;
create policy digital_id_template_settings_admin_insert
on public.digital_id_template_settings
for insert
to authenticated
with check ((select public.current_role()::text) = 'admin');

drop policy if exists digital_id_template_settings_admin_update on public.digital_id_template_settings;
create policy digital_id_template_settings_admin_update
on public.digital_id_template_settings
for update
to authenticated
using ((select public.current_role()::text) = 'admin')
with check ((select public.current_role()::text) = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vccf-id-templates',
  'vccf-id-templates',
  true,
  10485760,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists digital_id_template_admin_upload on storage.objects;
create policy digital_id_template_admin_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vccf-id-templates'
  and (select public.current_role()::text) = 'admin'
);

drop policy if exists digital_id_template_admin_update on storage.objects;
create policy digital_id_template_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vccf-id-templates'
  and (select public.current_role()::text) = 'admin'
)
with check (
  bucket_id = 'vccf-id-templates'
  and (select public.current_role()::text) = 'admin'
);

drop policy if exists digital_id_template_admin_delete on storage.objects;
create policy digital_id_template_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vccf-id-templates'
  and (select public.current_role()::text) = 'admin'
);
