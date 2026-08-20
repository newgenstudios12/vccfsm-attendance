create schema if not exists private;

create or replace function private.is_vccf_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid())
      and role = 'admin'::public.app_role
  );
$$;
revoke all on function private.is_vccf_admin() from public;
grant execute on function private.is_vccf_admin() to authenticated;

create table if not exists public.vccf_sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.vccf_sermons enable row level security;
grant select, insert, update, delete on public.vccf_sermons to authenticated;

drop policy if exists "Authenticated users can view sermons" on public.vccf_sermons;
create policy "Authenticated users can view sermons" on public.vccf_sermons for select to authenticated using (true);
drop policy if exists "Admins can upload sermons" on public.vccf_sermons;
create policy "Admins can upload sermons" on public.vccf_sermons for insert to authenticated with check ((select private.is_vccf_admin()) and uploaded_by = (select auth.uid()));
drop policy if exists "Admins can update sermons" on public.vccf_sermons;
create policy "Admins can update sermons" on public.vccf_sermons for update to authenticated using ((select private.is_vccf_admin())) with check ((select private.is_vccf_admin()));
drop policy if exists "Admins can delete sermons" on public.vccf_sermons;
create policy "Admins can delete sermons" on public.vccf_sermons for delete to authenticated using ((select private.is_vccf_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vccf-sermons','vccf-sermons',false,52428800,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']::text[])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read sermon files" on storage.objects;
create policy "Authenticated users can read sermon files" on storage.objects for select to authenticated using (bucket_id='vccf-sermons');
drop policy if exists "Admins can upload sermon files" on storage.objects;
create policy "Admins can upload sermon files" on storage.objects for insert to authenticated with check (bucket_id='vccf-sermons' and (select private.is_vccf_admin()));
drop policy if exists "Admins can update sermon files" on storage.objects;
create policy "Admins can update sermon files" on storage.objects for update to authenticated using (bucket_id='vccf-sermons' and (select private.is_vccf_admin())) with check (bucket_id='vccf-sermons' and (select private.is_vccf_admin()));
drop policy if exists "Admins can delete sermon files" on storage.objects;
create policy "Admins can delete sermon files" on storage.objects for delete to authenticated using (bucket_id='vccf-sermons' and (select private.is_vccf_admin()));