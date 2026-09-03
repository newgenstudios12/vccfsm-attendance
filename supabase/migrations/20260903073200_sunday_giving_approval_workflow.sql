-- Sunday Tithes & Offerings approval workflow with e-signatures.
-- Approved Sunday batches are the only finance source for Sunday Summary totals.

create table if not exists public.sunday_giving_batches (
  id uuid primary key default gen_random_uuid(),
  sunday_date date not null unique,
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft','submitted','approved')),
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_signature_name text,
  recorded_signed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_signature_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sunday_giving_batches_sunday_date_check
    check (extract(dow from sunday_date) = 0)
);

alter table public.sunday_giving_batches enable row level security;
revoke all on public.sunday_giving_batches from anon;
grant select,insert,update,delete on public.sunday_giving_batches to authenticated;

drop policy if exists "sunday_giving_finance_read" on public.sunday_giving_batches;
drop policy if exists "sunday_giving_finance_insert" on public.sunday_giving_batches;
drop policy if exists "sunday_giving_finance_update" on public.sunday_giving_batches;
drop policy if exists "sunday_giving_finance_delete_draft" on public.sunday_giving_batches;

create policy "sunday_giving_finance_read"
on public.sunday_giving_batches for select to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor')));

create policy "sunday_giving_finance_insert"
on public.sunday_giving_batches for insert to authenticated
with check (
  recorded_by=(select auth.uid())
  and workflow_status='draft'
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
);

