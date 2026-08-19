-- Allow authenticated members to update only their own profile photo.
-- The trigger prevents self-updates to protected member fields.
create or replace function public.guard_member_self_photo_update()
returns trigger
language plpgsql
security invoker
as $$
begin
  if public.current_role() = 'admin'::app_role then
    return new;
  end if;

  if auth.uid() is null or public.current_member_id() is distinct from old.id then
    raise exception 'Only your own member profile can be updated';
  end if;

  if (to_jsonb(new) - 'photo_url') is distinct from (to_jsonb(old) - 'photo_url') then
    raise exception 'Only profile photo changes are allowed for your own member profile';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_member_self_photo_update on public.members;
create trigger trg_guard_member_self_photo_update
before update on public.members
for each row execute function public.guard_member_self_photo_update();

drop policy if exists members_self_photo_update on public.members;
create policy members_self_photo_update
on public.members
for update to authenticated
using (id = public.current_member_id())
with check (id = public.current_member_id());

grant update on public.members to authenticated;
