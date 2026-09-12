-- Area Leaders can manage Bible Study giving only for Bible Studies in their assigned area.
-- Admin/Pastor/Treasurer retain church-wide finance access; approval remains Admin/Pastor-only.

create or replace function public.get_bible_study_finance_sessions(p_limit integer default 30)
returns table(summary_id uuid, title text, summary_date date, area_id uuid, barangay text, attendance_count integer, member_count integer, giving_workflow_status text, batch_id uuid, batch_status text, tithe_total numeric, offering_total numeric, record_count bigint)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_role text;
  v_area_id uuid;
begin
  select p.role::text,p.area_id into v_role,v_area_id
  from public.profiles p
  where p.user_id=(select auth.uid());

  if coalesce(v_role,'') not in ('admin','pastor','treasurer','area_leader') then
    raise exception 'Bible Study finance is restricted to authorized finance staff and Area Leaders' using errcode='42501';
  end if;
  if v_role='area_leader' and v_area_id is null then
    raise exception 'Area Leader account is not assigned to an area' using errcode='42501';
  end if;

  return query
  select s.id,s.title,s.summary_date,s.area_id,s.barangay,s.attendance_count,s.member_count,
         s.giving_workflow_status,b.id,b.workflow_status,
         coalesce(sum(case when g.giving_type='Tithe' then g.amount else 0 end),0)::numeric,
         coalesce(sum(case when g.giving_type='Offering' then g.amount else 0 end),0)::numeric,
         count(g.id)
  from public.cms_service_summaries s
  left join public.bible_study_giving_batches b on b.service_summary_id=s.id
  left join public.giving_records g on g.bible_study_batch_id=b.id
  where s.summary_type='Bible Study'
    and (v_role <> 'area_leader' or s.area_id=v_area_id)
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
  v_summary public.cms_service_summaries%rowtype;
begin
  select p.role::text,p.area_id into v_role,v_area_id
  from public.profiles p
  where p.user_id=(select auth.uid());

  if coalesce(v_role,'') not in ('admin','pastor','treasurer','area_leader') then
    raise exception 'Only authorized finance staff or the assigned Area Leader can manage Bible Study giving';
  end if;

  select * into v_summary
  from public.cms_service_summaries
  where id=case when tg_op='INSERT' then new.service_summary_id else old.service_summary_id end;

  if not found or v_summary.summary_type <> 'Bible Study' then
    raise exception 'Bible Study giving must be linked to a Bible Study summary';
  end if;
  if v_role='area_leader' and (v_area_id is null or v_summary.area_id is distinct from v_area_id) then
    raise exception 'Area Leaders can manage Bible Study giving only for their assigned area';
  end if;

  if tg_op='INSERT' then
    if new.workflow_status <> 'draft' then raise exception 'Bible Study giving must start as a draft'; end if;
    if new.recorded_by is distinct from (select auth.uid()) then raise exception 'Recorder must match the signed-in account'; end if;
    new.recorded_signature_name := null;
    new.recorded_signed_at := null;
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
    new.updated_at := now();
    return new;
  end if;

  if old.workflow_status='approved' then raise exception 'Approved Bible Study giving is locked'; end if;
  if old.service_summary_id is distinct from new.service_summary_id then raise exception 'Bible Study summary cannot be changed after the batch is created'; end if;
  if old.recorded_by is distinct from new.recorded_by then raise exception 'Recorder cannot be changed'; end if;
  if old.workflow_status='submitted' and new.workflow_status='submitted' then raise exception 'Submitted Bible Study giving is locked until approval'; end if;

  if old.workflow_status='draft' and new.workflow_status='submitted' then
    if nullif(btrim(coalesce(new.recorded_signature_name,'')),'') is null then raise exception 'Recorder e-signature is required before submission'; end if;
    new.recorded_signed_at := now();
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
  elsif old.workflow_status='submitted' and new.workflow_status='approved' then
    if coalesce(v_role,'') not in ('admin','pastor') then raise exception 'Only Admin or Pastor can approve Bible Study giving'; end if;
    if nullif(btrim(coalesce(new.approved_signature_name,'')),'') is null then raise exception 'Approver e-signature is required'; end if;
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

drop policy if exists "area leader bible study giving read" on public.bible_study_giving_batches;
create policy "area leader bible study giving read" on public.bible_study_giving_batches for select to authenticated
using (
  public."current_role"()='area_leader'::public.app_role
  and exists (select 1 from public.cms_service_summaries s where s.id=bible_study_giving_batches.service_summary_id and s.summary_type='Bible Study' and s.area_id=public.current_area_id())
);