create policy "sunday_giving_finance_update"
on public.sunday_giving_batches for update to authenticated
using (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor')))
with check (exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor')));

create policy "sunday_giving_finance_delete_draft"
on public.sunday_giving_batches for delete to authenticated
using (
  workflow_status='draft'
  and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.role::text in ('admin','pastor'))
);

alter table public.giving_records
  add column if not exists sunday_batch_id uuid
  references public.sunday_giving_batches(id) on delete set null;

create index if not exists giving_records_sunday_batch_idx
  on public.giving_records(sunday_batch_id);

create or replace function public.guard_sunday_giving_batch()
returns trigger language plpgsql security invoker set search_path to 'public'
as $function$
declare
  v_role text;
begin
  select p.role::text into v_role from public.profiles p where p.user_id=(select auth.uid());

  if coalesce(v_role,'') not in ('admin','pastor') then
    raise exception 'Only Admin or Pastor can manage Sunday giving';
  end if;

  if tg_op='INSERT' then
    if new.workflow_status <> 'draft' then raise exception 'Sunday giving must start as a draft'; end if;
    if new.recorded_by is distinct from (select auth.uid()) then raise exception 'Recorder must match the signed-in account'; end if;
    if exists (
      select 1 from public.cms_sunday_event_summaries s
      where s.summary_type='sunday' and s.summary_date=new.sunday_date and s.workflow_status='posted'
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

  if old.workflow_status='approved' then raise exception 'Approved Sunday giving is locked'; end if;
  if old.sunday_date is distinct from new.sunday_date then raise exception 'Sunday date cannot be changed after the batch is created'; end if;
  if old.recorded_by is distinct from new.recorded_by then raise exception 'Recorder cannot be changed'; end if;
  if old.workflow_status='submitted' and new.workflow_status='submitted' then raise exception 'Submitted Sunday giving is locked until approval'; end if;

  if old.workflow_status='draft' and new.workflow_status='submitted' then
    if nullif(btrim(coalesce(new.recorded_signature_name,'')),'') is null then raise exception 'Recorder e-signature is required before submission'; end if;
    new.recorded_signed_at := now();
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;
  elsif old.workflow_status='submitted' and new.workflow_status='approved' then
    if nullif(btrim(coalesce(new.approved_signature_name,'')),'') is null then raise exception 'Approver e-signature is required'; end if;
    new.approved_by := (select auth.uid());
    new.approved_at := now();
  elsif new.workflow_status is distinct from old.workflow_status then
    raise exception 'Invalid Sunday giving workflow transition';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_guard_sunday_giving_batch on public.sunday_giving_batches;
create trigger trg_guard_sunday_giving_batch
before insert or update on public.sunday_giving_batches
for each row execute function public.guard_sunday_giving_batch();

create or replace function public.guard_giving_record_batch()
returns trigger language plpgsql security invoker set search_path to 'public'
as $function$
declare
  v_batch public.sunday_giving_batches%rowtype;
  v_old_batch public.sunday_giving_batches%rowtype;
begin
  if tg_op='DELETE' then
    if old.sunday_batch_id is not null then
      select * into v_old_batch from public.sunday_giving_batches where id=old.sunday_batch_id;
      if found and v_old_batch.workflow_status <> 'draft' then raise exception 'Giving records in a submitted or approved Sunday batch are locked'; end if;
    end if;
    return old;
  end if;

  if tg_op='UPDATE' and old.sunday_batch_id is not null then
    select * into v_old_batch from public.sunday_giving_batches where id=old.sunday_batch_id;
    if found and v_old_batch.workflow_status <> 'draft' then raise exception 'Giving records in a submitted or approved Sunday batch are locked'; end if;
  end if;

  if new.sunday_batch_id is not null then
    select * into v_batch from public.sunday_giving_batches where id=new.sunday_batch_id;
    if not found then raise exception 'Sunday giving batch not found'; end if;
    if v_batch.workflow_status <> 'draft' then raise exception 'Only draft Sunday giving can be edited'; end if;
    if new.given_on <> v_batch.sunday_date then raise exception 'Giving date must match the Sunday batch date'; end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_giving_record_batch on public.giving_records;
create trigger trg_guard_giving_record_batch
before insert or update or delete on public.giving_records
for each row execute function public.guard_giving_record_batch();

create or replace function public.sync_approved_sunday_giving_to_summary()
returns trigger language plpgsql security invoker set search_path to 'public'
as $function$
declare
  v_tithe numeric := 0;
  v_offering numeric := 0;
begin
  if new.workflow_status='approved' and old.workflow_status is distinct from 'approved' then
    select
      coalesce(sum(case when lower(g.giving_type)='tithe' then g.amount else 0 end),0),
      coalesce(sum(case when lower(g.giving_type)='offering' then g.amount else 0 end),0)
    into v_tithe,v_offering
    from public.giving_records g
    where g.sunday_batch_id=new.id;

    update public.cms_sunday_event_summaries s
      set tithe_total=v_tithe,offering_total=v_offering,updated_at=now()
    where s.summary_type='sunday'
      and s.summary_date=new.sunday_date
      and s.workflow_status <> 'posted';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sync_approved_sunday_giving_to_summary on public.sunday_giving_batches;
create trigger trg_sync_approved_sunday_giving_to_summary
after update on public.sunday_giving_batches
for each row execute function public.sync_approved_sunday_giving_to_summary();

create or replace function public.cms_guard_sunday_summary_workflow()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_role text;
  v_tithe numeric := 0;
  v_offering numeric := 0;
begin
  select p.role::text into v_role from public.profiles p where p.user_id=(select auth.uid());

  if new.summary_type='sunday' then
    select
      coalesce(sum(case when lower(g.giving_type)='tithe' then g.amount else 0 end),0),
      coalesce(sum(case when lower(g.giving_type)='offering' then g.amount else 0 end),0)
    into v_tithe,v_offering
    from public.sunday_giving_batches b
    left join public.giving_records g on g.sunday_batch_id=b.id
    where b.sunday_date=new.summary_date and b.workflow_status='approved';

    new.tithe_total := v_tithe;
    new.offering_total := v_offering;
  end if;

  if tg_op='INSERT' then
    if coalesce(new.workflow_status,'draft') <> 'draft' then raise exception 'A Sunday summary must start as a draft'; end if;
    new.workflow_status := 'draft';
    new.updated_at := now();
    return new;
  end if;

  if old.workflow_status='posted' then raise exception 'A posted Sunday summary is locked'; end if;
  if old.workflow_status='draft' and new.workflow_status='posted' then raise exception 'Submit the Sunday summary before posting it'; end if;

  if old.workflow_status='draft' and new.workflow_status='submitted' then
    new.submitted_at := now();
    new.submitted_by := (select auth.uid());
  elsif old.workflow_status='submitted' and new.workflow_status='posted' then
    if coalesce(v_role,'') not in ('admin','pastor') then raise exception 'Only Pastor or Admin can post a submitted Sunday summary'; end if;
    if exists (
      select 1 from public.sunday_giving_batches b
      where b.sunday_date=new.summary_date and b.workflow_status <> 'approved'
    ) then
      raise exception 'Approve the Sunday tithes and offerings before posting this summary';
    end if;
    new.posted_at := now();
    new.posted_by := (select auth.uid());
  elsif new.workflow_status is distinct from old.workflow_status then
    raise exception 'Invalid Sunday summary workflow transition';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;
