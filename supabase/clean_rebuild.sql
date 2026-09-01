-- CLEAN REBUILD: isolated tables, intentionally separate from legacy app tables.
create extension if not exists pgcrypto;

create or replace function public.cms_is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.user_id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','pastor','area_leader'));
$$;
create or replace function public.cms_is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.user_id=auth.uid() and lower(coalesce(p.role,'')) in ('admin','pastor'));
$$;

create table if not exists public.cms_members(
 id uuid primary key default gen_random_uuid(), member_code text unique, first_name text not null, last_name text not null,
 display_name text, status text not null default 'Active' check(status in ('Active','Inactive')),
 area text, barangay text, address text, phone text, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cms_attendance(
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cms_members(id) on delete cascade,
 service_date date not null, service_type text not null default 'Sunday Service', status text not null check(status in ('Present','Absent')),
 checked_in_at timestamptz, recorded_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(member_id,service_date,service_type)
);
create table if not exists public.cms_giving(
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cms_members(id) on delete cascade,
 given_on date not null, giving_type text not null check(giving_type in ('Tithe','Offering','Missions','Building Fund','Special Offering','Other')),
 amount numeric(14,2) not null check(amount>=0), payment_method text, reference_no text, notes text,
 recorded_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.cms_events(
 id uuid primary key default gen_random_uuid(), title text not null, description text, event_date date not null, event_time time,
 location text, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.cms_event_registrations(
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.cms_events(id) on delete cascade,
 member_id uuid not null references public.cms_members(id) on delete cascade, status text not null default 'Registered',
 registered_at timestamptz not null default now(), unique(event_id,member_id)
);
create table if not exists public.cms_ministries(
 id uuid primary key default gen_random_uuid(), name text not null unique, description text, created_at timestamptz not null default now()
);
create table if not exists public.cms_ministry_members(
 id uuid primary key default gen_random_uuid(), ministry_id uuid not null references public.cms_ministries(id) on delete cascade,
 member_id uuid not null references public.cms_members(id) on delete cascade, role_title text, joined_on date,
 unique(ministry_id,member_id)
);
create table if not exists public.cms_pastoral_notes(
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cms_members(id) on delete cascade,
 follow_up_date date, note_type text, note text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create index if not exists cms_attendance_member_date on public.cms_attendance(member_id,service_date desc);
create index if not exists cms_giving_member_date on public.cms_giving(member_id,given_on desc);
create index if not exists cms_members_area on public.cms_members(area);

alter table public.cms_members enable row level security;
alter table public.cms_attendance enable row level security;
alter table public.cms_giving enable row level security;
alter table public.cms_events enable row level security;
alter table public.cms_event_registrations enable row level security;
alter table public.cms_ministries enable row level security;
alter table public.cms_ministry_members enable row level security;
alter table public.cms_pastoral_notes enable row level security;

-- Members can see their own profile; staff can manage the directory.
drop policy if exists cms_members_staff on public.cms_members;
drop policy if exists cms_members_self on public.cms_members;
create policy cms_members_staff on public.cms_members for all to authenticated using(public.cms_is_staff()) with check(public.cms_is_staff());
create policy cms_members_self on public.cms_members for select to authenticated using(id=(select member_id from public.profiles where user_id=auth.uid()));

-- Attendance: members can see their own records; staff manage all.
drop policy if exists cms_attendance_staff on public.cms_attendance;
drop policy if exists cms_attendance_self on public.cms_attendance;
create policy cms_attendance_staff on public.cms_attendance for all to authenticated using(public.cms_is_staff()) with check(public.cms_is_staff());
create policy cms_attendance_self on public.cms_attendance for select to authenticated using(member_id=(select member_id from public.profiles where user_id=auth.uid()));

-- Giving is deliberately admin/pastor only.
drop policy if exists cms_giving_admin on public.cms_giving;
create policy cms_giving_admin on public.cms_giving for all to authenticated using(public.cms_is_admin()) with check(public.cms_is_admin());

-- Events are visible to authenticated users; admin/pastor manage them.
drop policy if exists cms_events_read on public.cms_events;
drop policy if exists cms_events_admin on public.cms_events;
create policy cms_events_read on public.cms_events for select to authenticated using(true);
create policy cms_events_admin on public.cms_events for all to authenticated using(public.cms_is_admin()) with check(public.cms_is_admin());

-- Registrations: users can read/write their own member registrations; staff can manage all.
drop policy if exists cms_event_reg_staff on public.cms_event_registrations;
drop policy if exists cms_event_reg_self on public.cms_event_registrations;
create policy cms_event_reg_staff on public.cms_event_registrations for all to authenticated using(public.cms_is_staff()) with check(public.cms_is_staff());
create policy cms_event_reg_self on public.cms_event_registrations for all to authenticated using(member_id=(select member_id from public.profiles where user_id=auth.uid())) with check(member_id=(select member_id from public.profiles where user_id=auth.uid()));

-- Ministries are visible to authenticated users; staff manage.
drop policy if exists cms_ministries_read on public.cms_ministries;
drop policy if exists cms_ministries_staff on public.cms_ministries;
create policy cms_ministries_read on public.cms_ministries for select to authenticated using(true);
create policy cms_ministries_staff on public.cms_ministries for all to authenticated using(public.cms_is_staff()) with check(public.cms_is_staff());
drop policy if exists cms_ministry_members_read on public.cms_ministry_members;
drop policy if exists cms_ministry_members_staff on public.cms_ministry_members;
create policy cms_ministry_members_read on public.cms_ministry_members for select to authenticated using(true);
create policy cms_ministry_members_staff on public.cms_ministry_members for all to authenticated using(public.cms_is_staff()) with check(public.cms_is_staff());

-- Pastoral notes are staff-only.
drop policy if exists cms_pastoral_staff on public.cms_pastoral_notes;
create policy cms_pastoral_staff on public.cms_pastoral_notes for all to authenticated using(public.cms_is_staff()) with check(public.cms_is_staff());

insert into public.cms_ministries(name,description) values
 ('Worship Ministry','Music, worship leading and service support'),
 ('Youth Ministry','Youth discipleship, fellowship and activities'),
 ('Kids Ministry','Children discipleship and Sunday ministry'),
 ('Prayer Ministry','Prayer meetings and intercession'),
 ('Outreach Ministry','Evangelism and community outreach')
on conflict(name) do nothing;
