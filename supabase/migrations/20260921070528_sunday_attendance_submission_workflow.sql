create table if not exists public.sunday_attendance_submissions (
  id uuid primary key default gen_random_uuid(),
  sunday_date date not null,
  area_id uuid not null references public.areas(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','reopened')),
  active_member_count integer not null default 0 check (active_member_count >= 0),
  present_count integer not null default 0 check (present_count >= 0),
  absent_count integer not null default 0 check (absent_count >= 0),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint sunday_attendance_submissions_area_date_key unique (sunday_date, area_id),
  constraint sunday_attendance_submissions_counts_check
    check (present_count + absent_count = active_member_count)
);

create index if not exists sunday_attendance_submissions_date_idx
  on public.sunday_attendance_submissions (sunday_date desc);

create index if not exists sunday_attendance_submissions_area_idx
  on public.sunday_attendance_submissions (area_id, sunday_date desc);

alter table public.sunday_attendance_submissions enable row level security;

grant select, insert, update on public.sunday_attendance_submissions to authenticated;
revoke all on public.sunday_attendance_submissions from anon;

drop policy if exists "sunday attendance submission read" on public.sunday_attendance_submissions;
create policy "sunday attendance submission read"
on public.sunday_attendance_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and p.area_id = sunday_attendance_submissions.area_id)
        or (
          p.member_id is not null
          and exists (
            select 1
            from public.members m
            where m.id = p.member_id
              and m.area_id = sunday_attendance_submissions.area_id
          )
        )
      )
  )
);

drop policy if exists "sunday attendance submission staff insert" on public.sunday_attendance_submissions;
create policy "sunday attendance submission staff insert"
on public.sunday_attendance_submissions
for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and status = 'submitted'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and p.area_id = sunday_attendance_submissions.area_id)
      )
  )
);

drop policy if exists "sunday attendance submission leader resubmit" on public.sunday_attendance_submissions;
create policy "sunday attendance submission leader resubmit"
on public.sunday_attendance_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text = 'area_leader'
      and p.area_id = sunday_attendance_submissions.area_id
  )
)
with check (
  status = 'submitted'
  and submitted_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text = 'area_leader'
      and p.area_id = sunday_attendance_submissions.area_id
  )
);

drop policy if exists "sunday attendance submission staff update" on public.sunday_attendance_submissions;
create policy "sunday attendance submission staff update"
on public.sunday_attendance_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role::text in ('admin','pastor')
  )
);
