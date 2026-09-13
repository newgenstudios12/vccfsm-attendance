-- Allow Area Leaders to delete member records only inside their assigned area.
-- Admin delete access remains church-wide.
drop policy if exists "members_admin_delete" on public.members;
drop policy if exists "members_admin_area_leader_delete" on public.members;

create policy "members_admin_area_leader_delete"
on public.members
for delete
to authenticated
using (
  public.current_role() = 'admin'::public.app_role
  or (
    public.current_role() = 'area_leader'::public.app_role
    and public.current_area_id() is not null
    and area_id = public.current_area_id()
  )
);
