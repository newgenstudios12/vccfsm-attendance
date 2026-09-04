create or replace function public.update_member_contact_fields(p_member_id uuid, p_contact_number text default null, p_email text default null)
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.members;
  caller_role public.app_role;
  caller_area uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_role();
  select area_id into caller_area from public.profiles where user_id=auth.uid();
  if caller_role not in ('admin'::public.app_role,'pastor'::public.app_role,'area_leader'::public.app_role) then
    raise exception 'Not authorized to update member contact information';
  end if;
  if caller_role='area_leader'::public.app_role and not exists(select 1 from public.members m where m.id=p_member_id and m.area_id=caller_area) then
    raise exception 'Area leaders can only update members in their area';
  end if;
  update public.members m
     set contact_number=nullif(btrim(p_contact_number),''),
         email=nullif(btrim(p_email),''),
         updated_at=now()
   where m.id=p_member_id
   returning m.* into r;
  if r.id is null then raise exception 'Member not found'; end if;
  return r;
end;
$$;
grant execute on function public.update_member_contact_fields(uuid,text,text) to authenticated;
