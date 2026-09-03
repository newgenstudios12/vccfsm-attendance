create or replace function public.cms_guard_sunday_summary_workflow()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.user_id = (select auth.uid());

  if tg_op = 'INSERT' then
    if coalesce(new.workflow_status,'draft') <> 'draft' then
      raise exception 'A Sunday summary must start as a draft';
    end if;
    new.workflow_status := 'draft';
    new.updated_at := now();

    if coalesce(v_role,'') not in ('admin','pastor') and
       (coalesce(new.tithe_total,0) <> 0 or coalesce(new.offering_total,0) <> 0) then
      raise exception 'Only Pastor or Admin can enter tithes and offerings';
    end if;

    return new;
  end if;

  if old.workflow_status = 'posted' then
    raise exception 'A posted Sunday summary is locked';
  end if;

  if coalesce(v_role,'') not in ('admin','pastor') and
     (new.tithe_total is distinct from old.tithe_total or
      new.offering_total is distinct from old.offering_total) then
    raise exception 'Only Pastor or Admin can enter tithes and offerings';
  end if;

  if old.workflow_status = 'draft' and new.workflow_status = 'posted' then
    raise exception 'Submit the Sunday summary before posting it';
  end if;

  if old.workflow_status = 'draft' and new.workflow_status = 'submitted' then
    new.submitted_at := now();
    new.submitted_by := (select auth.uid());
  elsif old.workflow_status = 'submitted' and new.workflow_status = 'posted' then
    if coalesce(v_role,'') not in ('admin','pastor') then
      raise exception 'Only Pastor or Admin can post a submitted Sunday summary';
    end if;
    new.posted_at := now();
    new.posted_by := (select auth.uid());
  elsif new.workflow_status is distinct from old.workflow_status then
    raise exception 'Invalid Sunday summary workflow transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
