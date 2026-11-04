-- Allow an Admin or Pastor to return a SUBMITTED Sunday giving batch to DRAFT.
-- Reason and signer reset are mandatory; audit_log captures an immutable event.
-- Approved batches and posted Sunday Summaries remain locked.
-- Reopening is an authenticated workflow action, not a bulk data backfill.

alter table public.sunday_giving_batches
  add column if not exists reopened_reason text,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null,
  add column if not exists reopened_at timestamptz;

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
    new.reopened_reason := null;
    new.reopened_by := null;
    new.reopened_at := null;
    new.updated_at := now();
    return new;
  end if;

  if old.workflow_status = 'approved' then
    raise exception 'Approved Sunday giving is locked';
  end if;

  -- Reopening metadata is not editable except during a submitted -> draft transition.
  if not (old.workflow_status = 'submitted' and new.workflow_status = 'draft') then
    if new.reopened_reason is distinct from old.reopened_reason
      or new.reopened_by is distinct from old.reopened_by
      or new.reopened_at is distinct from old.reopened_at then
      raise exception 'Sunday reopening metadata cannot be changed directly';
    end if;
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
  elsif old.workflow_status = 'submitted' and new.workflow_status = 'draft' then
    -- Only an Admin or Pastor may reopen a signed but not approved Sunday batch.
    if coalesce(v_role, '') not in ('admin', 'pastor') then
      raise exception 'Only Admin or Pastor can return submitted Sunday giving to draft';
    end if;
    if char_length(btrim(coalesce(new.reopened_reason, ''))) < 10 then
      raise exception 'A reason of at least 10 characters is required to reopen Sunday giving';
    end if;
    if new.reopened_reason is not distinct from old.reopened_reason then
      raise exception 'Provide a new reason when returning Sunday giving to draft';
    end if;
    if exists (
      select 1 from public.cms_sunday_event_summaries s
      where s.summary_type = 'sunday'
        and s.summary_date = old.sunday_date
        and s.workflow_status = 'posted'
    ) then
      raise exception 'Posted Sunday Summary cannot be reopened';
    end if;

    new.reopened_reason := btrim(new.reopened_reason);
    new.reopened_by := (select auth.uid());
    new.reopened_at := now();
    -- Signatures refer to the earlier totals and must not carry over to revised giving.
    new.recorded_signature_name := null;
    new.recorded_signed_at := null;
    new.approved_by := null;
    new.approved_signature_name := null;
    new.approved_at := null;

    -- Log the change in the existing authenticated, RLS-protected church audit trail.
    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, metadata)
    values (
      (select auth.uid()),
      'sunday_giving_returned_to_draft',
      'sunday_giving_batches',
      old.id,
      jsonb_build_object(
        'sunday_date', old.sunday_date,
        'reason', new.reopened_reason,
        'previous_status', old.workflow_status,
        'new_status', new.workflow_status,
        'previous_signed_at', old.recorded_signed_at
      )
    );
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

-- The existing trg_guard_sunday_giving_batch trigger already calls this function.
-- Audit writes use the existing audit_log insert policy (actor_user_id = auth.uid()).
