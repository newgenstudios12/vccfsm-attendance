-- An inactive member becomes active after attending on three distinct
-- Philippine calendar dates in a single calendar month.
-- Count recorded attendance of any type; multiple services on one date
-- count only once. Does not automatically deactivate anyone.
create or replace function public.activate_member_after_three_attendances()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_start timestamp;
  v_month_end timestamp;
  v_attended_days integer;
begin
  if new.member_id is null or new.checked_in_at is null then
    return new;
  end if;

  -- Serialize attendance-triggered changes for the same member.
  perform pg_advisory_xact_lock(hashtext('member-activation:' || new.member_id::text));

  v_month_start := date_trunc('month', new.checked_in_at at time zone 'Asia/Manila');
  v_month_end := v_month_start + interval '1 month';

  select count(distinct (a.checked_in_at at time zone 'Asia/Manila')::date)
    into v_attended_days
  from public.attendance a
  where a.member_id = new.member_id
    and a.checked_in_at >= (v_month_start at time zone 'Asia/Manila')
    and a.checked_in_at < (v_month_end at time zone 'Asia/Manila');

  if v_attended_days >= 3 then
    update public.members m
       set status = 'active',
           is_active = true,
           status_updated_at = now(),
           status_manual_override_at = null
     where m.id = new.member_id
       and m.status = 'inactive';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activate_member_after_three_attendances on public.attendance;
create trigger trg_activate_member_after_three_attendances
after insert or update of member_id, checked_in_at, attendance_type
on public.attendance
for each row execute function public.activate_member_after_three_attendances();

-- The function is intended only as a table trigger, not a public RPC.
revoke all on function public.activate_member_after_three_attendances() from public, anon, authenticated;
