-- Add non-Sunday attendance types for Bible Study and Midweek Service.

alter table public.attendance
  add column if not exists attendance_type text;

update public.attendance
set attendance_type='sunday'
where attendance_type is null;

alter table public.attendance
  alter column attendance_type set default 'sunday',
  alter column attendance_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.attendance'::regclass
      and conname='attendance_type_check'
  ) then
    alter table public.attendance
      add constraint attendance_type_check
      check (attendance_type in ('sunday','bible_study','midweek_service'));
  end if;
end $$;

create index if not exists attendance_type_checked_in_idx
  on public.attendance(attendance_type, checked_in_at desc);

create or replace function public.prevent_duplicate_daily_attendance()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  day_start timestamptz;
  day_end timestamptz;
  type_key text;
begin
  if new.member_id is null or new.checked_in_at is null then
    return new;
  end if;

  type_key := coalesce(new.attendance_type,'sunday');

  perform pg_advisory_xact_lock(hashtext(new.member_id::text || ':' || type_key));

  day_start := (date_trunc('day', new.checked_in_at at time zone 'Asia/Manila') at time zone 'Asia/Manila');
  day_end := day_start + interval '1 day';

  if exists (
    select 1
    from public.attendance a
    where a.member_id = new.member_id
      and coalesce(a.attendance_type,'sunday') = type_key
      and a.checked_in_at >= day_start
      and a.checked_in_at < day_end
      and (tg_op = 'INSERT' or a.id <> new.id)
  ) then
    raise unique_violation
      using constraint = 'attendance_one_checkin_per_member_per_day_and_type',
            message = 'Member has already checked in for this attendance type today.';
  end if;

  return new;
end;
$function$;

drop trigger if exists attendance_one_checkin_per_day on public.attendance;
create trigger attendance_one_checkin_per_day
before insert or update of member_id, checked_in_at, attendance_type
on public.attendance
for each row execute function public.prevent_duplicate_daily_attendance();
