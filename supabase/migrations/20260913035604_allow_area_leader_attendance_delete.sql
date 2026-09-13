-- Allow Area Leaders to delete attendance records only inside their assigned area.
-- Admin delete access remains governed by the existing attendance_admin_delete policy.

create policy "attendance_area_leader_delete"
on public.attendance
for delete
to authenticated
using (
  "current_role"() = 'area_leader'::app_role
  and area_id = current_area_id()
);
