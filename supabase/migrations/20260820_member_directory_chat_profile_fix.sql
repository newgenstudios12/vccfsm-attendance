-- Members may view the member directory, but existing write policies continue to restrict edits.
drop policy if exists members_select_scoped on public.members;
drop policy if exists members_select_authenticated on public.members;
create policy members_select_authenticated
on public.members
for select to authenticated
using (true);

-- Chat RPCs are safe authenticated entry points and should not depend on client-visible table policies.
create or replace function public.get_chat_list()
returns table(
  conversation_id uuid,
  other_user_id uuid,
  other_name text,
  other_photo_url text,
  area_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer
)
language sql
security definer
set search_path to ''
as $$
  select * from private.get_vccf_chat_list();
$$;

create or replace function public.search_chat_accounts(p_query text default '')
returns table(user_id uuid, display_name text, photo_url text, area_name text)
language sql
security definer
set search_path to ''
as $$
  select * from private.search_vccf_chat_accounts(p_query);
$$;

create or replace function public.start_direct_chat(p_other_user_id uuid)
returns uuid
language sql
security definer
set search_path to ''
as $$
  select private.start_vccf_direct_chat(p_other_user_id);
$$;

grant execute on function public.get_chat_list() to authenticated;
grant execute on function public.search_chat_accounts(text) to authenticated;
grant execute on function public.start_direct_chat(uuid) to authenticated;

-- A user cannot assign their profile to an arbitrary visible member. The trusted linker RPC is the only self-link path.
drop policy if exists profiles_self_link_member on public.profiles;
drop policy if exists profiles_self_member_link on public.profiles;
create policy profiles_self_member_link
on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and member_id is not distinct from (
    select p.member_id from public.profiles p where p.user_id = (select auth.uid())
  )
);

grant update on public.profiles to authenticated;

-- Stronger matching for accounts such as firstname.lastname@gmail.com -> member firstname.
create or replace function public.link_my_member_profile()
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  uid uuid := (select auth.uid());
  email_value text;
  localpart text;
  profile_name text;
  token text;
  candidate uuid;
  candidate_count integer;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if exists (select 1 from public.profiles where user_id = uid and member_id is not null) then
    return (select member_id from public.profiles where user_id = uid);
  end if;

  select lower(au.email) into email_value from auth.users au where au.id = uid;
  localpart := lower(split_part(coalesce(email_value,''),'@',1));
  token := regexp_replace(localpart, '^(.*[._-])', '');
  select lower(trim(p.display_name)) into profile_name from public.profiles p where p.user_id = uid;

  with candidates as (
    select distinct m.id
    from public.members m
    where coalesce(m.is_active, true)
      and (
        lower(trim(m.display_name)) in (profile_name, token)
        or lower(trim(m.first_name)) in (localpart, token)
        or lower(trim(m.last_name)) in (localpart, token)
        or lower(trim(concat_ws(' ', m.first_name, m.last_name))) = localpart
      )
  )
  select count(*), min(id) into candidate_count, candidate from candidates;

  if candidate_count <> 1 then return null; end if;

  update public.profiles
  set member_id = candidate, updated_at = now()
  where user_id = uid and member_id is null;

  return candidate;
end;
$$;

grant execute on function public.link_my_member_profile() to authenticated;
