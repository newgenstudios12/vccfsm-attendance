-- Align member information and account roles with the VCCF Connect access model.

-- Keep historical enum labels for backwards-safe migration history, while
-- preventing legacy roles from being assigned again.
update public.profiles
set role='member'::public.app_role
where role::text in ('guest','ministry_leader');

alter table public.profiles drop constraint if exists profiles_supported_role_check;
alter table public.profiles add constraint profiles_supported_role_check
  check (role::text in ('admin','pastor','area_leader','member'));

drop policy if exists "members_select_authenticated" on public.members;
drop policy if exists "members_select_scoped" on public.members;
create policy "members_select_scoped" on public.members for select to authenticated using (
  public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (public.current_role()='area_leader'::public.app_role and area_id=public.current_area_id())
  or (public.current_role()='member'::public.app_role and id=public.current_member_id())
);

drop policy if exists "members_pastor_insert" on public.members;
create policy "members_pastor_insert" on public.members for insert to authenticated with check (
  public.current_role()='pastor'::public.app_role
);

drop policy if exists "members_pastor_update" on public.members;
create policy "members_pastor_update" on public.members for update to authenticated using (
  public.current_role()='pastor'::public.app_role
) with check (
  public.current_role()='pastor'::public.app_role
);

drop policy if exists "attendance_select_scoped" on public.attendance;
create policy "attendance_select_scoped" on public.attendance for select to authenticated using (
  public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (public.current_role()='area_leader'::public.app_role and area_id=public.current_area_id())
  or (public.current_role()='member'::public.app_role and member_id=public.current_member_id())
);

drop policy if exists "attendance_insert_scoped" on public.attendance;
create policy "attendance_insert_scoped" on public.attendance for insert to authenticated with check (
  public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (public.current_role()='area_leader'::public.app_role and area_id=public.current_area_id())
  or (public.current_role()='member'::public.app_role and member_id=public.current_member_id())
);

drop policy if exists "giving private read" on public.giving_records;
create policy "giving private read" on public.giving_records for select to authenticated using (
  member_id=public.current_member_id()
  or public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (
    public.current_role()='area_leader'::public.app_role
    and exists(
      select 1 from public.members m
      where m.id=giving_records.member_id and m.area_id=public.current_area_id()
    )
  )
);
