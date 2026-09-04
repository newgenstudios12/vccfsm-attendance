create or replace function public.get_member_followup_alerts(p_days integer default 28)
returns table(
  member_id uuid,
  display_name text,
  member_code text,
  area_id uuid,
  area_name text,
  last_activity_at timestamptz,
  days_inactive integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      lower(replace(coalesce(p.role::text, ''), ' ', '_')) as role_name,
      p.area_id
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1
  ),
  eligible as (
    select
      m.id as member_id,
      coalesce(nullif(m.display_name,''), nullif(trim(concat_ws(' ',m.first_name,m.last_name)),''), m.member_code, 'Member') as display_name,
      m.member_code,
      m.area_id,
      a.name as area_name,
      m.created_at
    from public.members m
    left join public.areas a on a.id = m.area_id
    cross join me
    where m.is_active is distinct from false
      and lower(coalesce(m.status,'active')) <> 'inactive'
      and (
        me.role_name in ('admin','pastor')
        or (me.role_name = 'area_leader' and m.area_id = me.area_id)
      )
  ),
  activity_rows as (
    select at.member_id, at.checked_in_at as activity_at
    from public.attendance at
    where at.member_id is not null and at.checked_in_at is not null

    union all

    select r.member_id,
      coalesce(r.checked_in_at, e.start_at, r.registered_at) as activity_at
    from public.church_event_registrations r
    left join public.church_events e on e.id = r.event_id
    where r.member_id is not null
      and (lower(coalesce(r.status,'')) = 'attended' or r.checked_in_at is not null)
  ),
  latest as (
    select member_id, max(activity_at) as last_activity_at
    from activity_rows
    group by member_id
  ),
  scored as (
    select
      e.*,
      l.last_activity_at,
      greatest(
        coalesce(l.last_activity_at, '1970-01-01'::timestamptz),
        coalesce(e.created_at, '1970-01-01'::timestamptz)
      ) as inactivity_from
    from eligible e
    left join latest l on l.member_id = e.member_id
  )
  select
    s.member_id,
    s.display_name,
    s.member_code,
    s.area_id,
    coalesce(s.area_name,'Unassigned') as area_name,
    s.last_activity_at,
    floor(extract(epoch from (now() - s.inactivity_from)) / 86400)::integer as days_inactive
  from scored s
  where s.inactivity_from <= now() - (greatest(coalesce(p_days,28),1) * interval '1 day')
  order by days_inactive desc, display_name;
$$;

revoke all on function public.get_member_followup_alerts(integer) from public;
grant execute on function public.get_member_followup_alerts(integer) to authenticated;
