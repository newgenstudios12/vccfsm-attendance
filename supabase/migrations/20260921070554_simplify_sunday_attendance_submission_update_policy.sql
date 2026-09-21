drop policy if exists "sunday attendance submission leader resubmit" on public.sunday_attendance_submissions;
drop policy if exists "sunday attendance submission staff update" on public.sunday_attendance_submissions;

create policy "sunday attendance submission update"
on public.sunday_attendance_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.role::text in ('admin','pastor')
        or (p.role::text = 'area_leader' and p.area_id = sunday_attendance_submissions.area_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        p.role::text in ('admin','pastor')
        or (
          p.role::text = 'area_leader'
          and p.area_id = sunday_attendance_submissions.area_id
          and sunday_attendance_submissions.status = 'submitted'
          and sunday_attendance_submissions.submitted_by = (select auth.uid())
        )
      )
  )
);
