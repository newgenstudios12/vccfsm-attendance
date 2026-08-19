create or replace function public.link_my_member_profile()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare uid uuid := auth.uid(); email_local text; profile_name text; candidate uuid; candidate_count integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where user_id = uid and member_id is not null) then return (select member_id from public.profiles where user_id = uid); end if;
  select lower(split_part(email,'@',1)) into email_local from auth.users where id = uid;
  select lower(trim(display_name)) into profile_name from public.profiles where user_id = uid;
  with candidates as (
    select distinct m.id from public.members m
    where m.is_active is distinct from false and (
      lower(trim(m.display_name)) = profile_name
      or lower(trim(m.first_name)) = email_local
      or lower(trim(m.last_name)) = email_local
      or lower(trim(m.display_name)) = regexp_replace(email_local, '.*[._-]', '')
      or lower(trim(m.first_name)) = regexp_replace(email_local, '.*[._-]', '')
      or lower(trim(m.last_name)) = regexp_replace(email_local, '.*[._-]', '')
    )
  ) select count(*), min(id) into candidate_count, candidate from candidates;
  if candidate_count <> 1 then return null; end if;
  update public.profiles set member_id=candidate, updated_at=now() where user_id=uid and member_id is null;
  return candidate;
end;
$$;
revoke all on function public.link_my_member_profile() from public;
grant execute on function public.link_my_member_profile() to authenticated;