drop policy if exists "area leader bible study giving insert" on public.bible_study_giving_batches;
create policy "area leader bible study giving insert" on public.bible_study_giving_batches for insert to authenticated
with check (
  public."current_role"()='area_leader'::public.app_role
  and recorded_by=(select auth.uid())
  and workflow_status='draft'
  and exists (select 1 from public.cms_service_summaries s where s.id=bible_study_giving_batches.service_summary_id and s.summary_type='Bible Study' and s.area_id=public.current_area_id())
);

drop policy if exists "area leader bible study giving update" on public.bible_study_giving_batches;
create policy "area leader bible study giving update" on public.bible_study_giving_batches for update to authenticated
using (
  public."current_role"()='area_leader'::public.app_role
  and workflow_status='draft'
  and exists (select 1 from public.cms_service_summaries s where s.id=bible_study_giving_batches.service_summary_id and s.summary_type='Bible Study' and s.area_id=public.current_area_id())
)
with check (
  public."current_role"()='area_leader'::public.app_role
  and workflow_status in ('draft','submitted')
  and exists (select 1 from public.cms_service_summaries s where s.id=bible_study_giving_batches.service_summary_id and s.summary_type='Bible Study' and s.area_id=public.current_area_id())
);

drop policy if exists "area leader giving insert" on public.giving_records;
create policy "area leader giving insert" on public.giving_records for insert to authenticated
with check (
  public."current_role"()='area_leader'::public.app_role
  and sunday_batch_id is null
  and bible_study_batch_id is null
  and recorded_by=(select auth.uid())
  and exists (select 1 from public.members m where m.id=giving_records.member_id and m.area_id=public.current_area_id())
);

drop policy if exists "giving finance read" on public.giving_records;
create policy "giving finance read" on public.giving_records for select to authenticated
using (
  public.finance_access()
  or (
    public."current_role"()='area_leader'::public.app_role
    and (
      (bible_study_batch_id is null and exists (select 1 from public.members m where m.id=giving_records.member_id and m.area_id=public.current_area_id()))
      or
      (bible_study_batch_id is not null and exists (
        select 1 from public.bible_study_giving_batches b
        join public.cms_service_summaries s on s.id=b.service_summary_id
        where b.id=giving_records.bible_study_batch_id and s.summary_type='Bible Study' and s.area_id=public.current_area_id()
      ))
    )
  )
);

drop policy if exists "area leader bible study record insert" on public.giving_records;
create policy "area leader bible study record insert" on public.giving_records for insert to authenticated
with check (
  public."current_role"()='area_leader'::public.app_role
  and sunday_batch_id is null
  and bible_study_batch_id is not null
  and recorded_by=(select auth.uid())
  and (member_id is null or exists (select 1 from public.members m where m.id=giving_records.member_id and m.area_id=public.current_area_id()))
  and exists (
    select 1 from public.bible_study_giving_batches b
    join public.cms_service_summaries s on s.id=b.service_summary_id
    where b.id=giving_records.bible_study_batch_id and b.workflow_status='draft' and s.summary_type='Bible Study' and s.area_id=public.current_area_id()
  )
);

drop policy if exists "area leader bible study record update" on public.giving_records;
create policy "area leader bible study record update" on public.giving_records for update to authenticated
using (
  public."current_role"()='area_leader'::public.app_role
  and bible_study_batch_id is not null
  and exists (
    select 1 from public.bible_study_giving_batches b
    join public.cms_service_summaries s on s.id=b.service_summary_id
    where b.id=giving_records.bible_study_batch_id and b.workflow_status='draft' and s.summary_type='Bible Study' and s.area_id=public.current_area_id()
  )
)
with check (
  public."current_role"()='area_leader'::public.app_role
  and sunday_batch_id is null
  and bible_study_batch_id is not null
  and (member_id is null or exists (select 1 from public.members m where m.id=giving_records.member_id and m.area_id=public.current_area_id()))
  and exists (
    select 1 from public.bible_study_giving_batches b
    join public.cms_service_summaries s on s.id=b.service_summary_id
    where b.id=giving_records.bible_study_batch_id and b.workflow_status='draft' and s.summary_type='Bible Study' and s.area_id=public.current_area_id()
  )
);

drop policy if exists "area leader bible study record delete" on public.giving_records;
create policy "area leader bible study record delete" on public.giving_records for delete to authenticated
using (
  public."current_role"()='area_leader'::public.app_role
  and bible_study_batch_id is not null
  and exists (
    select 1 from public.bible_study_giving_batches b
    join public.cms_service_summaries s on s.id=b.service_summary_id
    where b.id=giving_records.bible_study_batch_id and b.workflow_status='draft' and s.summary_type='Bible Study' and s.area_id=public.current_area_id()
  )
);
