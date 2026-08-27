drop policy if exists special_event_attendance_role_select on public.special_event_attendance;
drop policy if exists special_event_attendance_role_insert on public.special_event_attendance;

create policy special_event_attendance_role_select
on public.special_event_attendance
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (
        lower(p.role::text) = 'admin'
        or (lower(p.role::text) in ('area_leader','area leader','leader') and public.special_event_attendance.area_id = p.area_id)
        or (lower(p.role::text) = 'member' and public.special_event_attendance.member_id = p.member_id)
      )
  )
);

create policy special_event_attendance_role_insert
on public.special_event_attendance
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and (
        lower(p.role::text) = 'admin'
        or (lower(p.role::text) in ('area_leader','area leader','leader') and public.special_event_attendance.area_id = p.area_id)
        or (lower(p.role::text) = 'member' and public.special_event_attendance.member_id = p.member_id)
      )
  )
);
