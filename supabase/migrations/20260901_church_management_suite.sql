-- VCCF Church Management Suite
-- Adds member 360 data, ministries, giving, pastoral care, prayer, event registration, and documents.
create extension if not exists pgcrypto;

create table if not exists public.member_spiritual_profiles (
  member_id uuid primary key references public.members(id) on delete cascade,
  membership_date date,
  baptism_date date,
  discipleship_status text,
  bible_study_participation boolean not null default false,
  prayer_meeting_participation boolean not null default false,
  evangelism_participation boolean not null default false,
  small_group text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.member_ministries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  role_title text,
  joined_on date,
  created_at timestamptz not null default now(),
  unique(member_id,ministry_id)
);

create table if not exists public.giving_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  given_on date not null default ((now() at time zone 'Asia/Manila')::date),
  giving_type text not null check (giving_type in ('Tithe','Offering','Missions','Building Fund','Special Offering','Other')),
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text not null default 'Cash',
  reference_no text,
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.pastoral_followups (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  assigned_to uuid references auth.users(id),
  reason text not null,
  followup_type text not null default 'General',
  status text not null default 'Pending' check (status in ('Pending','In Progress','Contacted','Visited','Resolved','Needs Further Follow-up')),
  followup_on date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  request_text text not null,
  category text,
  visibility text not null default 'Private' check (visibility in ('Private','Leaders','Public')),
  status text not null default 'Praying' check (status in ('Praying','Follow-up Needed','Answered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.special_events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'Registered' check (status in ('Registered','Confirmed','Attended','Absent','Cancelled')),
  registered_at timestamptz not null default now(),
  unique(event_id,member_id)
);

create table if not exists public.member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null,
  document_type text not null default 'Other',
  storage_path text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists giving_records_member_date_idx on public.giving_records(member_id,given_on desc);
create index if not exists followups_member_idx on public.pastoral_followups(member_id,status);
create index if not exists prayer_member_idx on public.prayer_requests(member_id,status);
create index if not exists member_ministries_member_idx on public.member_ministries(member_id);
create index if not exists registrations_event_idx on public.event_registrations(event_id,status);
create index if not exists documents_member_idx on public.member_documents(member_id);

insert into public.ministries(name,description) values
('Worship','Worship and music ministry'),('Youth','Youth ministry'),('Children','Children ministry'),('Men','Men ministry'),('Women','Women ministry'),('Media','Media and production'),('Ushering','Ushering and welcome team'),('Outreach','Evangelism and outreach'),('Prayer','Prayer ministry'),('Music','Choir and music ministry')
on conflict (name) do nothing;

alter table public.member_spiritual_profiles enable row level security;
alter table public.ministries enable row level security;
alter table public.member_ministries enable row level security;
alter table public.giving_records enable row level security;
alter table public.pastoral_followups enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.event_registrations enable row level security;
alter table public.member_documents enable row level security;

-- Drop/recreate policies so this file is safe to rerun.
do $$ begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename='member_spiritual_profiles' and policyname='spiritual self or leadership') then drop policy "spiritual self or leadership" on public.member_spiritual_profiles; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='member_spiritual_profiles' and policyname='spiritual leadership write') then drop policy "spiritual leadership write" on public.member_spiritual_profiles; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='ministries' and policyname='ministries readable') then drop policy "ministries readable" on public.ministries; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='ministries' and policyname='ministries managed') then drop policy "ministries managed" on public.ministries; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='member_ministries' and policyname='member ministries readable') then drop policy "member ministries readable" on public.member_ministries; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='member_ministries' and policyname='member ministries managed') then drop policy "member ministries managed" on public.member_ministries; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='giving_records' and policyname='giving private read') then drop policy "giving private read" on public.giving_records; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='giving_records' and policyname='giving finance write') then drop policy "giving finance write" on public.giving_records; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='pastoral_followups' and policyname='followups leadership read') then drop policy "followups leadership read" on public.pastoral_followups; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='pastoral_followups' and policyname='followups leadership write') then drop policy "followups leadership write" on public.pastoral_followups; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='prayer_requests' and policyname='prayers own or leaders') then drop policy "prayers own or leaders" on public.prayer_requests; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='prayer_requests' and policyname='prayers own insert') then drop policy "prayers own insert" on public.prayer_requests; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='prayer_requests' and policyname='prayers leaders update') then drop policy "prayers leaders update" on public.prayer_requests; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='prayer_requests' and policyname='prayers own delete') then drop policy "prayers own delete" on public.prayer_requests; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='event_registrations' and policyname='registrations self or leaders') then drop policy "registrations self or leaders" on public.event_registrations; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='event_registrations' and policyname='registrations self insert') then drop policy "registrations self insert" on public.event_registrations; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='event_registrations' and policyname='registrations leaders update') then drop policy "registrations leaders update" on public.event_registrations; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='event_registrations' and policyname='registrations own delete') then drop policy "registrations own delete" on public.event_registrations; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='member_documents' and policyname='documents own or admin') then drop policy "documents own or admin" on public.member_documents; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='member_documents' and policyname='documents admin write') then drop policy "documents admin write" on public.member_documents; end if;
end $$;

