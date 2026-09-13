-- The authenticated photo-upload service uses the trusted service_role client.
-- Ordinary users still have the existing own-member, photo-only restriction.
create or replace function public.guard_member_self_photo_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role')
     or public.current_role() = 'admin'::public.app_role then
    return new;
  end if;
  if auth.uid() is null or public.current_member_id() is distinct from old.id then
    raise exception 'Only your own member profile can be updated';
  end if;
  -- Generated names are recalculated after BEFORE triggers; they cannot be
  -- written by clients and must not make a legitimate photo update fail.
  if (to_jsonb(new) - 'photo_url' - 'display_name')
     is distinct from (to_jsonb(old) - 'photo_url' - 'display_name') then
    raise exception 'Only profile photo changes are allowed for your own member profile';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_member_self_photo_update() from public, anon, authenticated;

update public.members m
set photo_url = p.profile_photo_url
from public.profiles p
where p.member_id = m.id
  and nullif(trim(p.profile_photo_url), '') is not null
  and m.photo_url is distinct from p.profile_photo_url;
