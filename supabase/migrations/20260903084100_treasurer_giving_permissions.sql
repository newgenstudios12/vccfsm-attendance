-- Treasurer finance permissions.
-- Treasurer remains Member-like outside Tithes & Offerings.
-- Treasurer may encode/edit giving and prepare/sign Sunday giving.
-- Only Admin/Pastor may approve Sunday giving.

drop policy if exists "giving finance write" on public.giving_records;
create policy "giving finance write"
on public.giving_records for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
);

drop policy if exists "giving private read" on public.giving_records;
create policy "giving private read"
on public.giving_records for select
to authenticated
using (
  member_id=public.current_member_id()
  or public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role,'treasurer'::public.app_role)
  or (
    public.current_role()='area_leader'::public.app_role
    and exists (
      select 1 from public.members m
      where m.id=giving_records.member_id
        and m.area_id=public.current_area_id()
    )
  )
);

drop policy if exists "sunday_giving_finance_read" on public.sunday_giving_batches;
drop policy if exists "sunday_giving_finance_insert" on public.sunday_giving_batches;
drop policy if exists "sunday_giving_finance_update" on public.sunday_giving_batches;
drop policy if exists "sunday_giving_finance_delete_draft" on public.sunday_giving_batches;

create policy "sunday_giving_finance_read"
on public.sunday_giving_batches for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
);

create policy "sunday_giving_finance_insert"
on public.sunday_giving_batches for insert
to authenticated
with check (
  recorded_by=(select auth.uid())
  and workflow_status='draft'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
);

create policy "sunday_giving_finance_update"
on public.sunday_giving_batches for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
);

create policy "sunday_giving_finance_delete_draft"
on public.sunday_giving_batches for delete
to authenticated
using (
  workflow_status='draft'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
);

create or replace function public.guard_sunday_giving_batch()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_role text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.user_id=(select auth.uid());

  if coalesce(v_role,'') not in ('admin','pastor','treasurer') then
    raise exception 'Only Admin, Pastor, or Treasurer can manage Sunday giving';
  end if;

  if tg_op='INSERT' then
    if new.workflow_status <> 'draft' then
      raise exception 'Sunday giving must start as a draft';
    end if;
    if new.recorded_by is distinct from (select auth.uid()) then
      raise exception 'Recorder must match the signed-in account';
    end if;
    if exists (
      select 1 from public.cms_sunday_event_summaries s
      where s.summary_type='sunday'
        and s.summary_date=new.sunday_date
        and s.workflow_status='posted'
    ) then
      raise exception 'Sunday giving cannot be created after the Sunday summary is posted';
    end if;
    new.recorded_signature_name := null;
    new.recorded_signed_at := null;
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
    new.updated_at := now();
    return new;
  end if;

  if old.workflow_status='approved' then
    raise exception 'Approved Sunday giving is locked';
  end if;

  if old.sunday_date is distinct from new.sunday_date then
    raise exception 'Sunday date cannot be changed after the batch is created';
  end if;

  if old.recorded_by is distinct from new.recorded_by then
    raise exception 'Recorder cannot be changed';
  end if;

  if old.workflow_status='submitted' and new.workflow_status='submitted' then
    raise exception 'Submitted Sunday giving is locked until approval';
  end if;

  if old.workflow_status='draft' and new.workflow_status='submitted' then
    if nullif(btrim(coalesce(new.recorded_signature_name,'')),'') is null then
      raise exception 'Recorder e-signature is required before submission';
    end if;
    new.recorded_signed_at := now();
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
  elsif old.workflow_status='submitted' and new.workflow_status='approved' then
    if coalesce(v_role,'') not in ('admin','pastor') then
      raise exception 'Only Admin or Pastor can approve Sunday giving';
    end if;
    if nullif(btrim(coalesce(new.approved_signature_name,'')),'') is null then
      raise exception 'Approver e-signature is required';
    end if;
    new.approved_by := (select auth.uid());
    new.approved_at := now();
  elsif new.workflow_status is distinct from old.workflow_status then
    raise exception 'Invalid Sunday giving workflow transition';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop policy if exists "attendance_insert_scoped" on public.attendance;
create policy "attendance_insert_scoped"
on public.attendance for insert
to authenticated
with check (
  public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (public.current_role()='area_leader'::public.app_role and area_id=public.current_area_id())
  or (public.current_role() in ('member'::public.app_role,'treasurer'::public.app_role) and member_id=public.current_member_id())
);

drop policy if exists "attendance_select_scoped" on public.attendance;
create policy "attendance_select_scoped"
on public.attendance for select
to authenticated
using (
  public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (public.current_role()='area_leader'::public.app_role and area_id=public.current_area_id())
  or (public.current_role() in ('member'::public.app_role,'treasurer'::public.app_role) and member_id=public.current_member_id())
);

drop policy if exists "members_select_scoped" on public.members;
create policy "members_select_scoped"
on public.members for select
to authenticated
using (
  public.current_role() in ('admin'::public.app_role,'pastor'::public.app_role)
  or (public.current_role()='area_leader'::public.app_role and area_id=public.current_area_id())
  or (public.current_role() in ('member'::public.app_role,'treasurer'::public.app_role) and id=public.current_member_id())
);

drop policy if exists "members_self_update_photo" on public.members;
create policy "members_self_update_photo"
on public.members for update
to authenticated
using (
  public.current_role() in ('member'::public.app_role,'treasurer'::public.app_role)
  and id=public.current_member_id()
)
with check (
  public.current_role() in ('member'::public.app_role,'treasurer'::public.app_role)
  and id=public.current_member_id()
);

drop policy if exists "special_event_attendance_role_insert" on public.special_event_attendance;
create policy "special_event_attendance_role_insert"
on public.special_event_attendance for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and (
        lower(p.role::text)='admin'
        or (lower(p.role::text) in ('area_leader','area leader','leader') and special_event_attendance.area_id=p.area_id)
        or (lower(p.role::text) in ('member','treasurer') and special_event_attendance.member_id=p.member_id)
      )
  )
);

drop policy if exists "special_event_attendance_role_select" on public.special_event_attendance;
create policy "special_event_attendance_role_select"
on public.special_event_attendance for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and (
        lower(p.role::text)='admin'
        or (lower(p.role::text) in ('area_leader','area leader','leader') and special_event_attendance.area_id=p.area_id)
        or (lower(p.role::text) in ('member','treasurer') and special_event_attendance.member_id=p.member_id)
      )
  )
);

create or replace function private.get_giving_member_directory()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  member_code text,
  area_id uuid,
  is_active boolean,
  status text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select m.id,m.display_name,m.first_name,m.last_name,m.member_code,m.area_id,m.is_active,m.status
  from public.members m
  where exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text in ('admin','pastor','treasurer')
  )
  order by coalesce(m.display_name,m.first_name,m.member_code),m.last_name;
$function$;

revoke all on function private.get_giving_member_directory() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.get_giving_member_directory() to authenticated;

create or replace function public.get_giving_member_directory()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  member_code text,
  area_id uuid,
  is_active boolean,
  status text
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select * from private.get_giving_member_directory();
$function$;

revoke all on function public.get_giving_member_directory() from public,anon;
grant execute on function public.get_giving_member_directory() to authenticated;
