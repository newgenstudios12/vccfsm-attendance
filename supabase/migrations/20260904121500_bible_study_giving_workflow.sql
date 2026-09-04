alter table public.cms_service_summaries
  add column if not exists giving_workflow_status text not null default 'not_started';

alter table public.cms_service_summaries
  drop constraint if exists cms_service_summaries_giving_workflow_status_check;
alter table public.cms_service_summaries
  add constraint cms_service_summaries_giving_workflow_status_check
  check (giving_workflow_status = any (array['not_started'::text,'draft'::text,'submitted'::text,'approved'::text]));

create table if not exists public.bible_study_giving_batches (
  id uuid primary key default gen_random_uuid(),
  service_summary_id uuid not null unique references public.cms_service_summaries(id) on delete restrict,
  workflow_status text not null default 'draft' check (workflow_status = any (array['draft'::text,'submitted'::text,'approved'::text])),
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_signature_name text,
  recorded_signed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_signature_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.giving_records
  add column if not exists bible_study_batch_id uuid references public.bible_study_giving_batches(id) on delete set null;

alter table public.giving_records
  drop constraint if exists giving_records_single_batch_check;
alter table public.giving_records
  add constraint giving_records_single_batch_check
  check (num_nonnulls(sunday_batch_id,bible_study_batch_id) <= 1);

create index if not exists giving_records_bible_study_batch_idx
  on public.giving_records(bible_study_batch_id)
  where bible_study_batch_id is not null;
create index if not exists bible_study_giving_batches_status_idx
  on public.bible_study_giving_batches(workflow_status,updated_at desc);

alter table public.bible_study_giving_batches enable row level security;

drop policy if exists "bible study giving finance read" on public.bible_study_giving_batches;
create policy "bible study giving finance read"
on public.bible_study_giving_batches for select
to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.role::text = any(array['admin','pastor','treasurer'])
));

drop policy if exists "bible study giving finance insert" on public.bible_study_giving_batches;
create policy "bible study giving finance insert"
on public.bible_study_giving_batches for insert
to authenticated
with check (
  recorded_by=(select auth.uid())
  and workflow_status='draft'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text = any(array['admin','pastor','treasurer'])
  )
);

drop policy if exists "bible study giving finance update" on public.bible_study_giving_batches;
create policy "bible study giving finance update"
on public.bible_study_giving_batches for update
to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.role::text = any(array['admin','pastor','treasurer'])
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id=(select auth.uid())
    and p.role::text = any(array['admin','pastor','treasurer'])
));

drop policy if exists "bible study giving finance delete draft" on public.bible_study_giving_batches;
create policy "bible study giving finance delete draft"
on public.bible_study_giving_batches for delete
to authenticated
using (
  workflow_status='draft'
  and exists (
    select 1 from public.profiles p
    where p.user_id=(select auth.uid())
      and p.role::text = any(array['admin','pastor','treasurer'])
  )
);

create or replace function public.guard_bible_study_giving_batch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_summary public.cms_service_summaries%rowtype;
begin
  select p.role::text into v_role
  from public.profiles p
  where p.user_id=(select auth.uid());

  if coalesce(v_role,'') not in ('admin','pastor','treasurer') then
    raise exception 'Only Admin, Pastor, or Treasurer can manage Bible Study giving';
  end if;

  if tg_op='INSERT' then
    select * into v_summary from public.cms_service_summaries where id=new.service_summary_id;
    if not found or v_summary.summary_type <> 'Bible Study' then
      raise exception 'Bible Study giving must be linked to a Bible Study summary';
    end if;
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

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_bible_study_giving_batch on public.bible_study_giving_batches;
create trigger trg_guard_bible_study_giving_batch
before insert or update on public.bible_study_giving_batches
for each row execute function public.guard_bible_study_giving_batch();

create or replace function public.sync_bible_study_giving_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op='DELETE' then
    update public.cms_service_summaries
       set giving_workflow_status='not_started', updated_at=now()
     where id=old.service_summary_id;
    return old;
  end if;
  update public.cms_service_summaries
     set giving_workflow_status=new.workflow_status, updated_at=now()
   where id=new.service_summary_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_bible_study_giving_status on public.bible_study_giving_batches;
create trigger trg_sync_bible_study_giving_status
after insert or update or delete on public.bible_study_giving_batches
for each row execute function public.sync_bible_study_giving_status();

