-- Sermon categories and Admin/Pastor management.

alter table public.vccf_sermons
  add column if not exists sermon_category text not null default 'sunday_sermon',
  add column if not exists preacher text,
  add column if not exists sermon_date date,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.vccf_sermons'::regclass
      and conname='vccf_sermons_category_check'
  ) then
    alter table public.vccf_sermons
      add constraint vccf_sermons_category_check
      check (sermon_category in ('sunday_sermon','discipleship_training'));
  end if;
end $$;

create index if not exists vccf_sermons_category_date_idx
  on public.vccf_sermons (sermon_category, sermon_date desc, created_at desc);

drop policy if exists "Admins can upload sermons" on public.vccf_sermons;
drop policy if exists "Admins can update sermons" on public.vccf_sermons;
drop policy if exists "Admins can delete sermons" on public.vccf_sermons;
drop policy if exists "Admin Pastor can upload sermons" on public.vccf_sermons;
drop policy if exists "Admin Pastor can update sermons" on public.vccf_sermons;
drop policy if exists "Admin Pastor can delete sermons" on public.vccf_sermons;

create policy "Admin Pastor can upload sermons"
on public.vccf_sermons for insert to authenticated
with check (
  uploaded_by=(select auth.uid())
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
);
create policy "Admin Pastor can update sermons"
on public.vccf_sermons for update to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor')))
with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor')));
create policy "Admin Pastor can delete sermons"
on public.vccf_sermons for delete to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor')));

drop policy if exists "Admins can upload sermon files" on storage.objects;
drop policy if exists "Admins can update sermon files" on storage.objects;
drop policy if exists "Admins can delete sermon files" on storage.objects;
drop policy if exists "Admin Pastor can upload sermon files" on storage.objects;
drop policy if exists "Admin Pastor can update sermon files" on storage.objects;
drop policy if exists "Admin Pastor can delete sermon files" on storage.objects;

create policy "Admin Pastor can upload sermon files"
on storage.objects for insert to authenticated
with check (
  bucket_id='vccf-sermons'
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
);
create policy "Admin Pastor can update sermon files"
on storage.objects for update to authenticated
using (
  bucket_id='vccf-sermons'
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
)
with check (
  bucket_id='vccf-sermons'
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
);
create policy "Admin Pastor can delete sermon files"
on storage.objects for delete to authenticated
using (
  bucket_id='vccf-sermons'
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
);
