-- Give every authenticated member assigned to the Treasurer ministry the same
-- Tithes & Offerings encoding access as the Treasurer account role.
-- Admin/Pastor approval remains required for submitted Sunday giving.

create or replace function public.finance_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    public."current_role"() = any (
      array[
        'admin'::public.app_role,
        'pastor'::public.app_role,
        'treasurer'::public.app_role
      ]
    )
    or exists (
      select 1
      from public.profiles p
      join public.member_ministries mm on mm.member_id = p.member_id
      join public.ministries m on m.id = mm.ministry_id
      where p.user_id = (select auth.uid())
        and m.is_active is not false
        and lower(trim(m.name)) in (
          'treasurer',
          'treasurer ministry',
          'treasury',
          'treasury ministry'
        )
    ),
    false
  );
$function$;

create or replace function public.guard_sunday_giving_batch()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_role text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.user_id = (select auth.uid());

  if not public.finance_access() then
    raise exception 'Only authorized finance users can manage Sunday giving';
  end if;

  if tg_op = 'INSERT' then
    if new.workflow_status <> 'draft' then
      raise exception 'Sunday giving must start as a draft';
    end if;
    if new.recorded_by is distinct from (select auth.uid()) then
      raise exception 'Recorder must match the signed-in account';
    end if;
    if exists (
      select 1
      from public.cms_sunday_event_summaries s
      where s.summary_type = 'sunday'
        and s.summary_date = new.sunday_date
        and s.workflow_status = 'posted'
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

  if old.workflow_status = 'approved' then
    raise exception 'Approved Sunday giving is locked';
  end if;

  if old.sunday_date is distinct from new.sunday_date then
    raise exception 'Sunday date cannot be changed after the batch is created';
  end if;

  if old.recorded_by is distinct from new.recorded_by then
    raise exception 'Recorder cannot be changed';
  end if;

  if old.workflow_status = 'submitted' and new.workflow_status = 'submitted' then
    raise exception 'Submitted Sunday giving is locked until approval';
  end if;

  if old.workflow_status = 'draft' and new.workflow_status = 'submitted' then
    if nullif(btrim(coalesce(new.recorded_signature_name, '')), '') is null then
      raise exception 'Recorder e-signature is required before submission';
    end if;
    new.recorded_signed_at := now();
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
  elsif old.workflow_status = 'submitted' and new.workflow_status = 'approved' then
    if coalesce(v_role, '') not in ('admin', 'pastor') then
      raise exception 'Only Admin or Pastor can approve Sunday giving';
    end if;
    if nullif(btrim(coalesce(new.approved_signature_name, '')), '') is null then
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
