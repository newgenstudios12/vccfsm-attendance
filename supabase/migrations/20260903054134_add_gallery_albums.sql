create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  album_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums(id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  sort_order integer not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists gallery_albums_date_idx on public.gallery_albums(album_date desc, created_at desc);
create index if not exists gallery_album_photos_album_idx on public.gallery_album_photos(album_id, sort_order, created_at);

alter table public.gallery_albums enable row level security;
alter table public.gallery_album_photos enable row level security;

drop policy if exists "gallery_albums_read" on public.gallery_albums;
drop policy if exists "gallery_albums_admin_insert" on public.gallery_albums;
drop policy if exists "gallery_albums_admin_update" on public.gallery_albums;
drop policy if exists "gallery_albums_admin_delete" on public.gallery_albums;
create policy "gallery_albums_read" on public.gallery_albums for select to authenticated using (true);
create policy "gallery_albums_admin_insert" on public.gallery_albums for insert to authenticated with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin'));
create policy "gallery_albums_admin_update" on public.gallery_albums for update to authenticated using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin')) with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin'));
create policy "gallery_albums_admin_delete" on public.gallery_albums for delete to authenticated using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin'));

drop policy if exists "gallery_album_photos_read" on public.gallery_album_photos;
drop policy if exists "gallery_album_photos_admin_insert" on public.gallery_album_photos;
drop policy if exists "gallery_album_photos_admin_update" on public.gallery_album_photos;
drop policy if exists "gallery_album_photos_admin_delete" on public.gallery_album_photos;
create policy "gallery_album_photos_read" on public.gallery_album_photos for select to authenticated using (true);
create policy "gallery_album_photos_admin_insert" on public.gallery_album_photos for insert to authenticated with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin'));
create policy "gallery_album_photos_admin_update" on public.gallery_album_photos for update to authenticated using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin')) with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin'));
create policy "gallery_album_photos_admin_delete" on public.gallery_album_photos for delete to authenticated using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text='admin'));

grant select,insert,update,delete on public.gallery_albums to authenticated;
grant select,insert,update,delete on public.gallery_album_photos to authenticated;
