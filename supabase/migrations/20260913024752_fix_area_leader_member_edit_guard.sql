-- Permit church record edits already authorized by member RLS.
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
     or public.current_role() in ('admin'::public.app_role, 'pastor'::public.app_role) then
    return new;
  end if;
  -- Both the existing and resulting member must remain in the leader's area.
  -- RLS independently applies the same scope to reads and writes.
  if auth.uid() is not null
     and public.current_role() = 'area_leader'::public.app_role then
    if public.current_area_id() is null
       or old.area_id is distinct from public.current_area_id()
       or new.area_id is distinct from public.current_area_id() then
      raise exception 'Area leaders can only update members in their area';
    end if;
    return new;
  end if;
  if auth.uid() is null or public.current_member_id() is distinct from old.id then
    raise exception 'Only your own member profile can be updated';
  end if;
  -- Generated names and the server-maintained updated_at timestamp must not
  -- make a photo-only update fail. The earlier timestamp trigger always
  -- overwrites any client-supplied timestamp with now().
  if (to_jsonb(new) - 'photo_url' - 'display_name' - 'updated_at')
     is distinct from (to_jsonb(old) - 'photo_url' - 'display_name' - 'updated_at') then
    raise exception 'Only profile photo changes are allowed for your own member profile';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_member_self_photo_update() from public, anon, authenticated;