create policy "spiritual self or leadership" on public.member_spiritual_profiles for select to authenticated using (
  member_id = (select p.member_id from public.profiles p where p.user_id=auth.uid())
  or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=member_spiritual_profiles.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
);
create policy "spiritual leadership write" on public.member_spiritual_profiles for all to authenticated using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=member_spiritual_profiles.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
) with check (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=member_spiritual_profiles.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
);

create policy "ministries readable" on public.ministries for select to authenticated using (true);
create policy "ministries managed" on public.ministries for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));

create policy "member ministries readable" on public.member_ministries for select to authenticated using (
  member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid())
  or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=member_ministries.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
);
create policy "member ministries managed" on public.member_ministries for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));

create policy "giving private read" on public.giving_records for select to authenticated using (
  member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid())
  or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
);
create policy "giving finance write" on public.giving_records for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));

create policy "followups leadership read" on public.pastoral_followups for select to authenticated using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=pastoral_followups.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
);
create policy "followups leadership write" on public.pastoral_followups for all to authenticated using (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=pastoral_followups.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
) with check (
  exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=pastoral_followups.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
);

create policy "prayers own or leaders" on public.prayer_requests for select to authenticated using (
  member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid())
  or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
  or exists (select 1 from public.profiles p join public.members m on m.id=prayer_requests.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)
);
create policy "prayers own insert" on public.prayer_requests for insert to authenticated with check (member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid()));
create policy "prayers leaders update" on public.prayer_requests for update to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')) or exists (select 1 from public.profiles p join public.members m on m.id=prayer_requests.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id)) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')) or exists (select 1 from public.profiles p join public.members m on m.id=prayer_requests.member_id where p.user_id=auth.uid() and p.role='area_leader' and p.area_id=m.area_id));
create policy "prayers own delete" on public.prayer_requests for delete to authenticated using (member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid()) or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));

create policy "registrations self or leaders" on public.event_registrations for select to authenticated using (member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid()) or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor','area_leader')));
create policy "registrations self insert" on public.event_registrations for insert to authenticated with check (member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid()));
create policy "registrations leaders update" on public.event_registrations for update to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor','area_leader'))) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor','area_leader')));
create policy "registrations own delete" on public.event_registrations for delete to authenticated using (member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid()) or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));

create policy "documents own or admin" on public.member_documents for select to authenticated using (member_id=(select p.member_id from public.profiles p where p.user_id=auth.uid()) or exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));
create policy "documents admin write" on public.member_documents for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor')));

-- Private bucket for member documents.
insert into storage.buckets(id,name,public) values ('vccf-documents','vccf-documents',false) on conflict (id) do update set public=false;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vccf documents admin upload') then
    create policy "vccf documents admin upload" on storage.objects for insert to authenticated with check (
      bucket_id='vccf-documents' and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
    );
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vccf documents authorized read') then
    create policy "vccf documents authorized read" on storage.objects for select to authenticated using (
      bucket_id='vccf-documents' and (
        exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
        or exists(select 1 from public.member_documents d join public.profiles p on p.member_id=d.member_id where p.user_id=auth.uid() and d.storage_path=name)
      )
    );
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vccf documents admin delete') then
    create policy "vccf documents admin delete" on storage.objects for delete to authenticated using (
      bucket_id='vccf-documents' and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role in ('admin','pastor'))
    );
  end if;
end $$;

-- Keep updated_at timestamps current.
create or replace function public.vccf_suite_set_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end $$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='vccf_suite_spiritual_updated') then create trigger vccf_suite_spiritual_updated before update on public.member_spiritual_profiles for each row execute function public.vccf_suite_set_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='vccf_suite_followup_updated') then create trigger vccf_suite_followup_updated before update on public.pastoral_followups for each row execute function public.vccf_suite_set_updated_at(); end if;
  if not exists(select 1 from pg_trigger where tgname='vccf_suite_prayer_updated') then create trigger vccf_suite_prayer_updated before update on public.prayer_requests for each row execute function public.vccf_suite_set_updated_at(); end if;
end $$;
