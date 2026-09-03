-- Event attendance is tracked on the event registration roster and remains
-- separate from Sunday worship attendance.

alter table public.church_event_registrations
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id) on delete set null,
  add column if not exists check_in_source text;

alter table public.church_events
  add column if not exists participation_mode text;

update public.church_events
set participation_mode = case when registration_required then 'registration_required' else 'registration_optional' end
where participation_mode is null;

alter table public.church_events
  alter column participation_mode set default 'registration_optional',
  alter column participation_mode set not null;

alter table public.church_events
  drop constraint if exists church_events_participation_mode_check;

alter table public.church_events
  add constraint church_events_participation_mode_check
  check (participation_mode in ('registration_required','registration_optional','attendance_only'));

create index if not exists church_event_registrations_attendance_idx
  on public.church_event_registrations (event_id, checked_in_at)
  where checked_in_at is not null;

drop policy if exists "church_event_registrations_read" on public.church_event_registrations;
drop policy if exists "church_event_registrations_insert" on public.church_event_registrations;
drop policy if exists "church_event_registrations_update" on public.church_event_registrations;
drop policy if exists "church_event_registrations_delete" on public.church_event_registrations;

create policy "church_event_registrations_read"
on public.church_event_registrations for select to authenticated
using (
  member_id = (select p.member_id from public.profiles p where p.user_id = (select auth.uid()))
  or exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.church_events e
    join public.profiles p on p.user_id = (select auth.uid())
    where e.id = church_event_registrations.event_id
      and p.role::text = 'area_leader'
      and p.area_id = e.area_id
  )
);

create policy "church_event_registrations_insert"
on public.church_event_registrations for insert to authenticated
with check (
  member_id = (select p.member_id from public.profiles p where p.user_id = (select auth.uid()))
  or exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.church_events e
    join public.profiles p on p.user_id = (select auth.uid())
    where e.id = church_event_registrations.event_id
      and p.role::text = 'area_leader'
      and p.area_id = e.area_id
  )
);

create policy "church_event_registrations_update"
on public.church_event_registrations for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.church_events e
    join public.profiles p on p.user_id = (select auth.uid())
    where e.id = church_event_registrations.event_id
      and p.role::text = 'area_leader'
      and p.area_id = e.area_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.church_events e
    join public.profiles p on p.user_id = (select auth.uid())
    where e.id = church_event_registrations.event_id
      and p.role::text = 'area_leader'
      and p.area_id = e.area_id
  )
);

create policy "church_event_registrations_delete"
on public.church_event_registrations for delete to authenticated
using (
  member_id = (select p.member_id from public.profiles p where p.user_id = (select auth.uid()))
  or exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.church_events e
    join public.profiles p on p.user_id = (select auth.uid())
    where e.id = church_event_registrations.event_id
      and p.role::text = 'area_leader'
      and p.area_id = e.area_id
  )
);

grant select, insert, update, delete on public.church_event_registrations to authenticated;
