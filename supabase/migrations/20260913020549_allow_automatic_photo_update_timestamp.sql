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
