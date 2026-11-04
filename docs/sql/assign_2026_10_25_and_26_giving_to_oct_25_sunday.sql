-- One-time, manual-only finance correction for 2026-10-25 (Sunday) and 2026-10-26 (Monday).
-- Target: 2026-10-25 Sunday giving batch. Do NOT add this to automatic migrations.
--
-- Prerequisites:
--  1. Apply supabase/migrations/20261104_allow_weekday_sunday_giving_assignment.sql
--     (or have its updated guard_giving_record_batch() function in the database).
--  2. Confirm the 2026-10-25 Sunday giving batch exists and is in 'draft'.
--  3. Review the eligible rows and their original batch IDs before running this as an
--     authorized database administrator. A transaction rolls back on any exception.
--
-- Scope: normal Tithe and Offering records dated Oct 25 or 26, 2026.
-- Bible Study giving is explicitly excluded. Records linked to other draft Sunday
-- batches are reassigned to Oct 25; submitted/approved batches are never changed.
-- The actual date received (giving_records.given_on) is NOT modified.

begin;

do $$
declare
  v_target_id uuid;
  v_target_status text;
  v_eligible integer;
  v_changed integer;
  v_assigned integer;
  v_other_drafts integer;
begin
  select b.id, b.workflow_status
    into v_target_id, v_target_status
  from public.sunday_giving_batches b
  where b.sunday_date = date '2026-10-25'
  for update;

  if v_target_id is null then
    raise exception 'Sunday batch for 2026-10-25 does not exist. Create it as a draft using the app before running this script.';
  end if;
  if v_target_status <> 'draft' then
    raise exception 'Sunday batch for 2026-10-25 is %, not draft. No records were changed.', v_target_status;
  end if;

  -- Never move records out of a submitted or approved batch.
  if exists (
    select 1
    from public.giving_records g
    join public.sunday_giving_batches b on b.id = g.sunday_batch_id
    where g.given_on in (date '2026-10-25', date '2026-10-26')
      and g.giving_type in ('Tithe','Offering')
      and g.bible_study_batch_id is null
      and g.sunday_batch_id is distinct from v_target_id
      and b.workflow_status <> 'draft'
  ) then
    raise exception 'At least one Oct 25/26 contribution is in a submitted or approved Sunday batch. No records were changed.';
  end if;

  select count(*)
    into v_eligible
  from public.giving_records g
  where g.given_on in (date '2026-10-25', date '2026-10-26')
    and g.giving_type in ('Tithe','Offering')
    and g.bible_study_batch_id is null;

  select count(*)
    into v_other_drafts
  from public.giving_records g
  join public.sunday_giving_batches b on b.id = g.sunday_batch_id
  where g.given_on in (date '2026-10-25', date '2026-10-26')
    and g.giving_type in ('Tithe','Offering')
    and g.bible_study_batch_id is null
    and g.sunday_batch_id is distinct from v_target_id
    and b.workflow_status = 'draft';

  update public.giving_records g
  set sunday_batch_id = v_target_id
  where g.given_on in (date '2026-10-25', date '2026-10-26')
    and g.giving_type in ('Tithe','Offering')
    and g.bible_study_batch_id is null
    and g.sunday_batch_id is distinct from v_target_id;

  get diagnostics v_changed = row_count;

  select count(*)
    into v_assigned
  from public.giving_records g
  where g.given_on in (date '2026-10-25', date '2026-10-26')
    and g.giving_type in ('Tithe','Offering')
    and g.bible_study_batch_id is null
    and g.sunday_batch_id = v_target_id;

  if v_assigned <> v_eligible then
    raise exception 'Expected % eligible records in Sunday batch, found %. Changes rolled back.', v_eligible, v_assigned;
  end if;

  raise notice 'Oct 25/26 giving: % eligible, % updated, % reassigned from other draft batches, % now assigned to 2026-10-25.',
    v_eligible, v_changed, v_other_drafts, v_assigned;
end;
$$;

commit;

-- Read-only verification after commit: all returned rows should have matching
-- records and assigned_to_oct_25 counts. No member names or amounts are exposed.
select
  g.given_on as received_date,
  g.giving_type,
  count(*) as records,
  count(*) filter (where b.sunday_date = date '2026-10-25') as assigned_to_oct_25
from public.giving_records g
left join public.sunday_giving_batches b on b.id = g.sunday_batch_id
where g.given_on in (date '2026-10-25', date '2026-10-26')
  and g.giving_type in ('Tithe','Offering')
  and g.bible_study_batch_id is null
group by g.given_on, g.giving_type
order by g.given_on, g.giving_type;
