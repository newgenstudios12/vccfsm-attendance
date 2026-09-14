-- Fix announcement creation for Area Leaders while preserving RLS scope.
-- Area Leaders are automatically restricted to Area announcements for their assigned area.

create or replace function public.enforce_announcement_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_area_id uuid;
begin
  select p.role::text, p.area_id
    into v_role, v_area_id
  from public.profiles p
  where p.user_id = auth.uid();

  if v_role = 'area_leader' then
    if v_area_id is null then
      raise exception 'Your Area Leader account is not assigned to an area.';
    end if;

    new.audience := 'Area';
    new.area_id := v_area_id;
    new.ministry_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists church_announcements_enforce_scope on public.church_announcements;
create trigger church_announcements_enforce_scope
before insert or update on public.church_announcements
for each row execute function public.enforce_announcement_scope();

drop policy if exists church_announcements_manage on public.church_announcements;
create policy church_announcements_manage
on public.church_announcements
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'area_leader'
      and p.area_id = church_announcements.area_id
      and church_announcements.audience = 'Area'
  )
  or exists (
    select 1
    from public.profiles p
    join public.church_leadership l
      on l.member_id = p.member_id and l.is_active
    where p.user_id = auth.uid()
      and p.role::text = 'ministry_leader'
      and l.ministry_id = church_announcements.ministry_id
      and church_announcements.audience = 'Ministry'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text in ('admin','pastor')
  )
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = 'area_leader'
      and p.area_id = church_announcements.area_id
      and church_announcements.audience = 'Area'
  )
  or exists (
    select 1
    from public.profiles p
    join public.church_leadership l
      on l.member_id = p.member_id and l.is_active
    where p.user_id = auth.uid()
      and p.role::text = 'ministry_leader'
      and l.ministry_id = church_announcements.ministry_id
      and church_announcements.audience = 'Ministry'
  )
);

-- This function is trigger-only; it should not be callable through the API.
revoke execute on function public.enforce_announcement_scope() from public, anon, authenticated;
