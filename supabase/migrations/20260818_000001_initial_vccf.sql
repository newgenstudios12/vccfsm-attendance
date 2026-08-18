-- VCCF Santa Maria Attendance
-- Initial production schema
-- Run through Supabase migrations, not by pasting ad-hoc SQL into production.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','area_leader','member');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique default upper(substr(encode(gen_random_bytes(9),'hex'),1,12)),
  first_name text not null,
  last_name text not null,
  address text not null default '',
  display_name text generated always as (trim(first_name || ' ' || last_name)) stored,
  area_id uuid references public.areas(id) on delete set null,
  birth_date date,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  member_id uuid unique references public.members(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_area_check check (
    (role = 'admin' and area_id is null)
    or (role <> 'admin')
  )
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  area_id uuid references public.areas(id) on delete set null,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users(id) on delete set null,
  source text not null default 'qr' check (source in ('qr','self','manual','admin')),
  created_at timestamptz not null default now()
);

-- One attendance record per member per calendar day.
create unique index attendance_member_day_idx
on public.attendance (member_id, ((checked_in_at at time zone 'Asia/Manila')::date));

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  taken_on date,
  featured boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index members_area_idx on public.members(area_id);
create index attendance_area_time_idx on public.attendance(area_id, checked_in_at desc);
create index attendance_member_time_idx on public.attendance(member_id, checked_in_at desc);
create index profiles_area_idx on public.profiles(area_id);

-- Helper functions used by RLS. They read only the authenticated user's profile.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.current_area_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select area_id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select member_id from public.profiles where user_id = auth.uid()
$$;

alter table public.areas enable row level security;
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.photos enable row level security;
alter table public.audit_log enable row level security;

create table public.site_people (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pastor','leader')),
  name text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_people enable row level security;
create policy "site_people_select_authenticated" on public.site_people for select to authenticated using (true);
create policy "site_people_admin_write" on public.site_people for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- Areas: authenticated users may view active areas. Admins manage them.
create policy "areas_select_authenticated"
on public.areas for select to authenticated
using (is_active or public.current_role() = 'admin');

create policy "areas_admin_write"
on public.areas for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Members: admins see all; area leaders see their area; members see only themselves.
create policy "members_select_scoped"
on public.members for select to authenticated
using (
  public.current_role() = 'admin'
  or (public.current_role() = 'area_leader' and area_id = public.current_area_id())
  or (public.current_role() = 'member' and id = public.current_member_id())
);

create policy "members_admin_insert"
on public.members for insert to authenticated
with check (public.current_role() = 'admin');

create policy "members_area_leader_insert"
on public.members for insert to authenticated
with check (
  public.current_role() = 'area_leader'
  and area_id = public.current_area_id()
);

create policy "members_admin_update"
on public.members for update to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "members_area_leader_update"
on public.members for update to authenticated
using (public.current_role() = 'area_leader' and area_id = public.current_area_id())
with check (public.current_role() = 'area_leader' and area_id = public.current_area_id());

create policy "members_admin_delete"
on public.members for delete to authenticated
using (public.current_role() = 'admin');

-- Profiles: users can read their own profile; admins can manage all.
create policy "profiles_self_or_admin_select"
on public.profiles for select to authenticated
using (user_id = auth.uid() or public.current_role() = 'admin');

create policy "profiles_admin_write"
on public.profiles for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Attendance: admins all; leaders their area; members their own record.
create policy "attendance_select_scoped"
on public.attendance for select to authenticated
using (
  public.current_role() = 'admin'
  or (public.current_role() = 'area_leader' and area_id = public.current_area_id())
  or (public.current_role() = 'member' and member_id = public.current_member_id())
);

create policy "attendance_insert_scoped"
on public.attendance for insert to authenticated
with check (
  public.current_role() = 'admin'
  or (public.current_role() = 'area_leader' and area_id = public.current_area_id())
  or (public.current_role() = 'member' and member_id = public.current_member_id())
);

create policy "attendance_admin_update"
on public.attendance for update to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

create policy "attendance_leader_update"
on public.attendance for update to authenticated
using (public.current_role() = 'area_leader' and area_id = public.current_area_id())
with check (public.current_role() = 'area_leader' and area_id = public.current_area_id());

create policy "attendance_admin_delete"
on public.attendance for delete to authenticated
using (public.current_role() = 'admin');

-- Gallery: authenticated users can view; admins manage.
create policy "photos_select_authenticated"
on public.photos for select to authenticated
using (true);

create policy "photos_admin_write"
on public.photos for all to authenticated
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

-- Audit log: admins can read; clients cannot directly write.
create policy "audit_admin_select"
on public.audit_log for select to authenticated
using (public.current_role() = 'admin');

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Create profile row after Supabase Auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id, role, display_name)
  values (new.id, 'member', coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Prevent normal authenticated clients from escalating their own role/area/member link.
revoke all on function public.current_role() from public;
revoke all on function public.current_area_id() from public;
revoke all on function public.current_member_id() from public;

insert into public.areas (name) values ('Area 1'), ('Area 2'), ('Area 3') on conflict (name) do nothing;

-- Gallery storage bucket. Files are publicly readable; only admins can write/delete through Storage policies.
insert into storage.buckets (id, name, public) values ('vccf-gallery','vccf-gallery',true) on conflict (id) do nothing;
create policy "gallery_public_read" on storage.objects for select using (bucket_id = 'vccf-gallery');
create policy "gallery_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'vccf-gallery' and public.current_role() = 'admin');
create policy "gallery_admin_update" on storage.objects for update to authenticated using (bucket_id = 'vccf-gallery' and public.current_role() = 'admin') with check (bucket_id = 'vccf-gallery' and public.current_role() = 'admin');
create policy "gallery_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'vccf-gallery' and public.current_role() = 'admin');
