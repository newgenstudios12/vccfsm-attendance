-- Restricted Worship Ministry modules: minister scheduling and worship line-ups.
-- Access is limited to authenticated members assigned to Worship, Creative Arts,
-- Music, or Band ministry aliases. Guests/anon receive no table privileges.

insert into public.ministries(name, description, is_active)
values ('Band Ministry', 'Band and instrumental ministry', true)
on conflict (name) do update set is_active = true;

create table if not exists public.worship_service_schedules (
  id uuid primary key default gen_random_uuid(),
  service_date date not null unique,
  service_name text not null default 'Sunday Worship Service',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worship_schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.worship_service_schedules(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  ministry_role text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique(schedule_id, member_id, ministry_role)
);

create table if not exists public.worship_lineups (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null unique references public.worship_service_schedules(id) on delete cascade,
  worship_leader_member_id uuid references public.members(id) on delete set null,
  status text not null default 'Draft' check (status in ('Draft','Submitted','Approved','Needs Revision')),
  offertory_title text,
  offertory_artist text,
  offertory_key text,
  offertory_reference_url text,
  offertory_notes text,
  revision_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worship_lineup_songs (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.worship_lineups(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  title text not null,
  artist text,
  song_key text,
  reference_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique(lineup_id, position)
);

create index if not exists worship_schedule_date_idx on public.worship_service_schedules(service_date desc);
create index if not exists worship_assignments_schedule_idx on public.worship_schedule_assignments(schedule_id, ministry_role);
create index if not exists worship_assignments_member_idx on public.worship_schedule_assignments(member_id, schedule_id);
create index if not exists worship_lineups_schedule_idx on public.worship_lineups(schedule_id, status);
create index if not exists worship_lineup_songs_lineup_idx on public.worship_lineup_songs(lineup_id, position);

alter table public.worship_service_schedules enable row level security;
alter table public.worship_schedule_assignments enable row level security;
alter table public.worship_lineups enable row level security;
alter table public.worship_lineup_songs enable row level security;

revoke all on public.worship_service_schedules from anon;
revoke all on public.worship_schedule_assignments from anon;
revoke all on public.worship_lineups from anon;
revoke all on public.worship_lineup_songs from anon;
grant select, insert, update, delete on public.worship_service_schedules to authenticated;
grant select, insert, update, delete on public.worship_schedule_assignments to authenticated;
grant select, insert, update, delete on public.worship_lineups to authenticated;
grant select, insert, update, delete on public.worship_lineup_songs to authenticated;

do $$ begin
  drop policy if exists "worship schedules team read" on public.worship_service_schedules;
  drop policy if exists "worship schedules manager write" on public.worship_service_schedules;
  drop policy if exists "worship assignments team read" on public.worship_schedule_assignments;
  drop policy if exists "worship assignments manager write" on public.worship_schedule_assignments;
  drop policy if exists "worship lineups team read" on public.worship_lineups;
  drop policy if exists "worship lineups leader insert" on public.worship_lineups;
  drop policy if exists "worship lineups leader update" on public.worship_lineups;
  drop policy if exists "worship lineups manager delete" on public.worship_lineups;
  drop policy if exists "worship songs team read" on public.worship_lineup_songs;
  drop policy if exists "worship songs leader insert" on public.worship_lineup_songs;
  drop policy if exists "worship songs leader update" on public.worship_lineup_songs;
  drop policy if exists "worship songs leader delete" on public.worship_lineup_songs;
end $$;

create policy "worship schedules team read"
on public.worship_service_schedules for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

create policy "worship schedules manager write"
on public.worship_service_schedules for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (lower(p.role::text) in ('admin','pastor') or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (lower(p.role::text) in ('admin','pastor') or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)')
  )
);

create policy "worship assignments team read"
on public.worship_schedule_assignments for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

create policy "worship assignments manager write"
on public.worship_schedule_assignments for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (lower(p.role::text) in ('admin','pastor') or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (lower(p.role::text) in ('admin','pastor') or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)')
  )
);

create policy "worship lineups team read"
on public.worship_lineups for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

create policy "worship lineups leader insert"
on public.worship_lineups for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=worship_lineups.schedule_id
            and wa.member_id=p.member_id
            and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

create policy "worship lineups leader update"
on public.worship_lineups for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=worship_lineups.schedule_id
            and wa.member_id=p.member_id
            and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
)
with check (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=worship_lineups.schedule_id
            and wa.member_id=p.member_id
            and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

create policy "worship lineups manager delete"
on public.worship_lineups for delete to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (lower(p.role::text) in ('admin','pastor') or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)')
  )
);

create policy "worship songs team read"
on public.worship_lineup_songs for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where p.user_id=(select auth.uid())
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
  )
);

create policy "worship songs leader insert"
on public.worship_lineup_songs for insert to authenticated
with check (
  exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

create policy "worship songs leader update"
on public.worship_lineup_songs for update to authenticated
using (
  exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
)
with check (
  exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);

create policy "worship songs leader delete"
on public.worship_lineup_songs for delete to authenticated
using (
  exists (
    select 1 from public.worship_lineups wl
    join public.profiles p on p.user_id=(select auth.uid())
    join public.member_ministries mm on mm.member_id=p.member_id
    join public.ministries mn on mn.id=mm.ministry_id
    where wl.id=worship_lineup_songs.lineup_id
      and lower(trim(mn.name)) in ('worship','worship ministry','creative ministry','creative arts','creative arts ministry','music','music ministry','band','band ministry')
      and (
        lower(p.role::text) in ('admin','pastor')
        or lower(coalesce(mm.role_title,'')) ~ '(leader|head|coordinator|director)'
        or exists (
          select 1 from public.worship_schedule_assignments wa
          where wa.schedule_id=wl.schedule_id and wa.member_id=p.member_id and lower(trim(wa.ministry_role))='worship leader'
        )
      )
  )
);
