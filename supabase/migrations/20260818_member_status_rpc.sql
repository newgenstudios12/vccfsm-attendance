-- Reliable member-status updates through a SECURITY DEFINER RPC.
-- This avoids client-side UPDATE RLS conflicts while still enforcing
-- admin / area-leader permissions inside the database.

create or replace function public.set_member_status(
  p_member_id uuid,
  p_status text
)
returns table (
  id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  caller_area uuid;
  target_area uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception 'Invalid status. Use active or inactive.';
  end if;

  select p.role::text, p.area_id
    into caller_role, caller_area
  from public.profiles p
  where p.user_id = auth.uid();

  if caller_role is null then
    raise exception 'Profile not found';
  end if;

  select m.area_id
    into target_area
  from public.members m
  where m.id = p_member_id;

  if target_area is null and not exists (
    select 1 from public.members m where m.id = p_member_id
  ) then
    raise exception 'Member not found';
  end if;

  if caller_role = 'admin' then
    null;
  elsif caller_role in ('area leader', 'area_leader')
        and caller_area = target_area then
    null;
  else
    raise exception 'You do not have permission to change this member status';
  end if;

  update public.members
  set status = p_status,
      status_updated_at = now()
  where members.id = p_member_id;

  return query
  select m.id, m.status
  from public.members m
  where m.id = p_member_id;
end;
$$;

revoke all on function public.set_member_status(uuid, text) from public;
grant execute on function public.set_member_status(uuid, text) to authenticated;
