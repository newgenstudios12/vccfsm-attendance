-- Align Bible Study finance with the church-wide finance_access() rule.
-- This allows members assigned to an active Treasurer/Treasury ministry to
-- view and manage Bible Study giving without changing their account role.
-- Area Leaders remain limited to their assigned Area unless they also have
-- church-wide finance_access(). Admin/Pastor approval remains unchanged.

create or replace function public.get_bible_study_finance_sessions(p_limit integer default 30)
returns table(
  summary_id uuid,
  title text,
  summary_date date,
  area_id uuid,
  barangay text,
  attendance_count integer,
  member_count integer,
  giving_workflow_status text,
  batch_id uuid,
  batch_status text,
  tithe_total numeric,
  offering_total numeric,
  record_count bigint
)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text;
  v_area_id uuid;
  v_finance_access boolean;
begin
  select p.role::text,p.area_id into v_role,v_area_id
  from public.profiles p
  where p.user_id=(select auth.uid());

  v_finance_access := public.finance_access();

  if not v_finance_access and coalesce(v_role,'') <> 'area_leader' then
    raise exception 'Bible Study finance is restricted to authorized finance staff and Area Leaders' using errcode='42501';
  end if;

  if not v_finance_access and v_role='area_leader' and v_area_id is null then
    raise exception 'Area Leader account is not assigned to an area' using errcode='42501';
  end if;

  return query
  select s.id,
         s.title,
         s.summary_date,
         s.area_id,
         s.barangay,
         s.attendance_count,
         s.member_count,
         s.giving_workflow_status,
         b.id,
         b.workflow_status,
         coalesce(sum(case when lower(coalesce(g.giving_type,''))='tithe' then g.amount else 0 end),0)::numeric,
         coalesce(sum(case when lower(coalesce(g.giving_type,''))='offering' then g.amount else 0 end),0)::numeric,
         count(g.id)
  from public.cms_service_summaries s
  left join public.bible_study_giving_batches b on b.service_summary_id=s.id
  left join public.giving_records g on g.bible_study_batch_id=b.id
  where s.summary_type='Bible Study'
    and (
      v_finance_access
      or (v_role='area_leader' and s.area_id=v_area_id)
    )
  group by s.id,s.title,s.summary_date,s.area_id,s.barangay,s.attendance_count,s.member_count,s.giving_workflow_status,b.id,b.workflow_status,s.created_at
  order by s.summary_date desc,s.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),100));
end;
$function$;

create or replace function public.guard_bible_study_giving_batch()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text;
  v_area_id uuid;
  v_finance_access boolean;
  v_summary public.cms_service_summaries%rowtype;
begin
  select p.role::text,p.area_id into v_role,v_area_id
  from public.profiles p
  where p.user_id=(select auth.uid());

  v_finance_access := public.finance_access();

  if not v_finance_access and coalesce(v_role,'') <> 'area_leader' then
    raise exception 'Only authorized finance staff or the assigned Area Leader can manage Bible Study giving';
  end if;

  select * into v_summary
  from public.cms_service_summaries
  where id=case when tg_op='INSERT' then new.service_summary_id else old.service_summary_id end;

  if not found or v_summary.summary_type <> 'Bible Study' then
    raise exception 'Bible Study giving must be linked to a Bible Study summary';
  end if;

  if not v_finance_access and v_role='area_leader'
     and (v_area_id is null or v_summary.area_id is distinct from v_area_id) then
    raise exception 'Area Leaders can manage Bible Study giving only for their assigned area';
  end if;

  if tg_op='INSERT' then
    if new.workflow_status <> 'draft' then
      raise exception 'Bible Study giving must start as a draft';
    end if;
    if new.recorded_by is distinct from (select auth.uid()) then
      raise exception 'Recorder must match the signed-in account';
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
    raise exception 'Approved Bible Study giving is locked';
  end if;
  if old.service_summary_id is distinct from new.service_summary_id then
    raise exception 'Bible Study summary cannot be changed after the batch is created';
  end if;
  if old.recorded_by is distinct from new.recorded_by then
    raise exception 'Recorder cannot be changed';
  end if;
  if old.workflow_status='submitted' and new.workflow_status='submitted' then
    raise exception 'Submitted Bible Study giving is locked until approval';
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
      raise exception 'Only Admin or Pastor can approve Bible Study giving';
    end if;
    if nullif(btrim(coalesce(new.approved_signature_name,'')),'') is null then
      raise exception 'Approver e-signature is required';
    end if;
    new.approved_by := (select auth.uid());
    new.approved_at := now();
  elsif new.workflow_status is distinct from old.workflow_status then
    raise exception 'Invalid Bible Study giving workflow transition';
  end if;

  if new.workflow_status <> 'approved' then
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

-- Finance-wide policies now use the same finance_access() helper as ordinary giving.
drop policy if exists "bible study giving finance read" on public.bible_study_giving_batches;
create policy "bible study giving finance read"
on public.bible_study_giving_batches for select
to authenticated
using (public.finance_access());

drop policy if exists "bible study giving finance insert" on public.bible_study_giving_batches;
create policy "bible study giving finance insert"
on public.bible_study_giving_batches for insert
to authenticated
with check (
  public.finance_access()
  and recorded_by=(select auth.uid())
  and workflow_status='draft'
);

drop policy if exists "bible study giving finance update" on public.bible_study_giving_batches;
create policy "bible study giving finance update"
on public.bible_study_giving_batches for update
to authenticated
using (public.finance_access())
with check (public.finance_access());

drop policy if exists "bible study giving finance delete draft" on public.bible_study_giving_batches;
create policy "bible study giving finance delete draft"
on public.bible_study_giving_batches for delete
to authenticated
using (
  public.finance_access()
  and workflow_status='draft'
);

revoke all on function public.get_bible_study_finance_sessions(integer) from public,anon;
grant execute on function public.get_bible_study_finance_sessions(integer) to authenticated;