create or replace function public.guard_giving_record_batch()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sunday public.sunday_giving_batches%rowtype;
  v_old_sunday public.sunday_giving_batches%rowtype;
  v_bible public.bible_study_giving_batches%rowtype;
  v_old_bible public.bible_study_giving_batches%rowtype;
  v_summary public.cms_service_summaries%rowtype;
begin
  if tg_op='DELETE' then
    if old.sunday_batch_id is not null then
      select * into v_old_sunday from public.sunday_giving_batches where id=old.sunday_batch_id;
      if found and v_old_sunday.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Sunday batch are locked';
      end if;
    end if;
    if old.bible_study_batch_id is not null then
      select * into v_old_bible from public.bible_study_giving_batches where id=old.bible_study_batch_id;
      if found and v_old_bible.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Bible Study batch are locked';
      end if;
    end if;
    return old;
  end if;

  if tg_op='UPDATE' then
    if old.sunday_batch_id is not null then
      select * into v_old_sunday from public.sunday_giving_batches where id=old.sunday_batch_id;
      if found and v_old_sunday.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Sunday batch are locked';
      end if;
    end if;
    if old.bible_study_batch_id is not null then
      select * into v_old_bible from public.bible_study_giving_batches where id=old.bible_study_batch_id;
      if found and v_old_bible.workflow_status <> 'draft' then
        raise exception 'Giving records in a submitted or approved Bible Study batch are locked';
      end if;
    end if;
  end if;

  if num_nonnulls(new.sunday_batch_id,new.bible_study_batch_id) > 1 then
    raise exception 'A giving record can belong to only one giving batch';
  end if;

  if new.sunday_batch_id is not null then
    select * into v_sunday from public.sunday_giving_batches where id=new.sunday_batch_id;
    if not found then raise exception 'Sunday giving batch not found'; end if;
    if v_sunday.workflow_status <> 'draft' then raise exception 'Only draft Sunday giving can be edited'; end if;
    if new.given_on <> v_sunday.sunday_date then raise exception 'Giving date must match the Sunday batch date'; end if;
  end if;

  if new.bible_study_batch_id is not null then
    select * into v_bible from public.bible_study_giving_batches where id=new.bible_study_batch_id;
    if not found then raise exception 'Bible Study giving batch not found'; end if;
    if v_bible.workflow_status <> 'draft' then raise exception 'Only draft Bible Study giving can be edited'; end if;
    select * into v_summary from public.cms_service_summaries where id=v_bible.service_summary_id;
    if not found or v_summary.summary_type <> 'Bible Study' then raise exception 'Bible Study summary not found'; end if;
    if new.given_on <> v_summary.summary_date then raise exception 'Giving date must match the Bible Study date'; end if;
    if new.giving_type not in ('Tithe','Offering') then raise exception 'Bible Study giving supports Tithe and Offering entries only'; end if;
    if new.giving_type='Tithe' and new.member_id is null then raise exception 'A tithe must be linked to a member'; end if;
  end if;

  return new;
end;
$$;

drop policy if exists "giving private read" on public.giving_records;
create policy "giving private read"
on public.giving_records for select
to authenticated
using (
  member_id = public.current_member_id()
  or public.current_role() = any(array['admin'::public.app_role,'pastor'::public.app_role,'treasurer'::public.app_role])
);

create or replace function public.get_bible_study_finance_sessions(p_limit integer default 30)
returns table (
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
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  select p.role::text into v_role from public.profiles p where p.user_id=(select auth.uid());
  if coalesce(v_role,'') not in ('admin','pastor','treasurer') then
    raise exception 'Bible Study finance is restricted to Admin, Pastor, and Treasurer' using errcode='42501';
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
         coalesce(sum(case when g.giving_type='Tithe' then g.amount else 0 end),0)::numeric,
         coalesce(sum(case when g.giving_type='Offering' then g.amount else 0 end),0)::numeric,
         count(g.id)
  from public.cms_service_summaries s
  left join public.bible_study_giving_batches b on b.service_summary_id=s.id
  left join public.giving_records g on g.bible_study_batch_id=b.id
  where s.summary_type='Bible Study'
  group by s.id,s.title,s.summary_date,s.area_id,s.barangay,s.attendance_count,s.member_count,s.giving_workflow_status,b.id,b.workflow_status,s.created_at
  order by s.summary_date desc,s.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),100));
end;
$$;

revoke all on function public.get_bible_study_finance_sessions(integer) from public;
grant execute on function public.get_bible_study_finance_sessions(integer) to authenticated;
